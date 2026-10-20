import 'dotenv/config';
import { z } from 'zod';

const boolFlag = z
  .enum(['0', '1', 'true', 'false'])
  .optional()
  .transform((v) => v === '1' || v === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),
  TRUST_PROXY: boolFlag,

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  TEST_DATABASE_URL: z.string().optional(),
  DATABASE_SSL: boolFlag,

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REFRESH_COOKIE_NAME: z.string().default('tabla_refresh'),

  APP_URL: z.url().default('http://localhost:5173'),
  API_URL: z.url().optional(),
  PUBLIC_MENU_BASE_URL: z.string().default('http://{slug}.localhost:5174'),
  CORS_ORIGINS: z.string().optional(),

  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  UPLOADS_DIR: z.string().default('./uploads'),

  MAIL_FROM: z.string().default('salveta <no-reply@salveta.menu>'),

  /** Build identifier reported by GET /api/health (the git short SHA baked into the Docker image). */
  APP_VERSION: z.string().optional(),
});

/** Empty strings in .env files mean "unset". */
const rawEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => typeof value === 'string' && value.trim() !== ''),
);

const parsed = envSchema.safeParse(rawEnv);
if (!parsed.success) {
  const lines = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
   
  console.error(`Invalid environment configuration:\n${lines.join('\n')}`);
  process.exit(1);
}
const raw = parsed.data;

function withDatabaseName(url: string, transform: (name: string) => string): string {
  const parsedUrl = new URL(url);
  const current = parsedUrl.pathname.replace(/^\//, '');
  parsedUrl.pathname = `/${transform(current || 'postgres')}`;
  return parsedUrl.toString();
}

const isTest = raw.NODE_ENV === 'test';
// Tests never touch the development database: they use TEST_DATABASE_URL or "<db>_test".
const databaseUrl = isTest
  ? (raw.TEST_DATABASE_URL ?? withDatabaseName(raw.DATABASE_URL, (name) => `${name}_test`))
  : raw.DATABASE_URL;

const apiUrl = raw.API_URL ?? `http://localhost:${raw.PORT}`;

/** Derive the host suffix from the template, e.g. "http://{slug}.localhost:5174" → "localhost". */
function publicMenuHostSuffix(template: string): string | null {
  try {
    const probe = new URL(template.replace('{slug}', 'probe-slug'));
    const host = probe.hostname;
    if (!host.startsWith('probe-slug.')) return null;
    return host.slice('probe-slug.'.length);
  } catch {
    return null;
  }
}

const s3 =
  raw.S3_BUCKET && raw.S3_ACCESS_KEY_ID && raw.S3_SECRET_ACCESS_KEY
    ? {
        endpoint: raw.S3_ENDPOINT ?? 'https://fra1.digitaloceanspaces.com',
        region: raw.S3_REGION ?? 'fra1',
        bucket: raw.S3_BUCKET,
        accessKeyId: raw.S3_ACCESS_KEY_ID,
        secretAccessKey: raw.S3_SECRET_ACCESS_KEY,
        publicUrl: raw.S3_PUBLIC_URL ?? null,
      }
    : null;

const corsOrigins = new Set<string>([
  raw.APP_URL,
  ...(raw.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
]);

export const env = {
  ...raw,
  DATABASE_URL: databaseUrl,
  API_URL: apiUrl,
  APP_VERSION: raw.APP_VERSION ?? 'dev',
  isProduction: raw.NODE_ENV === 'production',
  isDevelopment: raw.NODE_ENV === 'development',
  isTest,
  corsOrigins: [...corsOrigins],
  s3,
  publicMenu: {
    template: raw.PUBLIC_MENU_BASE_URL,
    hostSuffix: publicMenuHostSuffix(raw.PUBLIC_MENU_BASE_URL),
  },
} as const;

export type Env = typeof env;
