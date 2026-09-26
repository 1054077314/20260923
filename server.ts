/**
 * 服务端入口：只做应用装配。
 * 业务编排在 server/services/，路由在 server/routes/，纯函数在 server/*.ts。
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { PORT } from './server/config.js';
import { listingsRouter } from './server/routes/listings.js';
import { commuteRouter } from './server/routes/commute.js';
import { geoRouter } from './server/routes/geo.js';
import { aiRouter } from './server/routes/ai.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '15mb' }));

app.use(geoRouter);
app.use(aiRouter);
app.use(commuteRouter);
app.use(listingsRouter);

// Body-size / malformed-JSON guard: honest JSON errors, service stays alive
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (!err) return next();
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: '请求体超过 15MB 上限，未接受本次导入，服务未受影响',
    });
  }
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res.status(400).json({ success: false, error: '请求体不是合法 JSON，未接受本次导入' });
  }
  console.error('unhandled request error:', err?.message || err);
  return res.status(500).json({ success: false, error: '服务器内部错误' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RentPlan server running on port ${PORT}`);
  });
}

startServer();
