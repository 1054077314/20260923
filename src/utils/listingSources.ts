/**
 * 前端读取房源数据的唯一入口：快照与平台抓取都从这里拿 Raw58Listing[]。
 * 组件不再各自 fetch / 各自判断成败，失败信息在这里统一成型。
 */

import { Raw58Listing } from './listingPipeline';

export interface SnapshotListingsResult {
  success: boolean;
  listings: Raw58Listing[];
  dataSource: string | null;
  error?: string;
}

/** 全量真实房源快照（server 端不截断；预算/通勤筛选由调用方按计划自身条件做） */
export async function fetchSnapshotListings(city: string): Promise<SnapshotListingsResult> {
  try {
    const res = await fetch(`/api/58-snapshot?city=${encodeURIComponent(city || '乌鲁木齐')}`);
    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        listings: [],
        dataSource: null,
        error: data.error || '快照读取失败',
      };
    }
    return {
      success: true,
      listings: (data.listings || []) as Raw58Listing[],
      dataSource: data.dataSource || null,
    };
  } catch {
    return {
      success: false,
      listings: [],
      dataSource: null,
      error: '快照服务请求失败',
    };
  }
}

export interface SnapshotCollectResult {
  success: boolean;
  imported?: number;
  retainedFromPrevious?: number;
  totalInSnapshot?: number;
  capturedAt?: string;
  coordinatesResolved?: { geocacheOrDict?: number };
  error?: string;
}

/** 浏览器自动采集：server 起真实 Edge 会话翻页采集，写回 58 快照 */
export async function collect58Snapshot(params: {
  city: string;
  pages?: number;
  headful?: boolean;
}): Promise<SnapshotCollectResult> {
  try {
    const res = await fetch('/api/collect-58', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city: params.city, pages: params.pages ?? 3, headful: params.headful ?? true }),
    });
    const data = await res.json();
    if (!data?.success) {
      return { success: false, error: data?.error || '自动采集失败' };
    }
    return { success: true, ...data };
  } catch {
    return { success: false, error: '自动采集请求失败' };
  }
}

/** 用户已保存 58 列表页快照导入：server 解析后重写 data-58-snapshot.json */
export async function import58SnapshotFiles(
  files: { name: string; content: string }[]
): Promise<SnapshotCollectResult> {
  try {
    const res = await fetch('/api/import-58-snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files }),
    });
    const data = await res.json();
    if (!data?.success) {
      return { success: false, error: data?.error || '快照导入失败' };
    }
    return { success: true, ...data };
  } catch {
    return { success: false, error: '快照导入请求失败' };
  }
}

export interface ScrapedListingsResult {
  success: boolean;
  listings: Raw58Listing[];
  sources: { title: string; url: string }[];
  dataSource: string | null;
  error?: string;
}

/**
 * 平台抓取结果（58 直连 / 全网检索共用同一入参出口）。
 * 成功与否由服务端 success 字段决定，抓不到就是空数组，不生成兜底数据。
 */
export async function fetchScrapedListings(params: {
  endpoint: string;
  payload: Record<string, any>;
}): Promise<ScrapedListingsResult> {
  let data: any;
  try {
    const res = await fetch(params.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params.payload),
    });
    data = await res.json();
  } catch {
    return {
      success: false,
      listings: [],
      sources: [],
      dataSource: null,
      error: '网络请求超时，请检查网络后重试',
    };
  }

  if (!data?.success) {
    return {
      success: false,
      listings: [],
      sources: [],
      dataSource: null,
      error: data?.error || '获取房源数据失败',
    };
  }

  return {
    success: true,
    listings: (data.listings || []) as Raw58Listing[],
    sources: (data.sources || []) as { title: string; url: string }[],
    dataSource: data.dataSource || null,
  };
}
