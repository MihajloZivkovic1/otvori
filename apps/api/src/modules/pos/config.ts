import type { PosConfigDto } from '@qr-menu/shared';
import { env } from '../../config/env.js';
import type { Restaurant, StoredPosConfig } from '../../db/models/restaurant.model.js';
import { decryptSecret } from '../../utils/crypto.js';
import type { PosCredentials } from './providers/types.js';

/** `restaurants.pos_config` with defaults filled in. */
export function storedPosConfig(restaurant: Pick<Restaurant, 'posConfig'>): StoredPosConfig {
  return {
    provider: null,
    baseUrl: null,
    apiKeyEncrypted: null,
    tableMapping: {},
    sendOrdersToPos: false,
    closeOnPayment: true,
    printOnClose: false,
    closeMode: 'reuse-external-id',
    ...(restaurant.posConfig ?? {}),
  };
}

export function toPosConfigDto(restaurant: Pick<Restaurant, 'posConfig'>): PosConfigDto {
  const config = storedPosConfig(restaurant);
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    hasApiKey: Boolean(config.apiKeyEncrypted),
    tableMapping: config.tableMapping,
    sendOrdersToPos: config.sendOrdersToPos,
    closeOnPayment: config.closeOnPayment,
    printOnClose: config.printOnClose,
    closeMode: config.closeMode,
    simulator: config.provider === 'mock' && env.POS_MOCK,
  };
}

export function posCredentialsOf(restaurant: Pick<Restaurant, 'posConfig'>): PosCredentials {
  const config = storedPosConfig(restaurant);
  return { baseUrl: config.baseUrl, apiKey: config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : null };
}
