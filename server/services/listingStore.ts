// 58 房源快照的唯一读写口：读 / 写 / 按 rentMode 合并 / 按城市+区域+预算挑选。
// 快照文件是纯数组（读取契约不变），这里只负责存取，不做任何数据编造。

import fs from 'fs';
import { SNAPSHOT_PATH, DEFAULT_CITY } from '../config.js';

export type SnapshotListing = Record<string, any>;

export function snapshotExists(): boolean {
  return fs.existsSync(SNAPSHOT_PATH);
}

export function readSnapshot(): SnapshotListing[] {
  try {
    const raw = fs.readFileSync(SNAPSHOT_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeSnapshot(listings: SnapshotListing[]): void {
  // 先写临时文件再 rename：写一半进程被杀不会留下半个快照
  const tmp = `${SNAPSHOT_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(listings, null, 1), 'utf-8');
  fs.renameSync(tmp, SNAPSHOT_PATH);
}

/**
 * 按 id 增量合并：导入的记录覆盖同 id 旧记录，其余旧记录全部保留。
 * 部分采集（如被反爬只抓到 1 页）不会吞掉同模式的旧房源；整页失效靠重新采集覆盖。
 */
export function mergeSnapshot(
  existing: SnapshotListing[],
  imported: SnapshotListing[]
): { merged: SnapshotListing[]; kept: SnapshotListing[] } {
  const importedIds = new Set(imported.map((l) => l?.id));
  const kept = existing.filter((l) => l && !importedIds.has(l.id));
  return { merged: [...kept, ...imported], kept };
}

/** 快照里出现的采集日期（升序） */
export function snapshotCapturedDates(snapshot: SnapshotListing[]): string[] {
  return [...new Set(snapshot.map((l) => l && l.capturedAt).filter(Boolean))].sort();
}

/** 数据源说明文案：分批采集 / 单次采集 / 未标注 */
export function describeSnapshotSource(snapshot: SnapshotListing[]): string | null {
  if (snapshot.length === 0) return null;
  const dates = snapshotCapturedDates(snapshot);
  if (dates.length > 1) {
    return `58同城网页快照（${dates[0]}~${dates[dates.length - 1]} 分批采集，真实在售房源）`;
  }
  if (dates[0]) {
    return `58同城网页快照（${dates[0]} 采集，真实在售房源）`;
  }
  return '58同城网页快照（用户浏览器保存，真实在售房源）';
}

/** 该城市是否被快照覆盖：目前只有乌鲁木齐有真实数据 */
export function isCityCovered(city: string): boolean {
  return String(city || '').includes(DEFAULT_CITY) || String(city || '').includes('新疆');
}

export interface PickOptions {
  city: string;
  district?: string;
  budgetMin?: number;
  budgetMax?: number;
  limit?: number;
}

/**
 * 按城市 / 区域 / 预算挑选快照房源。
 * 预算过滤后不足 2 条时回退到城市全集（不因预算过窄而显示空白），上限默认 30 条。
 */
export function pickSnapshotListings(options: PickOptions): SnapshotListing[] {
  const { city, district = '', budgetMin = 0, budgetMax = 0, limit = 30 } = options;
  const snapshot = readSnapshot();
  if (!isCityCovered(city)) return [];

  const inCity = snapshot.filter((l) => {
    const d = district.trim();
    if (!d) return true;
    return (
      (l.address || '').includes(d) ||
      (l.community || '').includes(d) ||
      (l.title || '').includes(d)
    );
  });

  const inBudget = inCity.filter(
    (l) => l.rent == null || (l.rent >= Number(budgetMin) && l.rent <= Number(budgetMax))
  );

  return (inBudget.length >= 2 ? inBudget : inCity).slice(0, limit);
}
