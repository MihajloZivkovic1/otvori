import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
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

export class S3Storage implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(config: NonNullable<typeof env.s3>) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: false,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    this.bucket = config.bucket;
    const endpointHost = new URL(config.endpoint);
    this.publicBase = (config.publicUrl ?? `${endpointHost.protocol}//${config.bucket}.${endpointHost.host}`).replace(
      /\/+$/,
      '',
    );
  }

  async put(key: string, body: Buffer, contentType: string): Promise<string> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read',
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
