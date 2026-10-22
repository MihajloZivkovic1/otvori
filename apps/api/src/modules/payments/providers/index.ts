import type { PaymentProviderKey } from '@qr-menu/shared';
import { env } from '../../../config/env.js';
import { AppError } from '../../../utils/errors.js';
import { mockProvider } from './mock.js';
import { otpProvider } from './otp.js';
import type { PaymentProvider } from './types.js';

const providers: Record<PaymentProviderKey, PaymentProvider> = { mock: mockProvider, otp: otpProvider };

/** The provider implementation for a key; the mock one only exists while PAYMENTS_MOCK is on. */
export function paymentProvider(key: PaymentProviderKey | null | undefined): PaymentProvider {
  if (!key) throw new AppError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Online payment is not set up for this venue');
  if (key === 'mock' && !env.PAYMENTS_MOCK) {
    throw new AppError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'The payment simulator is off on this server');
  }
  return providers[key];
}

export function isPaymentProviderKey(value: string): value is PaymentProviderKey {
  return value in providers;
}

export type { PaymentProvider } from './types.js';
