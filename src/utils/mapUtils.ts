// Utility functions and city coordinates for Google Maps integration

export interface LatLng {
  lat: number;
  lng: number;
}

// Major cities coordinates dictionary
export const CITY_COORDINATES: Record<string, LatLng> = {
  // 新疆 · 乌鲁木齐及主要区域
  乌鲁木齐: { lat: 43.8256, lng: 87.6168 },
  乌鲁木齐市: { lat: 43.8256, lng: 87.6168 },
  新疆: { lat: 43.8256, lng: 87.6168 },
  天山区: { lat: 43.7936, lng: 87.6316 },
  沙依巴克区: { lat: 43.8016, lng: 87.5979 },
  新市区: { lat: 43.8569, lng: 87.5752 },
  高新区: { lat: 43.8569, lng: 87.5752 },
  水磨沟区: { lat: 43.8344, lng: 87.6433 },
  头屯河区: { lat: 43.8795, lng: 87.4278 },
  经开区: { lat: 43.8795, lng: 87.4278 },
  米东区: { lat: 43.9535, lng: 87.6853 },
  达坂城区: { lat: 43.3571, lng: 88.3094 },
  铁路局: { lat: 43.8688, lng: 87.5768 },
  友好商圈: { lat: 43.8182, lng: 87.5925 },
  大小西门: { lat: 43.7942, lng: 87.6152 },
  国际大巴扎: { lat: 43.7788, lng: 87.6366 },
  会展中心: { lat: 43.8645, lng: 87.6521 },

  // 主要一二线与省会城市
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
  兰州: { lat: 36.0611, lng: 103.8343 },
  兰州市: { lat: 36.0611, lng: 103.8343 },
  西宁: { lat: 36.6171, lng: 101.7782 },
  西宁市: { lat: 36.6171, lng: 101.7782 },
  银川: { lat: 38.4872, lng: 106.2309 },
  银川市: { lat: 38.4872, lng: 106.2309 },
  呼和浩特: { lat: 40.8415, lng: 111.7519 },
  呼和浩特市: { lat: 40.8415, lng: 111.7519 },
  哈尔滨: { lat: 45.8038, lng: 126.5349 },
  哈尔滨市: { lat: 45.8038, lng: 126.5349 },
  长春: { lat: 43.8171, lng: 125.3235 },
  长春市: { lat: 43.8171, lng: 125.3235 },
  石家庄: { lat: 38.0428, lng: 114.5149 },
  石家庄市: { lat: 38.0428, lng: 114.5149 },
  太原: { lat: 37.8706, lng: 112.5489 },
  太原市: { lat: 37.8706, lng: 112.5489 },
  南昌: { lat: 28.682, lng: 115.8579 },
  南昌市: { lat: 28.682, lng: 115.8579 },
  福州: { lat: 26.0745, lng: 119.2965 },
  福州市: { lat: 26.0745, lng: 119.2965 },
  贵阳: { lat: 26.647, lng: 106.6302 },
  贵阳市: { lat: 26.647, lng: 106.6302 },
  南宁: { lat: 22.817, lng: 108.3665 },
  南宁市: { lat: 22.817, lng: 108.3665 },
  海口: { lat: 20.044, lng: 110.1999 },
  海口市: { lat: 20.044, lng: 110.1999 },
  三亚: { lat: 18.2528, lng: 109.5119 },
  三亚市: { lat: 18.2528, lng: 109.5119 },
  拉萨: { lat: 29.6469, lng: 91.1172 },
  拉萨市: { lat: 29.6469, lng: 91.1172 },
};

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
 * Safely resolve candidate coordinates relative to the target city.
 * If candidate has coordinates from a different city (>80km away),
 * re-anchors to current city center so pins don't fly thousands of kilometers away.
 */
export function getCandidateCoordsForCity(
  candidate: { id: string; coordinates?: LatLng },
  cityCenter: LatLng,
  index = 0
): LatLng {
  if (candidate.coordinates && candidate.coordinates.lat && candidate.coordinates.lng) {
    const latDiff = Math.abs(candidate.coordinates.lat - cityCenter.lat);
    const lngDiff = Math.abs(candidate.coordinates.lng - cityCenter.lng);
    // If within ~0.8 deg lat (~90km), preserve explicit coordinates
    if (latDiff < 0.8 && lngDiff < 1.0) {
      return candidate.coordinates;
    }
  }
  return getCandidateApproxCoordinates(candidate.id, cityCenter, index);
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
  // Check if workplace directly contains a known district, landmark or area
  const cleanWp = workplace.trim();
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    if (cleanWp.includes(key)) {
      return coords;
    }
  }
  let hash = 0;
  for (let i = 0; i < cleanWp.length; i++) {
    hash = (hash << 5) - hash + cleanWp.charCodeAt(i);
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
