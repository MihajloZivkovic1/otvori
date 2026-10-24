import jwt from 'jsonwebtoken';
import { ORDERING_LIMITS, elevationSeconds, type ElevationWindow } from '@qr-menu/shared';
import { env } from '../config/env.js';
import { unauthorized } from './errors.js';

const ISSUER = 'tabla';

/** `sid` = the sign-in's stable session id (auth_tokens.session_id); elevation tokens are bound to it. */
export function signAccessToken(userId: string, sessionId: string | null): { token: string; expiresIn: number } {
  const token = jwt.sign({ type: 'access', ...(sessionId ? { sid: sessionId } : {}) }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: ISSUER,
    expiresIn: env.JWT_ACCESS_TTL_SECONDS,
  });
  return { token, expiresIn: env.JWT_ACCESS_TTL_SECONDS };
}

export function verifyAccessToken(token: string): { userId: string; sessionId: string | null } {
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER, algorithms: ['HS256'] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw unauthorized('Access token expired', 'TOKEN_EXPIRED');
    }
    throw unauthorized('Invalid access token');
  }
  if (typeof payload === 'string' || payload.type !== 'access' || typeof payload.sub !== 'string') {
    throw unauthorized('Invalid access token');
  }
  return { userId: payload.sub, sessionId: typeof payload.sid === 'string' ? payload.sid : null };
}

/**
 * Short-lived token for the Server-Sent Events stream: EventSource cannot send an Authorization header, so the CMS
 * asks POST /sse-token (bearer, membership checked) and opens GET /events?token=. Bound to one restaurant.
 */
export function signSseToken(userId: string, restaurantId: string): { token: string; expiresIn: number } {
  const expiresIn = ORDERING_LIMITS.sseTokenSeconds;
  const token = jwt.sign({ type: 'sse', rid: restaurantId }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: ISSUER,
    expiresIn,
  });
  return { token, expiresIn };
}

export function verifySseToken(token: string): { userId: string; restaurantId: string } {
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER, algorithms: ['HS256'] });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) throw unauthorized('Stream token expired', 'TOKEN_EXPIRED');
    throw unauthorized('Invalid stream token');
  }
  if (typeof payload === 'string' || payload.type !== 'sse' || typeof payload.sub !== 'string' || typeof payload.rid !== 'string') {
    throw unauthorized('Invalid stream token');
  }
  return { userId: payload.sub, restaurantId: payload.rid };
}

/* ------------------------------------------------------------------ owner PIN elevation (Phase 11) */

export interface ElevationClaims {
  userId: string;
  restaurantId: string;
  /** The sign-in the PIN was typed into; a token stolen from one session is useless with another. */
  sessionId: string;
  window: ElevationWindow;
  expiresAt: Date;
}

/**
 * Proof that the owner PIN (or password) was entered on this device, sent as `X-Elevation` on owner requests.
 * Lifetime = the chosen window, capped at PIN_LIMITS.maxTokenMinutes; `session` tokens are renewed by …/security/extend.
 */
export function signElevationToken(claims: Omit<ElevationClaims, 'expiresAt'>): { token: string; expiresAt: Date } {
  const expiresIn = elevationSeconds(claims.window);
  const token = jwt.sign(
    { type: 'elevation', rid: claims.restaurantId, sid: claims.sessionId, win: claims.window },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', subject: claims.userId, issuer: ISSUER, expiresIn },
  );
  return { token, expiresAt: new Date(Date.now() + expiresIn * 1000) };
}

/** Null (never throws) when the token is missing, malformed, expired or signed for another purpose. */
export function verifyElevationToken(token: string | undefined): ElevationClaims | null {
  if (!token) return null;
  let payload: jwt.JwtPayload | string;
  try {
    payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: ISSUER, algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (
    typeof payload === 'string' ||
    payload.type !== 'elevation' ||
    typeof payload.sub !== 'string' ||
    typeof payload.rid !== 'string' ||
    typeof payload.sid !== 'string' ||
    typeof payload.win !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    return null;
  }
  return {
    userId: payload.sub,
    restaurantId: payload.rid,
    sessionId: payload.sid,
    window: payload.win as ElevationWindow,
    expiresAt: new Date(payload.exp * 1000),
  };
}
