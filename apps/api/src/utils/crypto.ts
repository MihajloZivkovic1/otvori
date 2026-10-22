import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Secrets at rest (merchant secrets, POS API keys): AES-256-GCM with a key from PAYMENTS_ENCRYPTION_KEY
 * (32 random bytes, base64). Format: `v1.<iv>.<tag>.<ciphertext>` (base64url parts), so the scheme can rotate.
 */
const VERSION = 'v1';

function key(): Buffer {
  return createHash('sha256').update(env.PAYMENTS_ENCRYPTION_KEY).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptSecret(stored: string): string {
  const [version, iv, tag, data] = stored.split('.');
  if (version !== VERSION || !iv || !tag || !data) throw new Error('Unknown secret format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}

/** Hex HMAC-SHA256, the signature scheme of the mock provider (and of the simulator that talks to it). */
export function hmacSha256Hex(secret: string, payload: Buffer | string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}
