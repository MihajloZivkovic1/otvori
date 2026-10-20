import jwt from 'jsonwebtoken';
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
