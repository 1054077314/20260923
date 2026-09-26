// Utility functions and city coordinates for Google Maps integration
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

let cachedApiKey: string | null = null;

/**
 * Fetch Google Maps Platform API Key
 */
export async function getGoogleMapsApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;
  const envKey =
    (import.meta as any).env?.VITE_GEMINI_PUBLIC_MAPS_API_KEY ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (envKey && envKey !== 'MY_GOOGLE_MAPS_API_KEY') {
    cachedApiKey = envKey;
    return envKey;
  }
  try {
    const res = await fetch('/api/maps-key');
    const data = await res.json();
    if (data.apiKey) {
      cachedApiKey = data.apiKey;
      return data.apiKey;
    }
  } catch (err) {
    console.warn('Failed to fetch maps key from backend:', err);
  }
  return 'AIzaSyBIoomGq3PNyW2WrvhwyKagxUkU-NxuTRE';
}

let loaderPromise: Promise<void> | null = null;
let authFailureListeners: Array<() => void> = [];

/**
 * Listen for Google Maps gm_authFailure to gracefully switch to local Radar Map
 */
export function onGoogleMapsAuthFailure(callback: () => void): () => void {
  authFailureListeners.push(callback);
  return () => {
    authFailureListeners = authFailureListeners.filter((cb) => cb !== callback);
  };
}

if (typeof window !== 'undefined') {
  const originalAuthFailure = (window as any).gm_authFailure;
  (window as any).gm_authFailure = () => {
    console.warn('Google Maps 授权失败 (gm_authFailure)，启用本地高精度雷达等时圈');
    if (typeof originalAuthFailure === 'function') originalAuthFailure();
    authFailureListeners.forEach((cb) => {
      try {
        cb();
      } catch {}
    });
  };
}

/**
 * Dynamically load Google Maps JavaScript API with clean callback, timeout and graceful error handling
 */
export function loadGoogleMapsSdk(apiKey: string, timeoutMs = 6000): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.maps?.Map) {
    return Promise.resolve();
  }
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    // If google.maps is already available
    if ((window as any).google?.maps?.Map) {
      resolve();
      return;
    }

    const callbackName = `__googleMapsInit_${Date.now()}`;
    let timer: any = null;

    (window as any)[callbackName] = () => {
      clearTimeout(timer);
      delete (window as any)[callbackName];
      resolve();
    };

    timer = setTimeout(() => {
      delete (window as any)[callbackName];
      loaderPromise = null;
      reject(new Error('Google Maps 加载超时，已自动启用城市高精度地理坐标拓扑视图'));
    }, timeoutMs);

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      apiKey
    )}&libraries=places&callback=${callbackName}&language=zh-CN`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      clearTimeout(timer);
      delete (window as any)[callbackName];
      loaderPromise = null;
      reject(new Error('Google Maps 脚本网络访问受限，已自动启用城市高精度地理坐标拓扑视图'));
    };

    document.head.appendChild(script);
  });

  return loaderPromise;
}
