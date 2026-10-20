import { brand, links } from '../config';
import type { Dictionary } from './types';

export const en: Dictionary = {
  htmlLang: 'en',
  ogLocale: 'en_US',
  meta: {
    title: 'salveta — a digital menu for cafés, kafanas and restaurants',
    description:
      'Guests scan the QR code on the table and see your menu in two seconds. Change prices from your phone, no reprinting. 30 days free, no card needed.',
  },
  nav: {
    how: 'How it works',
    features: 'What you get',
    pricing: 'Pricing',
    faq: 'FAQ',
    signIn: 'Sign in',
    tryFree: 'Try it free',
    menu: 'Menu',
    close: 'Close',
  },
  hero: {
    h: 'Everything good is written on a napkin.',
    sub: 'Guests scan the code on the table and see your menu in two seconds. You change prices from your phone, with nothing to reprint.',
    cta: 'Try it free for 30 days',
    demo: 'See the demo menu',
    note: 'No card needed. Cancel whenever you like.',
    napkinCaption: 'scan for the menu',
  },
  guest: {
    tagline: 'Specialty coffee & breakfast',
    table: 'Table',
    hours: 'Kitchen until 16:00',
    cat1: 'Coffee',
    cat2: 'Breakfast',
    cat3: 'Pastries',
    items: 'items',
  },
  proof: 'On tables in Belgrade, Novi Sad and Niš',
  how: {
    h: 'Three steps. Done in an afternoon.',
    steps: [
      {
        title: 'Enter your menu (or let us do it)',
        text: 'Categories, dishes, prices. Send us your old menu and we take care of the rest.',
      },
      { title: 'Put the code on the table', text: 'Print it yourself or let us bring ready-made cards.' },
      { title: 'Guests scan and read', text: 'No app to install. It opens in the browser in two seconds.' },
    ],
  },
  features: {
    h: 'What you need during a shift. Nothing more.',
    editor: { item: 'Item', price: 'Price', available: 'Available', publish: 'Publish' },
    unavailable: { title: 'Not today', done: 'Done', back: 'Everything comes back at 06:00.', until: 'until 06:00' },
    f1: {
      title: 'Change a price in 10 seconds',
      text: 'Change the number, press Publish. Guests see the new price right away.',
    },
    f2: {
      title: 'A “not today” switch that resets itself at 06:00',
      text: 'Ran out of a dish? Switch it off with one tap. In the morning it is back on the menu without you lifting a finger.',
    },
    rest: [
      { title: 'Serbian and English from one code', text: 'Guests pick the language. Same code, same prices.' },
      { title: 'Allergens and labels (vegan, spicy, new)', text: 'Per item, so nobody has to ask the waiter.' },
      { title: 'Your logo and colours', text: 'The menu looks like your place, not like our software.' },
      { title: 'Who looks at what, per table', text: 'See which tables scan and when it gets busy.' },
    ],
  },
  setup: {
    eyebrow: 'Menu entry and QR cards',
    h: 'No time? We come to you.',
    p: 'We visit your venue, enter the whole menu with photos and an English translation, and leave printed QR stands and cards on every table. You only confirm the prices.',
    cta: 'Request a quote',
    price: 'One-off, from 6,000 RSD. Depends on the number of tables.',
    list: [
      'Full menu entry with photos',
      'English translation',
      'A QR card and stand for every table, printed and delivered',
      'A 15-minute walkthrough for your staff',
    ],
    logo: 'LOGO',
  },
  pricing: {
    h: 'One price a month. No fine print.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    twoFree: '2 months free',
    perMonth: 'RSD / month',
    perYear: 'RSD / year',
    popular: 'Most popular',
    starterFor: 'One venue',
    proFor: 'Several venues or more languages',
    starterList: [
      'One venue',
      'Unlimited menu items',
      'QR codes for every table',
      'Serbian + English',
      'Basic statistics',
    ],
    proList: [
      'Several venues under one account',
      'More languages',
      'Branding: your logo and colours',
      'Advanced statistics by table and hour',
      'Priority support',
    ],
    trialNote: '30 days free, no card needed.',
    setupLine: 'Menu entry and QR table cards: from 6,000 RSD one-off, depending on the number of tables.',
    toggleLabel: 'Billing period',
  },
  faq: {
    h: 'Questions everyone asks us',
    sub: 'Something else? Write to',
    items: [
      {
        q: 'Do guests need to install an app?',
        a: 'No. They point the camera at the code and the menu opens in the browser. No download, no sign-up.',
      },
      {
        q: 'What if the internet at my venue is weak?',
        a: 'Guests use their own mobile data, not your Wi-Fi. The menu is light and opens even on a weak signal. Keep a couple of printed menus around just in case.',
      },
      {
        q: 'Can I have more than one venue?',
        a: 'Yes, on the Pro plan. All venues sit under one account, each with its own menu, codes and statistics.',
      },
      {
        q: 'How do I change prices, and what happens when something runs out?',
        a: 'Open salveta on your phone, change the price, press Publish. When something runs out, flip “Not today”. The dish comes back on the menu by itself at 06:00.',
      },
      {
        q: 'Does it work on older phones?',
        a: 'Yes. Any phone with a camera and a browser will do, which is everything made since 2017. There is also a short link under the code for phones without a QR reader.',
      },
      {
        q: 'How do I cancel?',
        a: 'One click in settings. No phone call, no notice period. The menu stays live until the end of the paid period.',
      },
    ],
  },
  cta: { h: 'Put a napkin on the table.' },
  footer: {
    desc: 'A digital menu for cafés, kafanas and restaurants. Guests scan, you change prices from your phone.',
    contact: 'Contact',
    links: [
      { label: 'Pricing', href: '#cene' },
      { label: 'FAQ', href: '#pitanja' },
      { label: 'Sign in', href: links.signIn },
      { label: 'Terms', href: links.terms },
      { label: 'Privacy', href: links.privacy },
    ],
    copyright: `© ${brand.foundingYear} salveta.menu · Belgrade`,
  },
  og: { sub: 'A digital menu for cafés and kafanas. Guests scan, you change prices from your phone.' },
  card: {
    logo: 'YOUR LOGO',
    note: 'Print on 300 g matte stock, single-sided. The cut corner at the bottom right is part of the napkin shape. The link under the code is for phones without a reader.',
    tagline: 'Everything good is written on a napkin.',
  },
  langSwitch: { label: 'Language', sr: 'Srpski', en: 'English' },
};
