import { createHash, randomBytes } from 'node:crypto';

/** Opaque, URL-safe random token. Only its SHA-256 hash is persisted. */
export function generateOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
