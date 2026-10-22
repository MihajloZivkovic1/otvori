import jwt from 'jsonwebtoken';
import { ORDERING_LIMITS } from '@qr-menu/shared';
import { env } from '../config/env.js';
import { unauthorized } from './errors.js';

const ISSUER = 'tabla';

export function signAccessToken(userId: string): { token: string; expiresIn: number } {
  const token = jwt.sign({ type: 'access' }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    issuer: ISSUER,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  });
  return { token, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

export function verifyAccessToken(token: string): { userId: string } {
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('Access token expired', 'TOKEN_EXPIRED');
    }
    throw unauthorized('Invalid access token');
  }
  if (typeof payload === 'string' || payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw unauthorized('Invalid access token');
  }
  return { userId: payload.sub };
}

/**
 * Short-lived token for the Server-Sent Events stream: EventSource cannot send an Authorization header, so the CMS
 * asks POST /sse-token (bearer, membership checked) and opens GET /events?token=. Bound to one restaurant.
 */
export function signSseToken(userId: string, restaurantId: string): { token: string; expiresIn: number } {
  const expiresIn = ORDERING_LIMITS.sseTokenSeconds;
  const token = jwt.sign({ type: 'sse', rid: restaurantId }, env.JWT_ACCESS_SECRET, {
    subject: userId,
    issuer: ISSUER,
    expiresIn,
  });
  return { token, expiresIn };
}

export function verifySseToken(token: string): { userId: string; restaurantId: string } {
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw unauthorized('Stream token expired', 'TOKEN_EXPIRED');
    throw unauthorized('Invalid stream token');
  }
  if (typeof payload === 'string' || payload.type !== 'sse' || typeof payload.sub !== 'string' || typeof payload.rid !== 'string') {
    throw unauthorized('Invalid stream token');
  }
  return { userId: payload.sub, restaurantId: payload.rid };
}
