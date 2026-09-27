/**
 * 快照候选池的唯一入口：拉快照 → 转 Candidate → 按预算合并去重。
 * CommuteModule 与任何需要“全部真实房源池”的组件都走这里，
 * 不再各自 fetch 快照 / 各自调 raw58ToCandidate / 各自拼 pool。
 */

import { useEffect, useState } from 'react';
import { CandidateProperty } from '../types/rental';
import {
  buildCandidatePool,
  isWithinRoomLimit,
  raw58ToCandidate,
} from './listingPipeline';
import { fetchSnapshotListings } from './listingSources';

export interface CandidatePoolState {
  pool: CandidateProperty[];
  shortlistCount: number;
  snapshotKeptCount: number;
  snapshotMeta: string | null;
  snapshotError: string | null;
  loading: boolean;
}

export function useCandidatePool(params: {
  shortlist: CandidateProperty[];
  city: string;
  maxMonthlyRent: number;
}): CandidatePoolState {
  const { shortlist, city, maxMonthlyRent } = params;
  const [snapshotListings, setSnapshotListings] = useState<CandidateProperty[]>([]);
  const [snapshotMeta, setSnapshotMeta] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setSnapshotError(null);
      const result = await fetchSnapshotListings(city);
      if (cancelled) return;
      if (!result.success) {
        setSnapshotListings([]);
        setSnapshotMeta(null);
        setSnapshotError(result.error || '快照读取失败');
        setLoading(false);
        return;
      }
      // 硬性约束：超过 3 室的房源不进池（在 Raw→Candidate 转换前过滤，roomType 只在原始条目上）
      const roomOk = result.listings.filter((l) => isWithinRoomLimit(l.roomType, l.title));
      setSnapshotListings(roomOk.map((l) => raw58ToCandidate(l, { idPrefix: 'snap-' })));
      setSnapshotMeta(result.dataSource);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [city]);

  const { pool, shortlistCount, snapshotKeptCount } = buildCandidatePool({
    shortlist,
    snapshot: snapshotListings,
    maxMonthlyRent,
  });

  return { pool, shortlistCount, snapshotKeptCount, snapshotMeta, snapshotError, loading };
}
