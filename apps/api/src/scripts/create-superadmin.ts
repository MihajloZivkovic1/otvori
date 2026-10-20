import 'reflect-metadata';
import { emailSchema, passwordSchema } from '@qr-menu/shared';
import { User } from '../db/models/index.js';
import { sequelize } from '../db/sequelize.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../utils/password.js';

/**
 * Creates (or promotes) a superadmin: `npm run create-superadmin -- <email> <password>`.
 * Inside the production container: `docker compose exec api npm run create-superadmin -- admin@salveta.menu '<password>'`.
 * An existing user keeps their name and memberships; their password is replaced and isSuperadmin set.
 */
async function main(): Promise<void> {
  const [rawEmail, rawPassword] = process.argv.slice(2);
  if (!rawEmail || !rawPassword) {
    process.stderr.write('Usage: npm run create-superadmin -- <email> <password>\n');
    process.exit(2);
  }
  const email = emailSchema.parse(rawEmail);
  const password = passwordSchema.parse(rawPassword);
  const passwordHash = await hashPassword(password);

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    await existing.update({ isSuperadmin: true, passwordHash });
    process.stdout.write(`Updated ${email}: now a superadmin, password replaced.\n`);
  } else {
    await User.create({ email, name: 'salveta admin', passwordHash, isSuperadmin: true });
    process.stdout.write(`Created superadmin ${email}.\n`);
  }
  await sequelize.close();
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'create-superadmin failed');
  process.exit(1);
});
