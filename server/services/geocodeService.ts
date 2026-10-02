// 地理编码服务：坐标解析的唯一口径。
// 三级解析顺序：显式坐标 → geocache → 本地字典 → 高德（可选）。
// 诚实契约：无 key / 网络异常 / 解析失败一律返回 null，绝不编造坐标。

import { amapKey, AMAP_KEY_MISSING_HINT } from '../config.js';
import { geocodeViaAmap, readGeocache, writeGeocache } from '../geocode.js';
import { cityCenterOf, distanceKm, resolveDictCoordinates } from '../cityDict.js';

/** 解析结果允许偏离城市中心的最大距离（km）：超出即视为误命中，不写入 */
export const MAX_CITY_DEVIATION_KM = 80;

export interface CoordinateHit {
  lat: number;
  lng: number;
  source: string;
}

/**
 * 导入期坐标补全：geocache → 本地字典 → 高德。
 * 只有小区级命中才写回缓存，区级中心坐标不能被别的小区继承。
 */
export async function resolveImportCoordinates(params: {
  listings: Record<string, any>[];
  city: string;
  capturedAt: string;
}): Promise<{ geocacheOrDict: number; amap: number; unresolved: number }> {
  const { listings, city, capturedAt } = params;
  const geocache = readGeocache();
  const center = cityCenterOf(city);
  /** 范围校验：地址里的 "北京路/上海路" 会误命中同名城市，越界一律不算命中 */
  const withinCity = (c: { lat: number; lng: number }) =>
    !center || distanceKm(c, center) <= MAX_CITY_DEVIATION_KM;
  let geocacheHits = 0;
  let amapHits = 0;

  for (const l of listings) {
    const community: string = l.community || '';
    const district: string = (l.address || '').split(' ')[0] || '';

    const cached = geocache[community];
    if (cached && cached.lat && cached.lng) {
      if (withinCity(cached)) {
        l.coordinates = { lat: cached.lat, lng: cached.lng };
        l.coordinateSource = cached.source;
        geocacheHits++;
        continue;
      }
      // 越界的缓存条目是被街道名污染的历史数据，直接剔除后重新解析
      delete geocache[community];
    }

    const dictHit = resolveDictCoordinates(community, district, { cityCenter: center });
    if (dictHit) {
      l.coordinates = { lat: dictHit.lat, lng: dictHit.lng };
      l.coordinateSource = 'local_dict';
      if (community && dictHit.level === 'community') {
        geocache[community] = {
          lat: dictHit.lat,
          lng: dictHit.lng,
          source: 'local_dict',
          resolvedAt: capturedAt,
        };
      }
      geocacheHits++;
      continue;
    }

    const geo = await geocodeViaAmap(`${city} ${district} ${community}`, city);
    if (geo && withinCity(geo)) {
      l.coordinates = geo;
      l.coordinateSource = 'amap';
      geocache[community] = { ...geo, source: 'amap', resolvedAt: capturedAt };
      amapHits++;
    }
    // 未命中：coordinates 保持 undefined，地图链路诚实回退
  }

  writeGeocache(geocache);

  return {
    geocacheOrDict: geocacheHits,
    amap: amapHits,
    unresolved: listings.length - geocacheHits - amapHits,
  };
}

export type GeocodeResult =
  | { available: true; coordinates: { lat: number; lng: number }; level: string }
  | { available: false; reason: string };

/**
 * 单地址地理编码（对外 /api/geocode-address）。结果写回 geocache，
 * 让导入期与运行期共享同一份坐标出处。
 */
export async function geocodeAddress(
  address: string,
  city: string
): Promise<GeocodeResult> {
  const clean = String(address || '').trim();
  if (!clean) return { available: false, reason: '缺少地址' };
  if (!amapKey()) {
    return {
      available: false,
      reason: `未配置 AMAP_KEY，无法进行真实地理编码。${AMAP_KEY_MISSING_HINT}`,
    };
  }

  try {
    const geo = await geocodeViaAmap(clean, city);
    if (!geo) {
      return { available: false, reason: '高德未能定位该地址' };
    }
    const geocache = readGeocache();
    if (!geocache[clean]) {
      geocache[clean] = {
        lat: geo.lat,
        lng: geo.lng,
        source: 'amap',
        resolvedAt: new Date().toISOString().slice(0, 10),
      };
      writeGeocache(geocache);
    }
    return { available: true, coordinates: geo, level: 'amap' };
  } catch (err: any) {
    console.warn('geocode failed:', err?.message || err);
    return { available: false, reason: '地理编码请求失败（网络或服务异常）' };
  }
}

/**
 * 批量地理编码：按查询串归并去重，同一小区/地址只打一次网络请求。
 * 返回 query -> 坐标（未命中不出现在结果里）。
 */
export async function geocodeMany(
  queries: string[],
  city: string,
  concurrency = 4
): Promise<Map<string, CoordinateHit>> {
  const unique = [...new Set(queries.filter((q) => q && q.trim()))];
  const result = new Map<string, CoordinateHit>();
  if (unique.length === 0 || !amapKey()) return result;

  // 命中回写 geocache：与导入期/单地址解析共享同一份坐标出处，
  // 避免通勤批量每跑一次就对同一批地址重复打高德
  const geocache = readGeocache();
  const resolvedAt = new Date().toISOString().slice(0, 10);
  let cacheDirty = false;

  const queue = [...unique];
  const worker = async () => {
    while (queue.length > 0) {
      const q = queue.shift()!;
      const geo = await geocodeViaAmap(q, city);
      if (geo) {
        result.set(q, { ...geo, source: 'amap' });
        if (!geocache[q]) {
          geocache[q] = { ...geo, source: 'amap', resolvedAt };
          cacheDirty = true;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
  if (cacheDirty) writeGeocache(geocache);
  return result;
}
