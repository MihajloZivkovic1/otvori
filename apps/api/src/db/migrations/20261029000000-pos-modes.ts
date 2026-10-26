import { DataTypes, type QueryInterface } from 'sequelize';
import type { MigrationFn } from 'umzug';

type Migration = MigrationFn<QueryInterface>;

/**
 * Phase 12 — Octopos integration verified on the sandbox: ESIR and POS modes. `orders.fiscal_issued_at` keeps the
 * PFR time of the receipt (`SdcDateTime`) for the PDF; existing POS configurations were POS-style (open on a table,
 * close on payment), so they get `mode: 'pos'` plus the new defaults, and the two options the API never had
 * (`closeMode`, `printOnClose`) are dropped.
 */
export const up: Migration = async ({ context: qi }) => {
  await qi.addColumn('orders', 'fiscal_issued_at', { type: DataTypes.DATE, allowNull: true });
  await qi.sequelize.query(`
    UPDATE restaurants
    SET pos_config = '{"mode":"pos","taxLabel":"Ђ","taxNumber":null,"closeStrategy":"reissue","payPaymentTypeId":null}'::jsonb
      || (pos_config - 'closeMode' - 'printOnClose')
    WHERE pos_config IS NOT NULL
  `);
};

export const down: Migration = async ({ context: qi }) => {
  await qi.sequelize.query(`
    UPDATE restaurants
    SET pos_config = '{"closeMode":"reuse-external-id","printOnClose":false}'::jsonb
      || (pos_config - 'mode' - 'taxLabel' - 'taxNumber' - 'closeStrategy' - 'payPaymentTypeId')
    WHERE pos_config IS NOT NULL
  `);
  await qi.removeColumn('orders', 'fiscal_issued_at');
};
