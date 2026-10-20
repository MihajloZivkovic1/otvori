import { afterAll, beforeEach } from 'vitest';
import { sequelize } from '../src/db/sequelize.js';
import { resetDatabase } from './helpers.js';

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await sequelize.close();
});
