import 'reflect-metadata';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { QueryInterface } from 'sequelize';
import { SequelizeStorage, Umzug, type MigrationFn } from 'umzug';
import { logger } from '../utils/logger.js';
import { sequelize } from './sequelize.js';

const currentFile = fileURLToPath(import.meta.url);
const here = path.dirname(currentFile);
// ".ts" when run through tsx (dev/test), ".js" when run from dist/.
const ext = path.extname(currentFile);

interface MigrationModule {
  up: MigrationFn<QueryInterface>;
  down: MigrationFn<QueryInterface>;
}

export const migrator = new Umzug<QueryInterface>({
  migrations: {
    glob: [`migrations/*${ext}`, { cwd: here }],
    resolve: ({ name, path: filePath, context }) => {
      const load = () => import(pathToFileURL(filePath as string).href) as Promise<MigrationModule>;
      const params = { name, path: filePath, context };
      return {
        // Stored without the extension so dev (.ts) and prod (.js) agree on names.
        name: name.replace(/\.(ts|js)$/, ''),
        path: filePath,
        up: async () => (await load()).up(params),
        down: async () => (await load()).down(params),
      };
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'sequelize_meta' }),
  logger: {
    info: (message) => logger.info(message),
    warn: (message) => logger.warn(message),
    error: (message) => logger.error(message),
    debug: (message) => logger.debug(message),
  },
});

export async function runMigrations(): Promise<void> {
  await migrator.up();
}

const isMain = process.argv[1] ? path.resolve(process.argv[1]) === currentFile : false;
if (isMain) {
  migrator
    .runAsCLI()
    .then(async (ok) => {
      await sequelize.close();
      process.exit(ok ? 0 : 1);
    })
    .catch(async (error) => {
      logger.error({ err: error }, 'Migration failed');
      await sequelize.close();
      process.exit(1);
    });
}
