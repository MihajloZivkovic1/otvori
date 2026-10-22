import 'reflect-metadata';
import './types/express.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { adminRouter } from './modules/admin.router.js';
import { authRouter } from './modules/auth/router.js';
import { healthRouter } from './modules/health/router.js';
import { paymentSimulatorRouter } from './modules/payments/simulator.js';
import { paymentWebhookRouter } from './modules/payments/router.js';
import { publicRouter } from './modules/public/router.js';
import { superadminRouter } from './modules/superadmin/router.js';
import { logger } from './utils/logger.js';
import { localUploadsDir } from './utils/storage.js';

function isAllowedOrigin(origin: string): boolean {
  if (env.corsOrigins.includes(origin)) return true;
  const suffix = env.publicMenu.hostSuffix;
  if (!suffix) return false;
  try {
    const host = new URL(origin).hostname;
    return host === suffix || host.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

/** `/api/auth/magic-link/<token>` and `…/events?token=…` carry secrets in the URL; keep them out of the logs. */
export function stripTokenParam(url: string): string {
  return url
    .replace(/([?&]token=)[^&]*/g, '$1[redacted]')
    .replace(/(\/api\/auth\/magic-link\/)[^/?#]+/, '$1[redacted]');
}

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      autoLogging: env.isTest ? false : { ignore: (req) => req.url === '/api/health' },
      // Never log credentials: no request/response headers (Authorization, Cookie, Set-Cookie with the refresh
      // token) and no `?token=` query values (SSE stream token, magic link).
      serializers: {
        req: (req: { id?: unknown; method?: string; url?: string; remoteAddress?: string }) => ({
          id: req.id,
          method: req.method,
          url: stripTokenParam(req.url ?? ''),
          remoteAddress: req.remoteAddress,
        }),
        res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      },
      redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
      credentials: true,
    }),
  );
  app.use(
    express.json({
      limit: '1mb',
      // Webhook signatures are computed over the exact bytes the provider sent.
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());
  if (env.PAYMENTS_MOCK) app.use('/dev/pay', express.urlencoded({ extended: false, limit: '10kb' }));

  const uploadsDir = localUploadsDir();
  if (uploadsDir) {
    app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', immutable: true, index: false, fallthrough: true }));
  }

  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/superadmin', superadminRouter);
  app.use('/api/public', publicRouter);
  // Bank callbacks (no auth: each provider verifies its own signature) and, in development, the payment simulator.
  app.use('/api/webhooks/payments', paymentWebhookRouter);
  if (env.PAYMENTS_MOCK) app.use('/dev/pay', paymentSimulatorRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
