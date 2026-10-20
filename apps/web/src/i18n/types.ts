export type Locale = 'sr' | 'en';

export interface Step {
  title: string;
  text: string;
}

export interface Feature {
  title: string;
  text: string;
}

export interface Faq {
  q: string;
  a: string;
}

export interface Dictionary {
  /** <html lang> and Open Graph locale. */
  htmlLang: string;
  ogLocale: string;
  meta: { title: string; description: string };
  nav: {
    how: string;
    features: string;
    pricing: string;
    faq: string;
    signIn: string;
    tryFree: string;
    menu: string;
    close: string;
  };
  hero: { h: string; sub: string; cta: string; demo: string; note: string; napkinCaption: string };
  guest: { tagline: string; table: string; hours: string; cat1: string; cat2: string; cat3: string; items: string };
  proof: string;
  how: { h: string; steps: [Step, Step, Step] };
  features: {
    h: string;
    editor: { item: string; price: string; available: string; publish: string };
    unavailable: { title: string; done: string; back: string; until: string };
    f1: Feature;
    f2: Feature;
    rest: [Feature, Feature, Feature, Feature];
  };
  setup: {
    eyebrow: string;
    h: string;
    p: string;
    cta: string;
    price: string;
    list: [string, string, string, string];
    logo: string;
  };
  pricing: {
    h: string;
    monthly: string;
    yearly: string;
    twoFree: string;
    perMonth: string;
    perYear: string;
    popular: string;
    starterFor: string;
    proFor: string;
    starterList: string[];
    proList: string[];
    trialNote: string;
    setupLine: string;
    toggleLabel: string;
  };
  faq: { h: string; sub: string; items: Faq[] };
  cta: { h: string };
  footer: { desc: string; contact: string; links: { label: string; href: string }[]; copyright: string };
  og: { sub: string };
  card: { logo: string; note: string; tagline: string };
  langSwitch: { label: string; sr: string; en: string };
}
