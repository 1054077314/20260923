// 通勤批量服务：一次请求内完成「坐标补全（归并去重）→ 路线批量查询（缓存优先 + 并发限流）」。
// 目的：把前端逐条打接口（数百次）压成每批一次，且同一小区/坐标只解析一次、只算一次路线。

import { geocodeMany } from './geocodeService.js';
import { getRoutesBatch, LatLng, RouteResultBase } from './routeService.js';
import { readGeocache } from '../geocode.js';

export interface CommuteItem {
  id: string;
  lat?: number;
  lng?: number;
  community?: string;
  address?: string;
}

export interface CommuteRouteInfo {
  state: 'ok' | 'unavailable';
  minutes?: number;
  distanceMeters?: number;
  segments?: any[];
  reason?: string;
}

export interface CommuteMeta {
  requested: number;
  /** 直接带坐标进来的条数 */
  withCoords: number;
  /** 需要做地理编码的唯一查询串数量（归并后） */
  geocodeQueries: number;
  geocodeResolved: number;
  routeCacheHits: number;
  routeNetworkCalls: number;
}

export function isValidLatLng(v: any): v is LatLng {
  return (
    typeof v?.lat === 'number' &&
    typeof v?.lng === 'number' &&
    v.lat > 0 &&
    v.lat < 90 &&
    v.lng > 0 &&
    v.lng < 180 &&
    !isNaN(v.lat) &&
    !isNaN(v.lng)
  );
}

export async function computeCommuteBatch(params: {
  city: string;
  to: LatLng;
  mode: string;
  wantDetail: boolean;
  items: CommuteItem[];
  concurrency?: number;
}): Promise<{ routes: Record<string, CommuteRouteInfo>; meta: CommuteMeta }> {
  const { city, to, mode, wantDetail, items } = params;
  const routes: Record<string, CommuteRouteInfo> = {};

  // 1. 坐标：显式坐标直接用；缺失的按查询串归并，只解析一次
  const queryToIds = new Map<string, string[]>();
  const directItems: { id: string; from: LatLng }[] = [];

  for (const item of items) {
    if (isValidLatLng({ lat: item.lat, lng: item.lng })) {
      directItems.push({ id: item.id, from: { lat: item.lat as number, lng: item.lng as number } });
      continue;
    }
    const query = [city, item.community || item.address || ''].filter(Boolean).join(' ').trim();
    if (!query) {
      routes[item.id] = { state: 'unavailable', reason: '缺少可定位的地址，不提供估算值' };
      continue;
    }
    const ids = queryToIds.get(query) || [];
    ids.push(item.id);
    queryToIds.set(query, ids);
  }

  // 2. 归并后的地址：先查 geocache，未命中再走高德（并发限流）
  const geocache = readGeocache();
  const resolvedCoords = new Map<string, LatLng>();
  const pendingQueries: string[] = [];

  for (const query of queryToIds.keys()) {
    const cached = geocache[query];
    if (cached && typeof cached.lat === 'number' && typeof cached.lng === 'number') {
      resolvedCoords.set(query, { lat: cached.lat, lng: cached.lng });
    } else {
      pendingQueries.push(query);
    }
  }

  let geocodeResolved = resolvedCoords.size;
  if (pendingQueries.length > 0) {
    const hits = await geocodeMany(pendingQueries, city, 2);
    for (const [q, hit] of hits) {
      resolvedCoords.set(q, { lat: hit.lat, lng: hit.lng });
      geocodeResolved++;
    }
  }

  for (const [query, ids] of queryToIds) {
    const coord = resolvedCoords.get(query);
    if (!coord) {
      for (const id of ids) {
        routes[id] = { state: 'unavailable', reason: '无真实坐标（地理编码未命中），不提供估算值' };
      }
      continue;
    }
    for (const id of ids) directItems.push({ id, from: coord });
  }

  // 3. 路线：按坐标去重后批量查询（缓存优先，未命中并发限流）
  const coordKeyToIds = new Map<string, string[]>();
  const uniqueRouteItems: { id: string; from: LatLng }[] = [];
  for (const item of directItems) {
    const key = `${item.from.lng.toFixed(5)},${item.from.lat.toFixed(5)}`;
    const ids = coordKeyToIds.get(key) || [];
    if (ids.length === 0) uniqueRouteItems.push(item);
    ids.push(item.id);
    coordKeyToIds.set(key, ids);
  }

  const { routes: batchRoutes, meta } = await getRoutesBatch({
    items: uniqueRouteItems,
    to,
    mode,
    city,
    wantDetail,
    concurrency: params.concurrency ?? 2,
  });

  // 同坐标的房源共用一条路线结果
  for (const ids of coordKeyToIds.values()) {
    const representativeId = ids[0];
    const result = batchRoutes[representativeId];
    for (const id of ids) routes[id] = toRouteInfo(result);
  }

  return {
    routes,
    meta: {
      requested: items.length,
      withCoords: directItems.length,
      geocodeQueries: queryToIds.size,
      geocodeResolved,
      routeCacheHits: meta.cacheHits,
      routeNetworkCalls: meta.networkCalls,
    },
  };
}

function toRouteInfo(result: RouteResultBase | undefined): CommuteRouteInfo {
  if (!result || !result.available) {
    return { state: 'unavailable', reason: result?.reason || '真实路线不可用' };
  }
  return {
    state: 'ok',
    minutes: result.minutes,
    distanceMeters: result.distanceMeters,
    segments: result.segments,
  };
}
