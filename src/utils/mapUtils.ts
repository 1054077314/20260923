// Utility functions and city coordinates for map views (radar isochrone + Amap route data)
import { CITY_COORDS } from '../data/cityCoordinates.js';

export interface LatLng {
  lat: number;
  lng: number;
}

// 统一城市坐标底表（与服务端 server/cityDict.ts 共用同一来源，数值一致）
export const CITY_COORDINATES: Record<string, LatLng> = CITY_COORDS;

/**
 * Get coordinates for a given city string with fallback
 */
export function getCityCenter(cityStr: string): LatLng {
  if (!cityStr) return CITY_COORDINATES['乌鲁木齐'];
  const cleanCity = cityStr.trim();
  if (CITY_COORDINATES[cleanCity]) {
    return CITY_COORDINATES[cleanCity];
  }
  // Try matching without '市' or with '市'
  const altCity = cleanCity.endsWith('市') ? cleanCity.slice(0, -1) : cleanCity + '市';
  if (CITY_COORDINATES[altCity]) {
    return CITY_COORDINATES[altCity];
  }
  // Search partial matches
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (cleanCity.includes(key) || key.includes(cleanCity)) {
      return coords;
    }
  }
  // If cityStr mentions 乌鲁木齐 or 新疆
  if (cleanCity.includes('乌鲁木齐') || cleanCity.includes('新疆') || cleanCity.includes('乌市')) {
    return CITY_COORDINATES['乌鲁木齐'];
  }
  return CITY_COORDINATES['乌鲁木齐'];
}


/**
 * 坐标唯一口径：只承认随房源带入的显式真实坐标（含来源标记）。
 * 字典匹配与城市中心兜底已删除——解析不出就是没有，不造坐标。
 */
export function getExplicitCoordinates(cand: {
  coordinates?: { lat: number; lng: number } | null;
}): LatLng | null {
  if (
    cand.coordinates &&
    typeof cand.coordinates.lat === 'number' &&
    typeof cand.coordinates.lng === 'number'
  ) {
    return { lat: cand.coordinates.lat, lng: cand.coordinates.lng };
  }
  return null;
}

export type TransitMode = 'subway' | 'bike' | 'car';

let amapLoaderPromise: Promise<void> | null = null;

/**
 * 动态加载高德 JS API（1.4.15，无需安全密钥）。
 * 失败/超时 reject，由调用方回落雷达视图；同一会话只加载一次。
 */
export function loadAmapSdk(apiKey: string, timeoutMs = 8000): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).AMap?.Map) return Promise.resolve();
  if (amapLoaderPromise) return amapLoaderPromise;

  amapLoaderPromise = new Promise<void>((resolve, reject) => {
    const callbackName = `__amapInit_${Date.now()}`;
    let timer: any = null;

    (window as any)[callbackName] = () => {
      clearTimeout(timer);
      delete (window as any)[callbackName];
      if ((window as any).AMap?.Map) {
        resolve();
      } else {
        amapLoaderPromise = null;
        reject(new Error('高德 JS API 加载后不可用'));
      }
    };

    timer = setTimeout(() => {
      delete (window as any)[callbackName];
      amapLoaderPromise = null;
      reject(new Error('高德 JS API 加载超时'));
    }, timeoutMs);

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=1.4.15&key=${encodeURIComponent(
      apiKey
    )}&callback=${callbackName}`;
    script.async = true;
    script.onerror = () => {
      clearTimeout(timer);
      delete (window as any)[callbackName];
      amapLoaderPromise = null;
      reject(new Error('高德 JS API 脚本加载失败'));
    };

    document.head.appendChild(script);
  });

  return amapLoaderPromise;
}

/**
 * Calculate approximate commute reach radius in meters based on transit mode and minutes
 */
export function calculateCommuteRadiusMeters(
  commuteMinutes: number,
  transitMode: TransitMode = 'subway'
): number {
  const speedsKmh: Record<TransitMode, number> = {
    subway: 24, // 地铁+接驳平均车速 ~24km/h
    bike: 14,   // 骑行/共享单车 ~14km/h
    car: 30,    // 打车/自驾市内 ~30km/h
  };
  const kmh = speedsKmh[transitMode] || 24;
  const radiusKm = (commuteMinutes / 60) * kmh;
  return Math.round(radiusKm * 1000);
}
