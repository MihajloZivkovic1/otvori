import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { UniqueConstraintError } from 'sequelize';
import { ZodError } from 'zod';
import type { ApiErrorDto } from '@qr-menu/shared';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

function send(res: Response, status: number, body: ApiErrorDto): void {
  res.status(status);
  res.setHeader('Cache-Control', 'no-store');
  res.json(body);
}

export function notFoundHandler(req: Request, res: Response): void {
  send(res, 404, { error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
}

function isZodError(error: unknown): error is ZodError {
  return error instanceof ZodError || (error as { name?: string } | null)?.name === 'ZodError';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (isZodError(error)) {
    send(res, 400, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    send(res, error.status, {
      error: { code: error.code, message: error.message, ...(error.details !== undefined ? { details: error.details } : {}) },
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      send(res, 413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'File is too large (max 8 MB)' } });
      return;
    }
    send(res, 400, { error: { code: 'VALIDATION_ERROR', message: error.message, details: { field: error.field } } });
    return;
  }

  if (error instanceof UniqueConstraintError) {
    send(res, 409, {
      error: { code: 'CONFLICT', message: 'A record with the same unique value already exists', details: error.fields },
    });
    return;
  }

  const httpError = error as { type?: string; status?: number; statusCode?: number; message?: string } | null;
  if (httpError?.type === 'entity.parse.failed') {
    send(res, 400, { error: { code: 'VALIDATION_ERROR', message: 'Malformed JSON body' } });
    return;
  }
  if (httpError?.type === 'entity.too.large') {
    send(res, 413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large' } });
    return;
  }

  logger.error({ err: error, method: req.method, url: req.originalUrl }, 'Unhandled error');
  send(res, 500, {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      ...(env.isProduction ? {} : { details: httpError?.message }),
    },
  });
}
