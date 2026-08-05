import express, { type NextFunction, type Request, type Response } from 'express';

import { AppError, type Clock, LinkService } from './link.service';

export interface AppOptions {
  service?: LinkService;
  clock?: Clock;
  /** Used to build the absolute short URL returned on create. */
  baseUrl?: string;
}

export function createApp(options: AppOptions = {}) {
  const service = options.service ?? new LinkService(options.clock);
  const baseUrl = (options.baseUrl ?? 'http://localhost:3001').replace(/\/$/, '');

  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/links', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { url, ttlSeconds } = req.body ?? {};
      const link = service.create(url, ttlSeconds);

      res.status(201).json({
        code: link.code,
        shortUrl: `${baseUrl}/${link.code}`,
        url: link.url,
        expiresAt: link.expiresAt?.toISOString() ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/links/:code/stats', (req: Request<{ code: string }>, res, next) => {
    try {
      const link = service.stats(req.params.code);

      res.json({
        code: link.code,
        url: link.url,
        hits: link.hits,
        expired: link.expired,
        createdAt: link.createdAt.toISOString(),
        expiresAt: link.expiresAt?.toISOString() ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  // Last, so it cannot shadow /health or /links.
  app.get('/:code', (req: Request<{ code: string }>, res, next) => {
    try {
      const link = service.resolve(req.params.code);
      // 302, not 301: a permanent redirect is cached by the browser, and the
      // next visit would never reach the server — so hits would stop counting
      // and an expiry would never take effect.
      res.redirect(302, link.url);
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      res.status(error.status).json({ error: error.name, message: error.message });
      return;
    }

    console.error('Unhandled error', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Something went wrong' });
  });

  return app;
}
