// 真实路线规划：原 server.ts 内 route-cache 读写 / AMap transit+walk 分段解析 / 按 mode 解析耗时原样迁移。
// 诚实契约：无 key / 网络异常 / 解析失败一律 available:false，绝不返回估算值。

import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from './config.js';

const ROUTE_CACHE_PATH = path.resolve(PROJECT_ROOT, 'data-route-cache.json');

export type RouteCacheEntry = { minutes: number; distanceMeters: number; cachedAt: number; segments?: any[] };

export const ROUTE_CACHE_TTL_MS = 24 * 3600 * 1000;

// 批量通勤会按条数反复读缓存，9.7MB 文件逐条 JSON.parse 不可接受：
// 内存驻留一份，按 mtime 失效（外部采集/导入改写文件后自动重载）
let memoCache: Record<string, RouteCacheEntry> | null = null;
let memoMtimeMs = 0;

export function readRouteCache(): Record<string, RouteCacheEntry> {
  try {
    const mtimeMs = fs.statSync(ROUTE_CACHE_PATH).mtimeMs;
    if (memoCache && mtimeMs === memoMtimeMs) return memoCache;
    const parsed = JSON.parse(fs.readFileSync(ROUTE_CACHE_PATH, 'utf-8'));
    memoCache = parsed;
    memoMtimeMs = mtimeMs;
    return parsed;
  } catch {
    return memoCache ?? {};
  }
}

export function writeRouteCache(cache: Record<string, RouteCacheEntry>) {
  try {
    // 写盘顺带清掉过期条目：readCache 里 TTL 已判死，留着只会把文件越撑越大
    const now = Date.now();
    const pruned: Record<string, RouteCacheEntry> = {};
    for (const [k, v] of Object.entries(cache)) {
      if (v && typeof v.cachedAt === 'number' && now - v.cachedAt < ROUTE_CACHE_TTL_MS) {
        pruned[k] = v;
      }
    }
    // 先写临时文件再 rename：13MB 文件写一半进程被杀不会留下半个 JSON
    const tmp = `${ROUTE_CACHE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(pruned, null, 1), 'utf-8');
    fs.renameSync(tmp, ROUTE_CACHE_PATH);
    memoCache = pruned;
    memoMtimeMs = fs.statSync(ROUTE_CACHE_PATH).mtimeMs;
  } catch (e: any) {
    console.warn('route cache write failed:', e?.message || e);
  }
}

export const AMAP_MODE_ENDPOINTS: Record<string, string> = {
  subway: 'https://restapi.amap.com/v3/direction/transit/integrated',
  bike: 'https://restapi.amap.com/v4/direction/bicycling',
  car: 'https://restapi.amap.com/v3/direction/driving',
};

export async function amapFetchJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extracts the fastest AMap transit itinerary into renderable segments:
 * walk legs (polyline pts) and bus legs (line name, boarding/alighting stops).
 * Returns null when the response has no usable itinerary — honest failure.
 */
export function parseAmapTransitSegments(data: any): any[] | null {
  try {
    const transits = data?.route?.transits;
    if (!Array.isArray(transits) || transits.length === 0) return null;
    const best = transits
      .filter((t: any) => Number(t?.duration) > 0)
      .sort((a: any, b: any) => Number(a.duration) - Number(b.duration))[0];
    if (!best?.segments) return null;

    const toPts = (polyline: string): [number, number][] =>
      String(polyline || '')
        .split(';')
        .filter(Boolean)
        .map((pair) => {
          const [lng, lat] = pair.split(',').map(Number);
          return [lng, lat] as [number, number];
        })
        .filter((p) => !isNaN(p[0]) && !isNaN(p[1]));

    const segments: any[] = [];
    for (const seg of best.segments) {
      const w = seg?.walking;
      if (w?.steps?.length) {
        const pts = w.steps.flatMap((s: any) => toPts(s?.polyline));
        if (pts.length >= 2) {
          segments.push({
            type: 'walk',
            minutes: Math.round(Number(w.duration || 0) / 60),
            distanceMeters: Math.round(Number(w.distance || 0)),
            points: pts,
          });
        }
      }
      const bus = seg?.bus?.buslines?.[0];
      if (bus?.polyline) {
        const pts = toPts(bus.polyline);
        if (pts.length >= 2) {
          segments.push({
            type: 'bus',
            minutes: Math.round(Number(bus.duration || 0) / 60),
            distanceMeters: Math.round(Number(bus.distance || 0)),
            lineName: bus.name || '',
            boardingStop: bus.departure_stop?.name || '',
            alightingStop: bus.arrival_stop?.name || '',
            viaStops: Number(bus.via_num || 0),
            points: pts,
          });
        }
      }
    }
    return segments.length > 0 ? segments : null;
  } catch {
    return null;
  }
}

/**
 * Parses AMap route responses per mode into { minutes, distanceMeters }.
 * Returns null on any unexpected shape — caller reports unavailable honestly.
 */
export function parseAmapRoute(mode: string, data: any): { minutes: number; distanceMeters: number } | null {
  try {
    if (mode === 'bike') {
      // v4: { errcode:0, data:{ paths:[{ duration(秒), distance(米) }] } }
      if (data?.errcode !== 0) return null;
      const p = data?.data?.paths?.[0];
      if (!p || p.duration == null) return null;
      return { minutes: Math.round(Number(p.duration) / 60), distanceMeters: Math.round(Number(p.distance || 0)) };
    }
    // v3: { status:'1', route:{ transits|paths } }
    if (data?.status !== '1') return null;
    if (mode === 'subway') {
      const transits = data?.route?.transits;
      if (!Array.isArray(transits) || transits.length === 0) return null;
      const durations = transits.map((t: any) => Number(t?.duration)).filter((n: number) => !isNaN(n) && n > 0);
      if (durations.length === 0) return null;
      const seconds = Math.min(...durations);
      return { minutes: Math.round(seconds / 60), distanceMeters: Math.round(Number(data?.route?.distance || 0)) };
    }
    const p = data?.route?.paths?.[0];
    if (!p || p.duration == null) return null;
    return { minutes: Math.round(Number(p.duration) / 60), distanceMeters: Math.round(Number(p.distance || 0)) };
  } catch {
    return null;
  }
}
