import type { QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/** Phase 9d follow-up — "Issued at the register": staff closed the receipt by hand, no retry, nothing for the guest. */
export const up: Migration = async ({ context: qi }) => {
  await qi.sequelize.query(`ALTER TYPE "enum_orders_fiscal_status" ADD VALUE IF NOT EXISTS 'manual'`);
};

export const down: Migration = async () => {
  // Postgres cannot drop an enum value; rows with 'manual' would have to be rewritten first. Left in place.
};
