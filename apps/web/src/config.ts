/** Every outbound link and contact on the marketing site. Change them here. */
export const links = {
  signIn: 'https://app.salveta.menu/login',
  register: 'https://app.salveta.menu/register',
  demoMenu: 'https://kafeterija.salveta.menu/t/1',
  /** "Zatraži ponudu" — a mailto until there is a form. */
  quote: 'mailto:zdravo@salveta.menu?subject=Ponuda%20za%20unos%20menija',
  terms: '#',
  privacy: '#',
} as const;

export const contact = {
  email: 'zdravo@salveta.menu',
  city: 'Beograd',
} as const;

export const brand = {
  name: 'salveta',
  domain: 'salveta.menu',
  plum: '#7A3E48',
  paper: '#F7F2EB',
  foundingYear: 2026,
} as const;

/** Prices in RSD; yearly = 10 × monthly ("2 meseca gratis"). */
export const pricing = {
  currency: 'RSD',
  starter: { monthly: 1490, yearly: 14900 },
  pro: { monthly: 2990, yearly: 29900 },
} as const;
