// 大模型联网检索路由。

import express, { Request, Response } from 'express';
import { searchAmenities } from '../services/aiSearch.js';

export const aiRouter = express.Router();

/** 小区周边配套检索（Google Search Grounding） */
aiRouter.post('/api/amenities-search', async (req: Request, res: Response) => {
  const { city, community, address } = req.body || {};
  const outcome = await searchAmenities({
    city: String(city || ''),
    community: String(community || ''),
    address: String(address || ''),
  });
  if (!outcome.ok) {
    return res.status(500).json({ success: false, error: outcome.error });
  }
  const { ok, ...rest } = outcome;
  return res.json({ success: true, ...rest });
});
