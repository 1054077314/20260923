// 地理编码路由。

import express, { Request, Response } from 'express';
import { geocodeAddress } from '../services/geocodeService.js';

export const geoRouter = express.Router();

/** 真实地理编码（高德）：失败一律 available:false，绝不返回估算坐标 */
geoRouter.post('/api/geocode-address', async (req: Request, res: Response) => {
  const { address, city = '' } = req.body || {};
  const result = await geocodeAddress(String(address || ''), String(city || ''));
  if (!result.available) {
    return res.json({ success: true, available: false, reason: result.reason });
  }
  return res.json({
    success: true,
    available: true,
    coordinates: result.coordinates,
    level: result.level,
  });
});
