import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { env, type S3Config } from '../config/env.js';
import { logger } from './logger.js';

export interface StorageDriver {
  /** Store a file and return its public URL. */
  put(key: string, body: Buffer, contentType: string): Promise<string>;
  /** Read a file back (used when embedding logos in PDFs). Returns null when missing. */
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  /** Extract the storage key from a URL produced by this driver, or null if it is foreign. */
  keyFromUrl(url: string): string | null;
}

function assertSafeKey(key: string): void {
  if (key.includes('..') || key.startsWith('/') || key.includes('\\')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }
}

export class LocalStorage implements StorageDriver {
  readonly baseDir: string;
  readonly baseUrl: string;

  constructor(baseDir: string, baseUrl: string) {
    this.baseDir = path.resolve(baseDir);
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async put(key: string, body: Buffer, _contentType: string): Promise<string> {
    assertSafeKey(key);
    const file = path.join(this.baseDir, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return `${this.baseUrl}/${key}`;
  }

  async get(key: string): Promise<Buffer | null> {
    assertSafeKey(key);
    try {
      return await readFile(path.join(this.baseDir, key));
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await rm(path.join(this.baseDir, key), { force: true });
  }

  keyFromUrl(url: string): string | null {
    const prefix = `${this.baseUrl}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}

/**
 * SDK options for the configured bucket. AWS S3 (no custom endpoint): regional endpoint resolved by the SDK,
 * virtual-hosted-style URLs, objects public through the bucket policy on `restaurants/*`. An S3-compatible service
 * (DigitalOcean Spaces, MinIO) is addressed through S3_ENDPOINT and gets `ACL: public-read` per object instead.
 */
export function s3ClientOptions(config: S3Config): S3ClientConfig {
  return {
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    region: config.region,
    forcePathStyle: false,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  };
}

/** Base of the public URLs: S3_PUBLIC_BASE_URL, else the bucket's virtual-hosted host (AWS regional or custom). */
export function s3PublicBase(config: S3Config): string {
  if (config.publicBaseUrl) return config.publicBaseUrl.replace(/\/+$/, '');
  if (!config.endpoint) return `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
  const endpoint = new URL(config.endpoint);
  return `${endpoint.protocol}//${config.bucket}.${endpoint.host}`;
}

/** Only S3-compatible services need (or accept) a per-object ACL; AWS buckets use "bucket owner enforced" + policy. */
export function s3ObjectAcl(config: S3Config): 'public-read' | undefined {
  return config.endpoint ? 'public-read' : undefined;
}

export class S3Storage implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly acl: 'public-read' | undefined;

  constructor(config: S3Config) {
    this.client = new S3Client(s3ClientOptions(config));
    this.bucket = config.bucket;
    this.publicBase = s3PublicBase(config);
    this.acl = s3ObjectAcl(config);
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ...(this.acl ? { ACL: this.acl } : {}),
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return `${this.publicBase}/${key}`;
  }

  async get(key: string): Promise<Buffer | null> {
    assertSafeKey(key);
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      const bytes = await result.Body?.transformToByteArray();
      return bytes ? Buffer.from(bytes) : null;
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  keyFromUrl(url: string): string | null {
    const prefix = `${this.publicBase}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}

export const storage: StorageDriver = env.s3
  ? new S3Storage(env.s3)
  : new LocalStorage(env.UPLOADS_DIR, `${env.API_URL}/uploads`);

/** Best-effort removal of a previously stored file; never throws. */
export async function deleteStoredUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const key = storage.keyFromUrl(url);
  if (!key) return;
  try {
    await storage.delete(key);
  } catch (error) {
    logger.warn({ err: error, key }, 'Failed to delete stored file');
  }
}

export function localUploadsDir(): string | null {
  return storage instanceof LocalStorage ? storage.baseDir : null;
}
