import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/setup.ts'],
    // All test files share one Postgres database; run them sequentially.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      JWT_ACCESS_SECRET: 'test-only-secret-not-for-production',
      PAYMENTS_MOCK: 'true',
      POS_MOCK: 'true',
      PAYMENTS_ENCRYPTION_KEY: 'test-only-encryption-key-32-bytes!!',
      JWT_ACCESS_TTL_SECONDS: '900',
      PUBLIC_MENU_BASE_URL: 'http://{slug}.localhost:5174',
      API_URL: 'http://localhost:3000',
      UPLOADS_DIR: path.join(os.tmpdir(), 'tabla-test-uploads'),
    },
  },
});
