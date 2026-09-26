// 房源相关路由：只做参数校验与响应装配，业务逻辑全在 services/。

import express, { Request, Response } from 'express';
import { DEFAULT_CITY } from '../config.js';
import { CITY_TO_58_CODE } from '../cityDict.js';
import {
  describeSnapshotSource,
  readSnapshot,
  snapshotExists,
  pickSnapshotListings,
} from '../services/listingStore.js';
import { importSnapshotFiles } from '../services/snapshotImport.js';
import { collect58 } from '../services/collector.js';
import { fetch58Direct } from '../services/fetch58Direct.js';
import { searchLiveListings } from '../services/aiSearch.js';

export const listingsRouter = express.Router();

/**
 * 全量真实房源快照：server 端不截断，预算/通勤筛选由前端按计划自身条件做。
 * 未覆盖的城市诚实返回 0 条。
 */
listingsRouter.get('/api/58-snapshot', (_req: Request, res: Response) => {
  const city = String(_req.query.city || DEFAULT_CITY).trim();
  if (!snapshotExists()) {
    return res.json({ success: true, city, total: 0, listings: [], dataSource: null });
  }
  try {
    const snapshot = readSnapshot();
    if (snapshot.length === 0) {
      return res.json({ success: true, city, total: 0, listings: [], dataSource: null });
    }
    if (city && !city.includes(DEFAULT_CITY) && !city.includes('新疆')) {
      return res.json({ success: true, city, total: 0, listings: [], dataSource: null });
    }
    return res.json({
      success: true,
      city,
      total: snapshot.length,
      listings: snapshot,
      dataSource: describeSnapshotSource(snapshot),
    });
  } catch (err: any) {
    console.warn('58-snapshot read failed:', err?.message || err);
    return res.status(500).json({ success: false, error: '快照读取失败：' + (err?.message || '未知错误') });
  }
});

/** 58 房源获取：优先真实快照，快照为空才走直连抓取 */
listingsRouter.post('/api/fetch-58-listings', async (req: Request, res: Response) => {
  const {
    city = DEFAULT_CITY,
    district = '',
    budgetMin = 1000,
    budgetMax = 3500,
    roomType = '主卧独卫/一室一厅',
  } = req.body || {};

  const cityKey = String(city || DEFAULT_CITY).trim();
  const cityCode = CITY_TO_58_CODE[cityKey] || 'xj';
  const query = { city: cityKey, district, budgetMin, budgetMax, roomType };

  try {
    if (snapshotExists()) {
      const snapshot = readSnapshot();
      const listings = pickSnapshotListings({
        city: cityKey,
        district,
        budgetMin: Number(budgetMin),
        budgetMax: Number(budgetMax),
      });
      return res.json({
        success: true,
        query,
        listings,
        sourcePlatform: '58同城',
        dataSource: describeSnapshotSource(snapshot),
      });
    }
  } catch (snapErr: any) {
    console.warn('58 snapshot read failed, falling back to live fetch:', snapErr?.message || snapErr);
  }

  try {
    const { listings, message } = await fetch58Direct({
      city: cityKey,
      cityCode,
      district: String(district || ''),
      budgetMin: Number(budgetMin),
      budgetMax: Number(budgetMax),
    });
    return res.json({
      success: true,
      query,
      listings,
      count: listings.length,
      sourcePlatform: '58同城',
      message,
    });
  } catch (err: any) {
    console.error('58 direct fetch error:', err);
    return res.json({
      success: true,
      query,
      listings: [],
      count: 0,
      sourcePlatform: '58同城',
      message: '抓取失败，未解析到房源数据 (0 条)',
    });
  }
});

/**
 * 快照导入：用户浏览器保存的 58 列表页上传后，解析 + 导入期补全坐标 + 按 rentMode 合并落盘。
 */
listingsRouter.post('/api/import-58-snapshot', async (req: Request, res: Response) => {
  const files: Array<{ name?: string; content?: string }> = req.body?.files || [];
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, error: '未收到任何快照文件' });
  }
  try {
    const outcome = await importSnapshotFiles(files, DEFAULT_CITY);
    if (!outcome.ok) {
      return res.status(400).json({ success: false, error: outcome.error });
    }
    const { ok, ...rest } = outcome;
    return res.json({ success: true, ...rest });
  } catch (err: any) {
    console.error('import-58-snapshot failed:', err?.message || err);
    return res.status(500).json({ success: false, error: '快照导入失败：' + (err?.message || '未知错误') });
  }
});

/** 一键浏览器采集：调起真实 Edge 会话翻页采集，写回快照 */
listingsRouter.post('/api/collect-58', async (req: Request, res: Response) => {
  const { city = DEFAULT_CITY, pages = 3, headful = true, modes = 'hezu,zhengzu' } = req.body || {};
  const outcome = await collect58({
    city: String(city),
    pages: Number(pages),
    headful: Boolean(headful),
    modes: String(modes),
  });
  if (!outcome.ok) {
    return res
      .status(outcome.log ? 502 : 500)
      .json({ success: false, error: outcome.error, log: outcome.log });
  }
  return res.status(outcome.result?.success ? 200 : 502).json(outcome.result);
});

/** 全网房源检索（大模型联网）：解析不出结果就诚实失败 */
listingsRouter.post('/api/fetch-live-listings', async (req: Request, res: Response) => {
  const {
    city = '杭州',
    district = '',
    subwayStation = '',
    budgetMin = 1500,
    budgetMax = 3500,
    roomType = '主卧独卫/一室一厅',
    keywords = '民用水电 近地铁',
  } = req.body || {};

  const outcome = await searchLiveListings({
    city: String(city),
    district: String(district),
    subwayStation: String(subwayStation),
    budgetMin: Number(budgetMin),
    budgetMax: Number(budgetMax),
    roomType: String(roomType),
    keywords: String(keywords),
  });

  if (!outcome.ok) {
    return res.json({
      success: false,
      error: outcome.error,
      sources: outcome.sources || [],
      searchQueries: outcome.searchQueries || [],
    });
  }
  return res.json({
    success: true,
    query: outcome.query,
    listings: outcome.listings,
    sources: outcome.sources,
    searchQueries: outcome.searchQueries,
  });
});
