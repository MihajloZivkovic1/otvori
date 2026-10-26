import { DEFAULT_TAX_LABEL, type PosConfigDto } from '@qr-menu/shared';
import { env } from '../../config/env.js';
import type { Restaurant, StoredPosConfig } from '../../db/models/restaurant.model.js';
import { decryptSecret } from '../../utils/crypto.js';
import type { PosCredentials } from './providers/types.js';

/** `restaurants.pos_config` with defaults filled in (older rows may still carry keys the API dropped). */
export function storedPosConfig(restaurant: Pick<Restaurant, 'posConfig'>): StoredPosConfig {
  const stored = (restaurant.posConfig ?? {}) as Partial<StoredPosConfig>;
  return {
    provider: stored.provider ?? null,
    mode: stored.mode ?? 'pos',
    baseUrl: stored.baseUrl ?? null,
    apiKeyEncrypted: stored.apiKeyEncrypted ?? null,
    taxLabel: stored.taxLabel ?? DEFAULT_TAX_LABEL,
    taxNumber: stored.taxNumber ?? null,
    tableMapping: stored.tableMapping ?? {},
    sendOrdersToPos: stored.sendOrdersToPos ?? false,
    closeOnPayment: stored.closeOnPayment ?? true,
    closeStrategy: stored.closeStrategy ?? 'reissue',
    payPaymentTypeId: stored.payPaymentTypeId ?? null,
  };
}

export function toPosConfigDto(restaurant: Pick<Restaurant, 'posConfig'>): PosConfigDto {
  const config = storedPosConfig(restaurant);
  return {
    provider: config.provider,
    mode: config.mode,
    baseUrl: config.baseUrl,
    hasApiKey: Boolean(config.apiKeyEncrypted),
    taxLabel: config.taxLabel,
    taxNumber: config.taxNumber,
    tableMapping: config.tableMapping,
    sendOrdersToPos: config.sendOrdersToPos,
    closeOnPayment: config.closeOnPayment,
    closeStrategy: config.closeStrategy,
    payPaymentTypeId: config.payPaymentTypeId,
    simulator: config.provider === 'mock' && env.POS_MOCK,
  };
}

export function posCredentialsOf(restaurant: Pick<Restaurant, 'posConfig'>): PosCredentials {
  const config = storedPosConfig(restaurant);
  return { baseUrl: config.baseUrl, apiKey: config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : null };
}

/** True when the venue points at the Octopos sandbox: ExternalIds get the `otvori-dev-` prefix there. */
export function isSandbox(config: Pick<StoredPosConfig, 'provider' | 'baseUrl'>): boolean {
  return config.provider === 'mock' || /sandbox\./i.test(config.baseUrl ?? '');
}
