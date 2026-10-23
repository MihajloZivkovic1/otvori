/**
 * Build-time feature flags of the marketing site (Phase 10). The copy for online payment is written and translated,
 * but the section only renders when the Caddy image is built with FEATURE_PAYMENTS=true (→ PUBLIC_FEATURE_PAYMENTS);
 * `main` builds with it off until the bank integration is released.
 */
export function isPaymentsEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true' || value?.trim() === '1';
}

export const featurePayments = isPaymentsEnabled(import.meta.env.PUBLIC_FEATURE_PAYMENTS);
