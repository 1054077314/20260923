/**
 * 通勤数据的唯一口径：真实路线结果 → 单程/往返/全年耗时与票价。
 *
 * 耗时只承认运行时真实路线规划（高德）结果，拿不到就是 null（界面显示不可用），
 * 任何组件都不得用估算值兜底。全年耗时/票价公式也集中在这里，避免各处各算一套。
 */

import { CandidateProperty } from '../types/rental';
import { LatLng } from './mapUtils';

export interface RouteInfo {
  state: 'loading' | 'ok' | 'unavailable';
  minutes?: number;
  distanceMeters?: number;
  reason?: string;
  segments?: any[];
}

export interface WorkplaceState {
  status: 'loading' | 'ok' | 'unavailable';
  coord?: LatLng;
  reason?: string;
}

export interface CandidateCommuteStat extends CandidateProperty {
  oneWayMin: number | null;
  roundTripMin: number | null;
  annualHours: number | null;
  annualFare: number | null;
  walkMin: number | null;
  routeState: RouteInfo['state'];
  routeReason?: string;
  segments?: any[];
}

/** 真实路线耗时（分钟）；加载中或不可用返回 null */
export function getRouteMinutes(
  routeInfo: Record<string, RouteInfo>,
  candidateId: string
): number | null {
  const route = routeInfo[candidateId];
  return route?.state === 'ok' && typeof route.minutes === 'number' ? route.minutes : null;
}

export interface CommuteStatsOptions {
  workDaysPerWeek: number;
  farePerTrip: number;
  workWeeksPerYear?: number;
}

export const WORK_WEEKS_PER_YEAR = 50;

/** 舒适通勤阈值：上限的 65%，夹在 15~25 分钟之间（与地图一致） */
export function comfortableMinutesForLimit(maxCommuteMinutes: number): number {
  return Math.max(15, Math.round(Math.min(25, maxCommuteMinutes * 0.65)));
}

export interface EnrichedCommuteCandidate extends CandidateCommuteStat {
  resolvedCoords: LatLng;
  commuteMin: number | null;
  isComfortable: boolean;
  isWithinLimit: boolean;
  overMinutes: number;
}

export interface CommuteCoverageStats {
  total: number;
  withinCount: number;
  comfortableCount: number;
  overCount: number;
  avgMinutes: number | null;
  noCoordCount: number;
}

/**
 * 地图富化（轻量入口）：地图只拿到原始候选 + 真实路线分钟数时，
 * 在这里拼成统计口径一致的富化列表，不在组件里另算一套。
 */
export function enrichListingsForMap(
  candidates: CandidateProperty[],
  routeMinutes: Record<string, number | null | undefined>,
  maxCommuteMinutes: number
): { plotted: EnrichedCommuteCandidate[]; coverage: CommuteCoverageStats } {
  const stats: CandidateCommuteStat[] = candidates.map((c) => {
    const oneWayMin = routeMinutes[c.id] ?? null;
    return {
      ...c,
      oneWayMin,
      roundTripMin: oneWayMin != null ? oneWayMin * 2 : null,
      annualHours: null,
      annualFare: null,
      walkMin: c.walkToSubwayMin ?? null,
      routeState: oneWayMin != null ? 'ok' : 'unavailable',
    };
  });
  return enrichCandidatesForMap(stats, maxCommuteMinutes);
}
export function enrichCandidatesForMap(
  stats: CandidateCommuteStat[],
  maxCommuteMinutes: number
): { plotted: EnrichedCommuteCandidate[]; coverage: CommuteCoverageStats } {
  const comfortableMinutes = comfortableMinutesForLimit(maxCommuteMinutes);
  const noCoordCount = stats.filter(
    (c) => !c.coordinates || typeof c.coordinates.lat !== 'number' || typeof c.coordinates.lng !== 'number'
  ).length;

  const plotted: EnrichedCommuteCandidate[] = [];
  for (const cand of stats) {
    const c = cand.coordinates;
    if (!c || typeof c.lat !== 'number' || typeof c.lng !== 'number') continue;
    const commuteMin = cand.oneWayMin;
    plotted.push({
      ...cand,
      resolvedCoords: c,
      commuteMin,
      isComfortable: commuteMin != null && commuteMin <= comfortableMinutes,
      isWithinLimit: commuteMin != null && commuteMin <= maxCommuteMinutes,
      overMinutes: commuteMin != null && commuteMin > maxCommuteMinutes ? commuteMin - maxCommuteMinutes : 0,
    });
  }

  const withinCount = plotted.filter((c) => c.isWithinLimit).length;
  const comfortableCount = plotted.filter((c) => c.isComfortable).length;
  const withMinutes = plotted.filter((c) => c.commuteMin != null);
  const avgMinutes =
    withMinutes.length > 0
      ? Math.round(withMinutes.reduce((acc, c) => acc + (c.commuteMin || 0), 0) / withMinutes.length)
      : null;

  return {
    plotted,
    coverage: {
      total: plotted.length,
      withinCount,
      comfortableCount,
      overCount: plotted.length - withinCount,
      avgMinutes,
      noCoordCount,
    },
  };
}

/** 单程耗时 → 全年往返累耗（小时）；拿不到真实耗时返回 null */
export function annualHoursFromOneWay(
  oneWayMin: number | null | undefined,
  workDaysPerWeek: number,
  workWeeksPerYear: number = WORK_WEEKS_PER_YEAR
): number | null {
  if (oneWayMin == null) return null;
  return Math.round(((oneWayMin * 2 * workDaysPerWeek * workWeeksPerYear) / 60));
}

export function computeCommuteStats(
  candidates: CandidateProperty[],
  routeInfo: Record<string, RouteInfo>,
  options: CommuteStatsOptions
): CandidateCommuteStat[] {
  const { workDaysPerWeek, farePerTrip } = options;
  const workWeeksPerYear = options.workWeeksPerYear ?? 50;
  const annualWorkDays = workDaysPerWeek * workWeeksPerYear;

  return candidates.map((candidate) => {
    const route = routeInfo[candidate.id];
    const oneWayMin = getRouteMinutes(routeInfo, candidate.id);
    const roundTripMin = oneWayMin != null ? oneWayMin * 2 : null;
    const annualHours =
      roundTripMin != null ? Math.round((roundTripMin * annualWorkDays) / 60) : null;
    const annualFare = roundTripMin != null ? annualWorkDays * farePerTrip * 2 : null;

    return {
      ...candidate,
      oneWayMin,
      roundTripMin,
      annualHours,
      annualFare,
      walkMin: candidate.walkToSubwayMin ?? null,
      routeState: route?.state || 'loading',
      routeReason: route?.reason,
      segments: route?.segments,
    };
  });
}
