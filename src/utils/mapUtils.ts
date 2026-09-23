// Utility functions and city coordinates for Google Maps integration

export interface LatLng {
  lat: number;
  lng: number;
}

// Major cities coordinates dictionary
export const CITY_COORDINATES: Record<string, LatLng> = {
  杭州: { lat: 30.2741, lng: 120.1551 },
  杭州市: { lat: 30.2741, lng: 120.1551 },
  上海: { lat: 31.2304, lng: 121.4737 },
  上海市: { lat: 31.2304, lng: 121.4737 },
  北京: { lat: 39.9042, lng: 116.4074 },
  北京市: { lat: 39.9042, lng: 116.4074 },
  深圳: { lat: 22.5431, lng: 114.0579 },
  深圳市: { lat: 22.5431, lng: 114.0579 },
  广州: { lat: 23.1291, lng: 113.2644 },
  广州市: { lat: 23.1291, lng: 113.2644 },
  成都: { lat: 30.5728, lng: 104.0668 },
  成都市: { lat: 30.5728, lng: 104.0668 },
  武汉: { lat: 30.5928, lng: 114.3055 },
  武汉市: { lat: 30.5928, lng: 114.3055 },
  南京: { lat: 32.0603, lng: 118.7969 },
  南京市: { lat: 32.0603, lng: 118.7969 },
  苏州: { lat: 31.2989, lng: 120.5853 },
  苏州市: { lat: 31.2989, lng: 120.5853 },
  西安: { lat: 34.3416, lng: 108.9398 },
  西安市: { lat: 34.3416, lng: 108.9398 },
  重庆: { lat: 29.563, lng: 106.5516 },
  重庆市: { lat: 29.563, lng: 106.5516 },
  长沙: { lat: 28.2282, lng: 112.9388 },
  长沙市: { lat: 28.2282, lng: 112.9388 },
  天津: { lat: 39.0842, lng: 117.2009 },
  天津市: { lat: 39.0842, lng: 117.2009 },
  青岛: { lat: 36.0671, lng: 120.3826 },
  青岛市: { lat: 36.0671, lng: 120.3826 },
  郑州: { lat: 34.7466, lng: 113.6253 },
  郑州市: { lat: 34.7466, lng: 113.6253 },
  合肥: { lat: 31.8206, lng: 117.2272 },
  合肥市: { lat: 31.8206, lng: 117.2272 },
  厦门: { lat: 24.4798, lng: 118.0894 },
  厦门市: { lat: 24.4798, lng: 118.0894 },
  宁波: { lat: 29.8683, lng: 121.544 },
  宁波市: { lat: 29.8683, lng: 121.544 },
  东莞: { lat: 23.0205, lng: 113.7518 },
  东莞市: { lat: 23.0205, lng: 113.7518 },
  佛山: { lat: 23.0215, lng: 113.1214 },
  佛山市: { lat: 23.0215, lng: 113.1214 },
  无锡: { lat: 31.4912, lng: 120.3119 },
  无锡市: { lat: 31.4912, lng: 120.3119 },
  昆明: { lat: 25.0406, lng: 102.7123 },
  昆明市: { lat: 25.0406, lng: 102.7123 },
  沈阳: { lat: 41.8057, lng: 123.4315 },
  沈阳市: { lat: 41.8057, lng: 123.4315 },
  大连: { lat: 38.914, lng: 121.6147 },
  大连市: { lat: 38.914, lng: 121.6147 },
  济南: { lat: 36.6512, lng: 117.12 },
  济南市: { lat: 36.6512, lng: 117.12 },
};

/**
 * Get coordinates for a given city string with fallback
 */
export function getCityCenter(cityStr: string): LatLng {
  if (!cityStr) return CITY_COORDINATES['杭州'];
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
  return CITY_COORDINATES['杭州'];
}

/**
 * Deterministic pseudo-random offset based on string hash
 * Ensures candidate properties without explicit coordinates are neatly scattered around city center
 */
export function getCandidateApproxCoordinates(
  candidateId: string,
  cityCenter: LatLng,
  index = 0
): LatLng {
  let hash = 0;
  for (let i = 0; i < candidateId.length; i++) {
    hash = (hash << 5) - hash + candidateId.charCodeAt(i);
    hash |= 0;
  }
  // Generate radius between 0.008 and 0.038 degrees (~1km to ~4km)
  const angle = ((Math.abs(hash) % 360) + index * 60) * (Math.PI / 180);
  const radius = 0.012 + ((Math.abs(hash * 13) % 25) / 1000);
  return {
    lat: Number((cityCenter.lat + Math.sin(angle) * radius).toFixed(6)),
    lng: Number((cityCenter.lng + Math.cos(angle) * radius * 1.15).toFixed(6)),
  };
}

/**
 * Deterministically resolve workplace coordinate anchor relative to city
 */
export function getWorkplaceCoordinates(workplace: string, cityCenter: LatLng): LatLng {
  if (!workplace || !workplace.trim()) {
    // Default to city core CBD offset
    return {
      lat: Number((cityCenter.lat + 0.005).toFixed(6)),
      lng: Number((cityCenter.lng + 0.008).toFixed(6)),
    };
  }
  let hash = 0;
  for (let i = 0; i < workplace.length; i++) {
    hash = (hash << 5) - hash + workplace.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash) % 360) * (Math.PI / 180);
  const radius = 0.006 + ((Math.abs(hash * 7) % 15) / 1000);
  return {
    lat: Number((cityCenter.lat + Math.sin(angle) * radius).toFixed(6)),
    lng: Number((cityCenter.lng + Math.cos(angle) * radius * 1.1).toFixed(6)),
  };
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
  const envKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
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
    )}&libraries=places,marker&callback=${callbackName}&language=zh-CN`;
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
