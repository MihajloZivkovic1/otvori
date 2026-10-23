export type Locale = 'sr' | 'en';

export interface Step {
  title: string;
  text: string;
  /** Optional second line under the text (step 3: "or just browse"). */
  sub?: string;
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
  /** "Skeniraj. Otvori. Naruči." — the brand line used on the QR card, the OG image and the hero scene. */
  tagline: string;
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
  hero: { h: string; sub: string; cta: string; demo: string; note: string };
  guest: {
    tagline: string;
    table: string;
    hours: string;
    cat1: string;
    cat2: string;
    cat3: string;
    items: string;
    cartItems: string;
    send: string;
  };
  proof: string;
  how: { h: string; steps: [Step, Step, Step] };
  features: {
    h: string;
    /** Waiter-screen mock in the "orders" card. */
    order: {
      table: string;
      status: string;
      time: string;
      lines: [string, string];
      note: string;
      accept: string;
      reject: string;
    };
    /** Guest call bar mock in the "call waiter" card. */
    call: { call: string; bill: string; notified: string };
    f1: Feature;
    f2: Feature;
    rest: [Feature, Feature, Feature, Feature, Feature, Feature];
    /** Online payment card — rendered only when the site is built with FEATURE_PAYMENTS=true (src/features.ts). */
    payments: Feature;
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
  /** `payments` is appended to `items` only when the payments feature is on at build time. */
  faq: { h: string; sub: string; items: Faq[]; payments: Faq };
  cta: { h: string };
  footer: { desc: string; contact: string; links: { label: string; href: string }[]; copyright: string };
  card: { logo: string; note: string };
  langSwitch: { label: string; sr: string; en: string };
}
