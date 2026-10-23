import { describe, expect, it } from 'vitest';
import type { S3Config } from '../src/config/env.js';
import { s3ClientOptions, s3ObjectAcl, s3PublicBase } from '../src/utils/storage.js';

const aws: S3Config = {
  endpoint: null,
  region: 'eu-central-1',
  bucket: 'otvori-media',
  accessKeyId: 'AKIA-test',
  secretAccessKey: 'secret',
  publicBaseUrl: null,
};

describe('S3 storage configuration', () => {
  it('targets AWS when no endpoint is set: regional SDK endpoint, virtual-hosted URLs, no per-object ACL', () => {
    const options = s3ClientOptions(aws);
    expect(options).not.toHaveProperty('endpoint');
    expect(options.region).toBe('eu-central-1');
    expect(options.forcePathStyle).toBe(false);
    expect(s3PublicBase(aws)).toBe('https://otvori-media.s3.eu-central-1.amazonaws.com');
    expect(s3ObjectAcl(aws)).toBeUndefined();
  });

  it('uses S3_PUBLIC_BASE_URL for image URLs when given (CDN in front of the bucket)', () => {
    expect(s3PublicBase({ ...aws, publicBaseUrl: 'https://media.otvori.menu/' })).toBe('https://media.otvori.menu');
  });

  it('keeps the S3-compatible path for a custom endpoint (Spaces): endpoint + public-read ACL', () => {
    const spaces: S3Config = { ...aws, endpoint: 'https://fra1.digitaloceanspaces.com', region: 'fra1', bucket: 'otvori' };
    expect(s3ClientOptions(spaces).endpoint).toBe('https://fra1.digitaloceanspaces.com');
    expect(s3PublicBase(spaces)).toBe('https://otvori.fra1.digitaloceanspaces.com');
    expect(s3ObjectAcl(spaces)).toBe('public-read');
  });
});
