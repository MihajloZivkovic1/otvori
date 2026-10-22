import type { PosProviderKey } from '@qr-menu/shared';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/errors.js';
import { mockPosProvider } from './mock.js';
import { octoposProvider } from './octopos.js';
import type { PosProvider } from './types.js';

const providers: Record<PosProviderKey, PosProvider> = { mock: mockPosProvider, octopos: octoposProvider };

/** The register implementation for a key; the mock one only exists while POS_MOCK is on. */
export function posProvider(key: PosProviderKey | null | undefined): PosProvider {
  if (!key) throw new AppError(503, 'POS_UNAVAILABLE', 'The POS integration is not set up for this venue');
  if (key === 'mock' && !env.POS_MOCK) throw new AppError(503, 'POS_UNAVAILABLE', 'The mock register is off on this server');
  return providers[key];
}

export type { PosProvider } from './types.js';
