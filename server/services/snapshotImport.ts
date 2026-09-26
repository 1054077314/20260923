// 快照导入编排：解析上传的 58 列表页 → 导入期补全坐标 → 去重 → 按 rentMode 合并 → 落盘。
// 诚实契约：解析 0 条直接失败，不生成任何占位数据。

import { DEFAULT_CITY } from '../config.js';
import { parse58SnapshotHtml } from '../parse58.js';
import { resolveImportCoordinates } from './geocodeService.js';
import { mergeSnapshot, readSnapshot, writeSnapshot } from './listingStore.js';

export type ImportOutcome =
  | {
      ok: true;
      imported: number;
      retainedFromPrevious: number;
      totalInSnapshot: number;
      bySource: Record<string, number>;
      capturedAt: string;
      coordinatesResolved: { geocacheOrDict: number; amap: number; unresolved: number };
    }
  | { ok: false; error: string };

export async function importSnapshotFiles(
  files: Array<{ name?: string; content?: string }>,
  city: string = DEFAULT_CITY
): Promise<ImportOutcome> {
  const capturedAt = new Date().toISOString().slice(0, 10);
  const all: Record<string, any>[] = [];
  const bySource: Record<string, number> = {};

  for (const f of files) {
    const name = f.name || '快照';
    if (!f.content) continue;
    const html = Buffer.from(f.content, 'base64').toString('utf-8');
    if (!html.includes('house-cell')) continue;
    const parsed = parse58SnapshotHtml(html, name, city);
    bySource[name] = parsed.length;
    all.push(...parsed);
  }

  if (all.length === 0) {
    return {
      ok: false,
      error: '解析结果为 0 条：请确认上传的是 58 同城租房列表页（含房源卡片）的完整网页文件',
    };
  }

  // 坐标只在导入期补全
  const coordinatesResolved = await resolveImportCoordinates({
    listings: all,
    city,
    capturedAt,
  });

  for (const l of all) {
    l.capturedAt = capturedAt;
    l.dataSource = `${l.dataSource} ${capturedAt} 采集`;
  }

  // 同批次内按 id 去重（先出现者胜）
  const seen = new Set<string>();
  const imported = all.filter((l) => {
    if (!l.id || seen.has(l.id)) return false;
    seen.add(l.id);
    return true;
  });

  const { merged, kept } = mergeSnapshot(readSnapshot(), imported);
  writeSnapshot(merged);

  return {
    ok: true,
    imported: imported.length,
    retainedFromPrevious: kept.length,
    totalInSnapshot: merged.length,
    bySource,
    capturedAt,
    coordinatesResolved,
  };
}
