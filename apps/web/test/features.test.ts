import { describe, expect, it } from 'vitest';
import { isPaymentsEnabled } from '../src/features';
import { en } from '../src/i18n/en';
import { sr } from '../src/i18n/sr';

describe('payments feature flag (build time)', () => {
  it('is off unless PUBLIC_FEATURE_PAYMENTS is exactly true/1', () => {
    expect(isPaymentsEnabled(undefined)).toBe(false);
    expect(isPaymentsEnabled('')).toBe(false);
    expect(isPaymentsEnabled('false')).toBe(false);
    expect(isPaymentsEnabled('true')).toBe(true);
    expect(isPaymentsEnabled('1')).toBe(true);
  });

  it('keeps the online-payment copy ready in both locales, outside the always-rendered lists', () => {
    for (const dict of [sr, en]) {
      expect(dict.features.payments.title.length).toBeGreaterThan(10);
      expect(dict.faq.payments.q.length).toBeGreaterThan(10);
      // Nothing in the default copy mentions online payment: it only appears behind the flag.
      const always = JSON.stringify({
        hero: dict.hero,
        features: { ...dict.features, payments: undefined },
        faq: dict.faq.items,
        pricing: dict.pricing,
      });
      expect(always).not.toMatch(/IPS|bankarsk|banking app|plaćanje telefonom|pay by phone/i);
    }
  });
});
