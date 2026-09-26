// 通勤路由：单条路线 + 批量通勤（前端唯一入口，避免逐条打接口）。

import express, { Request, Response } from 'express';
import { getRoute, isSupportedMode } from '../services/routeService.js';
import { computeCommuteBatch, isValidLatLng } from '../services/commuteService.js';

export const commuteRouter = express.Router();

function latLngFrom(value: any) {
  return value && typeof value.lat === 'number' && typeof value.lng === 'number'
    ? { lat: value.lat, lng: value.lng }
    : null;
}

/** 单条真实路线（保留给细粒度调用） */
commuteRouter.post('/api/route-time', async (req: Request, res: Response) => {
  const { from, to, mode = 'subway', city = '' } = req.body || {};
  const origin = latLngFrom(from);
  const destination = latLngFrom(to);
  if (!origin || !destination || !isValidLatLng(origin) || !isValidLatLng(destination)) {
    return res.status(400).json({ success: false, error: '缺少有效的起终点坐标' });
  }
  if (!isSupportedMode(mode)) {
    return res.status(400).json({ success: false, error: '不支持的通勤方式: ' + mode });
  }

  const result = await getRoute({
    from: origin,
    to: destination,
    mode: String(mode),
    city: String(city),
    wantDetail: Boolean(req.body?.detail),
  });

  return res.json({
    success: true,
    available: result.available,
    minutes: result.minutes,
    distanceMeters: result.distanceMeters,
    segments: result.segments,
    source: result.source,
    reason: result.reason,
  });
});

/**
 * 批量通勤：前端把整批房源一次交给服务端，
 * 服务端做地址归并去重 + 缓存复用 + 并发限流，返回逐条结果与用量统计。
 */
commuteRouter.post('/api/commute-batch', async (req: Request, res: Response) => {
  const { to, mode = 'subway', city = '', detail = false, items = [] } = req.body || {};
  const destination = latLngFrom(to);
  if (!destination || !isValidLatLng(destination)) {
    return res.status(400).json({ success: false, error: '缺少有效的工作地坐标' });
  }
  if (!isSupportedMode(mode)) {
    return res.status(400).json({ success: false, error: '不支持的通勤方式: ' + mode });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.json({ success: true, routes: {}, meta: { requested: 0 } });
  }

  try {
    const { routes, meta } = await computeCommuteBatch({
      city: String(city),
      to: destination,
      mode: String(mode),
      wantDetail: Boolean(detail),
      items: items.slice(0, 200),
    });
    return res.json({ success: true, routes, meta });
  } catch (err: any) {
    console.warn('commute-batch failed:', err?.message || err);
    return res.status(500).json({ success: false, error: '批量通勤计算失败：' + (err?.message || '未知错误') });
  }
});
