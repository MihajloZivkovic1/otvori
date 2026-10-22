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

  MAIL_FROM: z.string().default('otvori <zdravo@otvori.menu>'),
  /** `log` writes mails to the log (dev/test), `resend` sends them through https://resend.com. */
  MAIL_PROVIDER: z.enum(['log', 'resend']).default('log'),
  RESEND_API_KEY: z.string().optional(),
  /** Escape hatch: run production with MAIL_PROVIDER=log (links end up in the logs). Never set it on a real deployment. */
  ALLOW_LOG_MAIL: boolFlag,

  /** Online payment (Phase 9c). The simulator (mock provider + GET /dev/pay/:ref) only exists while PAYMENTS_MOCK. */
  PAYMENTS_MOCK: boolFlag,
  /** Key for the merchant secrets / POS API keys at rest (AES-256-GCM); `openssl rand -base64 32`. */
  PAYMENTS_ENCRYPTION_KEY: z.string().min(16).optional(),
  /** OTP eCommerce gateway base URL (sandbox or production); unset = provider unavailable. */
  OTP_ECOM_BASE_URL: z.url().optional(),
  /** POS integration (Phase 9d). POS_MOCK=true enables the mock register (logs + fake fiscal receipts). */
  POS_MOCK: boolFlag,
  /** Octopos sandbox for the live integration tests only (never printed, never used by the app itself). */
  OCTOPOS_SANDBOX_URL: z.string().optional(),
  OCTOPOS_SANDBOX_AUTH: z.string().optional(),

  /** Build identifier reported by GET /api/health (the git short SHA baked into the Docker image). */
  APP_VERSION: z.string().optional(),
  /** Run pending migrations before listening. Unset → on in production (container start), off elsewhere. */
  MIGRATE_ON_START: z.enum(['0', '1', 'true', 'false']).optional(),
}).superRefine((value, ctx) => {
  if (value.MAIL_PROVIDER === 'resend' && !value.RESEND_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['RESEND_API_KEY'], message: 'RESEND_API_KEY is required when MAIL_PROVIDER=resend' });
  }
  if (value.NODE_ENV === 'production') {
    if (value.MAIL_PROVIDER === 'log' && !value.ALLOW_LOG_MAIL) {
      ctx.addIssue({
        code: 'custom',
        path: ['MAIL_PROVIDER'],
        message: 'MAIL_PROVIDER=log would write magic links and password resets to the logs; set resend (or ALLOW_LOG_MAIL=1 knowingly)',
      });
    }
    if (!value.PAYMENTS_ENCRYPTION_KEY) {
      ctx.addIssue({ code: 'custom', path: ['PAYMENTS_ENCRYPTION_KEY'], message: 'PAYMENTS_ENCRYPTION_KEY is required in production (openssl rand -base64 32)' });
    }
    if (value.POS_MOCK) {
      ctx.addIssue({ code: 'custom', path: ['POS_MOCK'], message: 'POS_MOCK must be off in production (fake fiscal receipts)' });
    }
    if (value.PAYMENTS_MOCK) {
      ctx.addIssue({ code: 'custom', path: ['PAYMENTS_MOCK'], message: 'PAYMENTS_MOCK must be off in production (the simulator accepts payments without a bank)' });
    }
    if (value.JWT_ACCESS_SECRET.length < 32 || /change-me|replace-me|example|secret/i.test(value.JWT_ACCESS_SECRET)) {
      ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'JWT_ACCESS_SECRET must be a random value of at least 32 characters in production' });
    }
  }
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
  // Outside production a missing key falls back to one derived from the JWT secret, so dev/test need no extra set-up.
  PAYMENTS_ENCRYPTION_KEY: raw.PAYMENTS_ENCRYPTION_KEY ?? `dev-${raw.JWT_ACCESS_SECRET}`,
  DATABASE_URL: databaseUrl,
  API_URL: apiUrl,
  APP_VERSION: raw.APP_VERSION ?? 'dev',
  migrateOnStart:
    raw.MIGRATE_ON_START === undefined ? raw.NODE_ENV === 'production' : raw.MIGRATE_ON_START === '1' || raw.MIGRATE_ON_START === 'true',
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
