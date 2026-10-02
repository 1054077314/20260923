/**
 * 通勤数据的唯一来源：工作地定位一次 + 整批房源一次提交 /api/commute-batch。
 *
 * 服务端做地址归并去重 + 缓存复用 + 并发限流，前端只做结果映射。
 * 无真实结果一律标记 unavailable，绝不返回估算值。
 *
 * 80km 校验：显式坐标与计划城市中心距离超限视为无效，由服务端重新地理编码。
 */

import { useEffect, useRef, useState } from 'react';
import { CandidateProperty } from '../types/rental';
import { getCityCenter, getExplicitCoordinates, LatLng, TransitMode } from './mapUtils';
import { RouteInfo, WorkplaceState } from './commuteStats';

const MAX_COORD_DISTANCE_KM = 80;

// 工作地定位缓存（模块级，切模式/切页不重复付费）
const workplaceCache = new Map<string, LatLng | null>();
const workplaceInflight = new Map<string, Promise<LatLng | null>>();

interface BatchRoutePayload {
  state: 'ok' | 'unavailable';
  minutes?: number;
  distanceMeters?: number;
  segments?: any[];
  reason?: string;
}

function postJson(url: string, body: any): Promise<any> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then((res) => res.json());
}

function geocodeWorkplace(workplace: string, city: string): Promise<LatLng | null> {
  const key = `${city}|${workplace}`;
  if (workplaceCache.has(key)) return Promise.resolve(workplaceCache.get(key)!);
  if (workplaceInflight.has(key)) return workplaceInflight.get(key)!;
  const p = postJson('/api/geocode-address', { address: `${city} ${workplace}`, city })
    .then((g) => {
      const coord: LatLng | null = g?.available && g?.coordinates ? g.coordinates : null;
      // 只缓存命中：失败多为瞬时故障/后补 key，缓存 null 会让本会话永不再重试
      if (coord) workplaceCache.set(key, coord);
      return coord;
    })
    .catch(() => null)
    .finally(() => workplaceInflight.delete(key));
  workplaceInflight.set(key, p);
  return p;
}

export interface UseCommuteRoutesResult {
  workplaceState: WorkplaceState;
  routeInfo: Record<string, RouteInfo>;
}

export function useCommuteRoutes(params: {
  candidates: CandidateProperty[];
  city: string;
  workplace: string;
  transitMode: TransitMode;
}): UseCommuteRoutesResult {
  const { candidates, city, workplace, transitMode } = params;
  const [workplaceState, setWorkplaceState] = useState<WorkplaceState>({ status: 'loading' });
  const [routeInfo, setRouteInfo] = useState<Record<string, RouteInfo>>({});
  const tokenRef = useRef(0);

  const candidatesKey = candidates
    .map((c) => `${c.id}:${c.coordinates?.lat ?? ''},${c.coordinates?.lng ?? ''}`)
    .join('|');

  useEffect(() => {
    const token = ++tokenRef.current;

    const run = async () => {
      setRouteInfo({});
      setWorkplaceState({ status: 'loading' });

      // 1. 工作地定位一次
      let wCoord: LatLng | null = null;
      if (workplace && workplace.trim()) {
        wCoord = await geocodeWorkplace(workplace.trim(), city);
        if (token !== tokenRef.current) return;
        setWorkplaceState(
          wCoord ? { status: 'ok', coord: wCoord } : { status: 'unavailable', reason: '定位失败' }
        );
      } else if (token === tokenRef.current) {
        setWorkplaceState({ status: 'unavailable', reason: '未填写工作地 / 目标商圈' });
      }
      if (token !== tokenRef.current) return;

      if (candidates.length === 0) return;

      if (!wCoord) {
        const next: Record<string, RouteInfo> = {};
        for (const c of candidates) {
          next[c.id] = { state: 'unavailable', reason: '工作地定位不可用，无法计算真实路线' };
        }
        setRouteInfo(next);
        return;
      }

      // 2. 组装整批 items：合法显式坐标直接带（80km 外视为无效，不带坐标让服务端重编码）
      const center = getCityCenter(city);
      const items = candidates.map((c) => {
        let coord = getExplicitCoordinates(c);
        if (coord) {
          const dLat = coord.lat - center.lat;
          const dLng = (coord.lng - center.lng) * Math.cos((center.lat * Math.PI) / 180);
          if (Math.sqrt(dLat * dLat + dLng * dLng) * 111 > MAX_COORD_DISTANCE_KM) coord = null;
        }
        return {
          id: c.id,
          lat: coord?.lat,
          lng: coord?.lng,
          community: c.community || c.address || '',
          address: c.address || c.community || '',
        };
      });

      // 3. 一次提交，分片上限 200（与服务端 slice 对齐）。
      // 批量在途先全部标记 loading：首次现算约 1-2 分钟，界面显示「测算中」而不是误导性的 0
      const pending: Record<string, RouteInfo> = {};
      for (const c of candidates) pending[c.id] = { state: 'loading' };
      setRouteInfo(pending);

      const next: Record<string, RouteInfo> = {};
      try {
        for (let i = 0; i < items.length; i += 200) {
          const chunk = items.slice(i, i + 200);
          const resp = await postJson('/api/commute-batch', {
            to: wCoord,
            mode: transitMode,
            city,
            detail: true,
            items: chunk,
          });
          if (token !== tokenRef.current) return;
          const routes: Record<string, BatchRoutePayload> = resp?.routes || {};
          for (const c of chunk) {
            const r = routes[c.id];
            next[c.id] =
              r && r.state === 'ok'
                ? { state: 'ok', minutes: r.minutes, distanceMeters: r.distanceMeters, segments: r.segments }
                : { state: 'unavailable', reason: r?.reason || '真实路线不可用' };
          }
        }
      } catch {
        for (const c of candidates) {
          if (!next[c.id]) next[c.id] = { state: 'unavailable', reason: '批量通勤服务请求失败' };
        }
      }
      if (token === tokenRef.current) setRouteInfo(next);
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workplace, city, transitMode, candidatesKey]);

  return { workplaceState, routeInfo };
}
