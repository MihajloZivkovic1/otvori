import { describe, expect, it } from 'vitest';
import { pricing } from '../src/config';
import { en } from '../src/i18n/en';
import { sr } from '../src/i18n/sr';
import { faqItems, faqPageSchema, organizationSchema, softwareSchema } from '../src/seo';

const site = new URL('https://otvori.menu');

describe('structured data', () => {
  it('builds the FAQPage from the same entries the page renders', () => {
    for (const dict of [sr, en]) {
      const items = faqItems(dict);
      const schema = faqPageSchema(items);
      expect(schema['@type']).toBe('FAQPage');
      expect(schema.mainEntity).toHaveLength(items.length);
      expect(schema.mainEntity[0]).toEqual({
        '@type': 'Question',
        name: items[0]!.q,
        acceptedAnswer: { '@type': 'Answer', text: items[0]!.a },
      });
    }
  });

  it('prices the two plans per month and lists the free trial', () => {
    const schema = softwareSchema({ site, canonical: 'https://otvori.menu/', description: 'x', locales: ['sr', 'en'] });
    const offers = schema.offers as { name: string; price: number; url: string }[];
    expect(offers.map((o) => [o.name, o.price])).toEqual([
      ['Starter', pricing.starter.monthly],
      ['Pro', pricing.pro.monthly],
      ['Free trial', 0],
    ]);
    expect(offers[0]!.url).toBe('https://otvori.menu/#cene');
    expect(JSON.stringify(schema)).toContain('"unitCode":"MON"');
    expect(JSON.stringify(schema)).toContain(`"value":${pricing.trialDays},"unitCode":"DAY"`);
  });

  it('names the organisation with its logo and city', () => {
    const schema = organizationSchema(site);
    expect(schema.logo).toBe('https://otvori.menu/icons/icon-512.png');
    expect(schema.address.addressCountry).toBe('RS');
  });
});
