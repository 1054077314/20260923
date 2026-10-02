// 地理编码：原 server.ts 内 geocache 读写 / resolveDictCoordinates(已归 cityDict) / geocodeViaAmap 原样迁移。
// 诚实契约：无 key / 网络异常 / 解析失败一律返回 null，绝不编造坐标。

import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from './config.js';

const GEOCACHE_PATH = path.resolve(PROJECT_ROOT, 'data-58-geocache.json');

export interface GeocacheEntry {
  lat: number;
  lng: number;
  source: string;
  resolvedAt: string;
}

export function geocachePath(): string {
  return GEOCACHE_PATH;
}

export function readGeocache(): Record<string, GeocacheEntry> {
  try {
    return JSON.parse(fs.readFileSync(GEOCACHE_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function writeGeocache(cache: Record<string, GeocacheEntry>) {
  try {
    const tmp = `${GEOCACHE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(cache, null, 1), 'utf-8');
    fs.renameSync(tmp, GEOCACHE_PATH);
  } catch (e: any) {
    console.warn('geocache write failed:', e?.message || e);
  }
}

/**
 * Optional AMap geocoding (used only when AMAP_KEY is configured). Honest: any
 * failure returns null and nothing is fabricated.
 */
export async function geocodeViaAmap(
  address: string,
  city?: string
): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.AMAP_KEY;
  if (!key) return null;
  const cityParam = city ? `&city=${encodeURIComponent(city)}` : '';
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(
      `https://restapi.amap.com/v3/geocode/geo?address=${encodeURIComponent(address)}${cityParam}&key=${key}`,
      { signal: ctrl.signal }
    );
    clearTimeout(timer);
    const data: any = await res.json();
    const loc = data?.geocodes?.[0]?.location;
    if (typeof loc !== 'string' || !loc.includes(',')) return null;
    const [lng, lat] = loc.split(',').map(Number);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
