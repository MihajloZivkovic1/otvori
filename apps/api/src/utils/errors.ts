import type { ErrorCode } from '@qr-menu/shared';

/** Error with an HTTP status and a stable machine-readable code; rendered by the error middleware. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'VALIDATION_ERROR', message, details);

export const unauthorized = (message = 'Authentication required', code: ErrorCode = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Not found', code: ErrorCode = 'NOT_FOUND') =>
  new AppError(404, code, message);

export const conflict = (code: ErrorCode, message: string) => new AppError(409, code, message);

export const payloadTooLarge = (message = 'Payload too large') =>
  new AppError(413, 'PAYLOAD_TOO_LARGE', message);

export const unsupportedMediaType = (message = 'Unsupported media type') =>
  new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', message);
