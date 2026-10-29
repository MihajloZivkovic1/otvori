/**
 * Structured data (JSON-LD) shared by the landing pages and the blog. Everything is derived from the same copy and
 * config the page renders (`i18n`, `config`), so the markup and the schema can never drift apart.
 */
import { featurePayments } from './features';
import { brand, contact, pricing } from './config';
import type { Dictionary, Faq } from './i18n/types';

/** The FAQ entries the page shows: the translated list, plus the online-payment question once that feature ships. */
export function faqItems(dict: Dictionary): Faq[] {
  return featurePayments ? [...dict.faq.items, dict.faq.payments] : dict.faq.items;
}

export function organizationSchema(site: URL) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    alternateName: brand.domain,
    url: site.href,
    logo: new URL('/icons/icon-512.png', site).href,
    email: contact.email,
    address: { '@type': 'PostalAddress', addressLocality: contact.city, addressCountry: 'RS' },
  };
}

const monthlyOffer = (name: string, price: number, url: string) => ({
  '@type': 'Offer',
  name,
  url,
  price,
  priceCurrency: pricing.currency,
  priceSpecification: {
    '@type': 'UnitPriceSpecification',
    price,
    priceCurrency: pricing.currency,
    referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
  },
});

/** SoftwareApplication with the two monthly plans and the free trial (`pricing.trialDays`). */
export function softwareSchema(opts: {
  site: URL;
  canonical: string;
  description: string;
  locales: readonly string[];
}) {
  const pricingUrl = opts.canonical + '#cene';
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: brand.name,
    alternateName: brand.domain,
    url: opts.site.href,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: opts.description,
    inLanguage: opts.locales,
    offers: [
      monthlyOffer('Starter', pricing.starter.monthly, pricingUrl),
      monthlyOffer('Pro', pricing.pro.monthly, pricingUrl),
      {
        '@type': 'Offer',
        name: 'Free trial',
        url: pricingUrl,
        price: 0,
        priceCurrency: pricing.currency,
        eligibleDuration: { '@type': 'QuantitativeValue', value: pricing.trialDays, unitCode: 'DAY' },
      },
    ],
  };
}

export function faqPageSchema(items: Faq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };
}
