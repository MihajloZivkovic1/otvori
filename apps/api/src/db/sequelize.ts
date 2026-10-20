import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { allModels } from './models/index.js';

export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: env.LOG_LEVEL === 'trace' ? (sql: string) => logger.trace(sql) : false,
  models: allModels,
  define: { underscored: true },
  pool: { max: env.isTest ? 5 : 10, min: 0, idle: 10_000, acquire: 30_000 },
  ...(env.DATABASE_SSL ? { dialectOptions: { ssl: { require: true, rejectUnauthorized: false } } } : {}),
});
