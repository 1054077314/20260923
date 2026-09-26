// 服务端城市坐标字典：唯一来源为 src/data/cityCoordinates.ts（与前端 mapUtils 共用同一底表）。
// 原 server.ts 内联 LOCAL_COORDINATES / CITY_TO_58_CODE 已整体迁移至此，数值与键保持不变。

import { CITY_COORDS } from '../src/data/cityCoordinates.js';

/** 兼容旧名：原 server.ts 内的 LOCAL_COORDINATES 即统一底表本身 */
export const LOCAL_COORDINATES = CITY_COORDS;

export const CITY_TO_58_CODE: Record<string, string> = {
  杭州: 'hz',
  杭州市: 'hz',
  hz: 'hz',
  上海: 'sh',
  上海市: 'sh',
  sh: 'sh',
  北京: 'bj',
  北京市: 'bj',
  bj: 'bj',
  深圳: 'sz',
  深圳市: 'sz',
  sz: 'sz',
  广州: 'gz',
  广州市: 'gz',
  gz: 'gz',
  成都: 'cd',
  成都市: 'cd',
  cd: 'cd',
  武汉: 'wh',
  武汉市: 'wh',
  wh: 'wh',
  南京: 'nj',
  南京市: 'nj',
  nj: 'nj',
  苏州: 'su',
  苏州市: 'su',
  su: 'su',
  西安: 'xa',
  西安市: 'xa',
  xa: 'xa',
  重庆: 'cq',
  重庆市: 'cq',
  cq: 'cq',
  天津: 'tj',
  天津市: 'tj',
  tj: 'tj',
  长沙: 'cs',
  长沙市: 'cs',
  cs: 'cs',
  青岛: 'qd',
  青岛市: 'qd',
  qd: 'qd',
  郑州: 'zz',
  郑州市: 'zz',
  zz: 'zz',
  合肥: 'hf',
  合肥市: 'hf',
  hf: 'hf',
  厦门: 'xm',
  厦门市: 'xm',
  xm: 'xm',
  宁波: 'nb',
  宁波市: 'nb',
  nb: 'nb',
  乌鲁木齐: 'xj',
  乌鲁木齐市: 'xj',
  xj: 'xj',
  wlmq: 'xj',
};

/**
 * Deterministically resolve coordinate for 58 listings without random scattering.
 * Priority: explicit 58 page coordinates -> local community match -> local district match -> local city match
 */
export function resolveListingCoordinates(
  city: string,
  district: string,
  community: string,
  pageCoords?: { lat: number; lng: number }
): { lat: number; lng: number } {
  if (
    pageCoords &&
    typeof pageCoords.lat === 'number' &&
    typeof pageCoords.lng === 'number' &&
    !isNaN(pageCoords.lat) &&
    !isNaN(pageCoords.lng) &&
    pageCoords.lat > 0 &&
    pageCoords.lng > 0
  ) {
    return pageCoords;
  }

  // Check community match
  if (community) {
    for (const [key, coords] of Object.entries(LOCAL_COORDINATES)) {
      if (community.includes(key) || key.includes(community)) {
        return coords;
      }
    }
  }

  // Check district match
  if (district) {
    for (const [key, coords] of Object.entries(LOCAL_COORDINATES)) {
      if (district.includes(key) || key.includes(district)) {
        return coords;
      }
    }
  }

  // Check city match
  if (city) {
    for (const [key, coords] of Object.entries(LOCAL_COORDINATES)) {
      if (city.includes(key) || key.includes(city)) {
        return coords;
      }
    }
  }

  return { lat: 30.2741, lng: 120.1551 };
}

/** 两点球面近似距离（km），用于校验解析结果是否落在目标城市范围内 */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = a.lat - b.lat;
  const dLng = (a.lng - b.lng) * Math.cos((b.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111;
}

/** 城市中心坐标：命中不到时返回 null（不猜） */
export function cityCenterOf(city: string): { lat: number; lng: number } | null {
  const key = String(city || '').trim();
  if (!key) return null;
  const direct = LOCAL_COORDINATES[key];
  if (direct) return direct;
  const alt = key.endsWith('市') ? key.slice(0, -1) : key + '市';
  if (LOCAL_COORDINATES[alt]) return LOCAL_COORDINATES[alt];
  for (const [name, coords] of Object.entries(LOCAL_COORDINATES)) {
    if (key.includes(name) || name.includes(key)) return coords;
  }
  return null;
}

export interface DictResolveOptions {
  /** 目标城市中心，提供后用于范围校验 */
  cityCenter?: { lat: number; lng: number } | null;
  /** 允许的最大偏离距离（km），默认 80 */
  maxKm?: number;
}

/**
 * Dictionary-only coordinate resolution: community first, then district.
 * Returns null when nothing matches - city-center fallback is NOT written into
 * listings so the map chain keeps honest behavior (undefined -> city center).
 *
 * 注意：地址里出现 "北京路 / 上海路" 这类街道名会误命中同名城市，
 * 因此只要提供了 cityCenter，命中结果必须落在范围内才算数。
 */
export function resolveDictCoordinates(
  community: string,
  district: string,
  options: DictResolveOptions = {}
): { lat: number; lng: number; level: 'community' | 'district' } | null {
  const center = options.cityCenter;
  const maxKm = options.maxKm ?? 80;
  const withinCity = (coords: { lat: number; lng: number }) =>
    !center || distanceKm(coords, center) <= maxKm;

  if (community) {
    for (const [key, coords] of Object.entries(LOCAL_COORDINATES)) {
      if (community.includes(key) || key.includes(community)) {
        if (key !== '乌鲁木齐' && key !== '乌鲁木齐市' && key !== '新疆') {
          if (withinCity(coords)) return { ...coords, level: 'community' };
        }
      }
    }
  }
  if (district) {
    for (const [key, coords] of Object.entries(LOCAL_COORDINATES)) {
      if (district.includes(key) || key.includes(district)) {
        if (withinCity(coords)) return { ...coords, level: 'district' };
      }
    }
  }
  return null;
}
