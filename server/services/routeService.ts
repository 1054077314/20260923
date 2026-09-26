// 路线服务：真实通勤耗时的唯一出口。
// 单条（/api/route-time）与批量（/api/commute-batch）共用同一套缓存键与限流。
// 诚实契约：无 key / 网络异常 / 解析失败一律 available:false，绝不返回估算值。

import { amapKey, AMAP_KEY_MISSING_HINT, DEFAULT_CITY } from '../config.js';
import {
  AMAP_MODE_ENDPOINTS,
  amapFetchJson,
  parseAmapRoute,
  parseAmapTransitSegments,
  readRouteCache,
  writeRouteCache,
} from '../route.js';
import type { RouteCacheEntry } from '../route.js';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteResultBase {
  available: boolean;
  minutes?: number;
  distanceMeters?: number;
  segments?: any[];
  source?: 'amap' | 'amap_cache';
  reason?: string;
}

export const ROUTE_CACHE_TTL_MS = 24 * 3600 * 1000;

/** 高德并发上限：免费 Key QPS 很紧，2 路并发 + 超限退避重试是实测可用档位 */
export const DEFAULT_ROUTE_CONCURRENCY = 2;

/** QPS 超限退避：等待后重试一次，仍失败才诚实上报不可用 */
const QPS_RETRY_DELAY_MS = 1200;
const QPS_LIMIT_MARKERS = ['CUQPS_HAS_EXCEEDED_THE_LIMIT', 'DAILY_QUERY_OVER_LIMIT', 'OVER_QUOTA'];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchRouteData(url: string): Promise<any> {
  const data = await amapFetchJson(url);
  const info = String(data?.info || data?.errcode || '');
  if (QPS_LIMIT_MARKERS.some((m) => info.includes(m))) {
    await sleep(QPS_RETRY_DELAY_MS);
    return await amapFetchJson(url);
  }
  return data;
}

export function isSupportedMode(mode: string): boolean {
  return Boolean(AMAP_MODE_ENDPOINTS[mode]);
}

export function routeCacheKey(from: LatLng, to: LatLng, mode: string): string {
  return `${from.lng},${from.lat}|${to.lng},${to.lat}|${mode}`;
}

function buildRouteUrl(mode: string, from: LatLng, to: LatLng, city: string, key: string): string {
  const origin = `${from.lng},${from.lat}`;
  const destination = `${to.lng},${to.lat}`;
  if (mode === 'bike') {
    return `${AMAP_MODE_ENDPOINTS.bike}?key=${key}&origin=${origin}&destination=${destination}`;
  }
  let url = `${AMAP_MODE_ENDPOINTS[mode]}?key=${key}&origin=${origin}&destination=${destination}&strategy=0`;
  if (mode === 'subway') url += `&city=${encodeURIComponent(city || DEFAULT_CITY)}`;
  return url;
}

/** 缓存命中判定：24h 内有效；需要分段详情但旧缓存没存 segments 时视为未命中 */
function readCache(key: string, wantDetail: boolean): RouteCacheEntry | null {
  const hit = readRouteCache()[key];
  if (!hit) return null;
  if (Date.now() - hit.cachedAt >= ROUTE_CACHE_TTL_MS) return null;
  if (wantDetail && !hit.segments) return null;
  return hit;
}

/**
 * 单条路线：缓存优先，未命中才打高德。
 */
export async function getRoute(params: {
  from: LatLng;
  to: LatLng;
  mode: string;
  city: string;
  wantDetail?: boolean;
}): Promise<RouteResultBase> {
  const { from, to, mode, city } = params;
  const wantDetail = Boolean(params.wantDetail);
  const key = amapKey();
  if (!key) {
    return {
      available: false,
      reason: `未配置 AMAP_KEY（高德 Web 服务 Key），无法获取真实路线。${AMAP_KEY_MISSING_HINT}`,
    };
  }
  if (!isSupportedMode(mode)) {
    return { available: false, reason: '不支持的通勤方式: ' + mode };
  }

  const cacheKey = routeCacheKey(from, to, mode);
  const hit = readCache(cacheKey, wantDetail);
  if (hit) {
    return {
      available: true,
      minutes: hit.minutes,
      distanceMeters: hit.distanceMeters,
      segments: hit.segments,
      source: 'amap_cache',
    };
  }

  try {
    const url = buildRouteUrl(mode, from, to, city, key);
    const data = await fetchRouteData(url);
    const parsed = parseAmapRoute(mode, data);
    if (!parsed) {
      return {
        available: false,
        reason: `高德未返回可用路线: ${data?.info || data?.errcode || '未知原因'}`,
      };
    }
    const segments = wantDetail && mode === 'subway' ? parseAmapTransitSegments(data) : null;
    const entry: RouteCacheEntry = { ...parsed, cachedAt: Date.now() };
    if (segments) entry.segments = segments;

    const cache = readRouteCache();
    cache[cacheKey] = entry;
    writeRouteCache(cache);

    return {
      available: true,
      minutes: parsed.minutes,
      distanceMeters: parsed.distanceMeters,
      segments: segments || undefined,
      source: 'amap',
    };
  } catch (err: any) {
    console.warn('route failed:', err?.message || err);
    return { available: false, reason: '路线规划请求失败（网络或服务异常），不提供估算值' };
  }
}

export interface BatchRouteItem {
  id: string;
  from: LatLng;
}

export interface BatchRouteMeta {
  requested: number;
  cacheHits: number;
  networkCalls: number;
}

/**
 * 批量路线：先批量查缓存，未命中的按并发上限打高德，最后统一写回缓存。
 * 外部调用次数 = 网络请求次数，调用方可据此验证缓存复用效果。
 */
export async function getRoutesBatch(params: {
  items: BatchRouteItem[];
  to: LatLng;
  mode: string;
  city: string;
  wantDetail?: boolean;
  concurrency?: number;
}): Promise<{ routes: Record<string, RouteResultBase>; meta: BatchRouteMeta }> {
  const { items, to, mode, city } = params;
  const wantDetail = Boolean(params.wantDetail);
  const concurrency = Math.max(1, Math.min(4, params.concurrency ?? DEFAULT_ROUTE_CONCURRENCY));
  const key = amapKey();

  const routes: Record<string, RouteResultBase> = {};
  const missing: BatchRouteItem[] = [];
  let cacheHits = 0;

  if (!key || !isSupportedMode(mode)) {
    const reason = !key
      ? `未配置 AMAP_KEY（高德 Web 服务 Key），无法获取真实路线。${AMAP_KEY_MISSING_HINT}`
      : '不支持的通勤方式: ' + mode;
    for (const item of items) routes[item.id] = { available: false, reason };
    return { routes, meta: { requested: items.length, cacheHits: 0, networkCalls: 0 } };
  }

  for (const item of items) {
    const hit = readCache(routeCacheKey(item.from, to, mode), wantDetail);
    if (hit) {
      routes[item.id] = {
        available: true,
        minutes: hit.minutes,
        distanceMeters: hit.distanceMeters,
        segments: hit.segments,
        source: 'amap_cache',
      };
      cacheHits++;
    } else {
      missing.push(item);
    }
  }

  if (missing.length === 0) {
    return { routes, meta: { requested: items.length, cacheHits, networkCalls: 0 } };
  }

  const cache = readRouteCache();
  const queue = [...missing];
  const worker = async () => {
    while (queue.length > 0) {
      const item = queue.shift()!;
      const cacheKey = routeCacheKey(item.from, to, mode);
      const reHit = readCache(cacheKey, wantDetail);
      if (reHit) {
        routes[item.id] = {
          available: true,
          minutes: reHit.minutes,
          distanceMeters: reHit.distanceMeters,
          segments: reHit.segments,
          source: 'amap_cache',
        };
        continue;
      }
      try {
        const url = buildRouteUrl(mode, item.from, to, city, key);
        const data = await fetchRouteData(url);
        const parsed = parseAmapRoute(mode, data);
        if (!parsed) {
          routes[item.id] = {
            available: false,
            reason: `高德未返回可用路线: ${data?.info || data?.errcode || '未知原因'}`,
          };
          continue;
        }
        const segments = wantDetail && mode === 'subway' ? parseAmapTransitSegments(data) : null;
        const entry: RouteCacheEntry = { ...parsed, cachedAt: Date.now() };
        if (segments) entry.segments = segments;
        cache[cacheKey] = entry;
        routes[item.id] = {
          available: true,
          minutes: parsed.minutes,
          distanceMeters: parsed.distanceMeters,
          segments: segments || undefined,
          source: 'amap',
        };
      } catch (err: any) {
        routes[item.id] = { available: false, reason: '路线规划请求失败（网络或服务异常），不提供估算值' };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, missing.length) }, worker));
  writeRouteCache(cache);

  return {
    routes,
    meta: {
      requested: items.length,
      cacheHits,
      networkCalls: missing.length,
    },
  };
}
