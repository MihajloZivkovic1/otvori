import 'dotenv/config';
import pg from 'pg';

/** Creates the test database if needed and runs all migrations once before the test files start. */
export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'silent';
  process.env.JWT_ACCESS_SECRET ??= 'test-only-secret-not-for-production';
  process.env.DATABASE_URL ??= 'postgres://tabla:tabla@localhost:5432/tabla';

  const { env } = await import('../src/config/env.js');
  await ensureDatabase(env.DATABASE_URL);

  const { runMigrations } = await import('../src/db/migrate.js');
  await runMigrations();
  const { sequelize } = await import('../src/db/sequelize.js');
  await sequelize.close();
}

async function ensureDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const dbName = decodeURIComponent(target.pathname.slice(1));
  const admin = new URL(url);
  admin.pathname = '/postgres';
  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await client.end();
  }
}
