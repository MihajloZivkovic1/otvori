import { DEFAULT_TIP_PRESETS, type PaymentConfigDto } from '@qr-menu/shared';
import { env } from '../../config/env.js';
import type { Restaurant, StoredPaymentConfig } from '../../db/models/restaurant.model.js';
import { decryptSecret } from '../../utils/crypto.js';
import type { MerchantCredentials } from './providers/types.js';

/** `restaurants.payment_config` with defaults filled in (older rows may miss keys). */
export function storedConfig(restaurant: Pick<Restaurant, 'paymentConfig'>): StoredPaymentConfig {
  return {
    provider: null,
    merchantId: null,
    secretEncrypted: null,
    tipPresets: [...DEFAULT_TIP_PRESETS],
    receiptEmailEnabled: false,
    ...(restaurant.paymentConfig ?? {}),
  };
}

/** What clients see: never the secret, only whether one is set. */
export function toPaymentConfigDto(restaurant: Pick<Restaurant, 'paymentConfig'>): PaymentConfigDto {
  const config = storedConfig(restaurant);
  return {
    provider: config.provider,
    merchantId: config.merchantId,
    hasSecret: Boolean(config.secretEncrypted),
    tipPresets: config.tipPresets,
    receiptEmailEnabled: config.receiptEmailEnabled,
    simulator: config.provider === 'mock' && env.PAYMENTS_MOCK,
  };
}

/** Decrypted credentials for a provider call. */
export function credentialsOf(restaurant: Pick<Restaurant, 'paymentConfig'>): MerchantCredentials {
  const config = storedConfig(restaurant);
  return { merchantId: config.merchantId, secret: config.secretEncrypted ? decryptSecret(config.secretEncrypted) : null };
}
