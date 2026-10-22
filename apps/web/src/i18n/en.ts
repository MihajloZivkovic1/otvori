import { brand, links } from '../config';
import type { Dictionary } from './types';

export const en: Dictionary = {
  htmlLang: 'en',
  ogLocale: 'en_US',
  tagline: 'Scan. Open. Order.',
  meta: {
    title: 'otvori — a digital menu and table ordering for cafés, kafanas and restaurants',
    description:
      'Guests scan the code on the table, open the menu and order. You change prices from your phone, orders reach the waiter. 30 days free, no card needed.',
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
    h: 'Scan the code. Open the menu. Order.',
    sub: 'Guests scan the code on the table and see your menu in two seconds. You change prices from your phone, and orders reach the waiter.',
    cta: 'Try it free for 30 days',
    demo: 'See the demo menu',
    note: 'No card needed. Cancel whenever you like.',
    cardCaption: 'Scan for the menu',
  },
  guest: {
    tagline: 'Specialty coffee & breakfast',
    table: 'Table',
    hours: 'Kitchen until 16:00',
    cat1: 'Coffee',
    cat2: 'Breakfast',
    cat3: 'Pastries',
    items: 'items',
    cartItems: '2 items',
    send: 'Send to the waiter',
  },
  proof: 'On tables in Belgrade, Novi Sad and Niš',
  how: {
    h: 'Three steps for the guest. No app.',
    steps: [
      {
        title: 'Scan',
        text: 'Guests point their camera at the code on the table. Nothing to install, no sign-up, no need for your Wi-Fi.',
      },
      {
        title: 'Open',
        text: 'The menu opens in the browser in two seconds, in Serbian or English, with today’s prices.',
      },
      {
        title: 'Order',
        text: 'Guests pick their dishes, add a note and send. The order lands on the waiter’s phone with the table number.',
        sub: 'Or they just browse — you switch ordering on whenever you like.',
      },
    ],
  },
  features: {
    h: 'What you need during a shift. Nothing more.',
    order: {
      table: 'Table 7',
      status: 'New',
      time: '1 min ago',
      lines: ['2 × Flat white', '1 × Avocado toast'],
      note: '“No sugar, please.”',
      accept: 'Accept',
      reject: 'Reject',
    },
    call: { call: 'Call the waiter', bill: 'Bill', notified: 'The waiter has been notified' },
    f1: {
      title: 'Orders land on the waiter’s phone',
      text: 'Guests choose from the menu and send. The waiter sees the table, the items and the note, accepts with one tap and brings it over.',
    },
    f2: {
      title: 'Call the waiter or ask for the bill with one tap',
      text: 'Two buttons at the bottom of the menu. The waiter gets a notification with the table number, the guest sees it arrived.',
    },
    rest: [
      {
        title: 'Change a price in 10 seconds',
        text: 'Change the number, press Publish. Guests see the new price right away.',
      },
      {
        title: 'A “not today” switch that resets itself at 06:00',
        text: 'Ran out of a dish? Switch it off with one tap. In the morning it is back on the menu without you lifting a finger.',
      },
      { title: 'Serbian and English from one code', text: 'Guests pick the language. Same code, same prices.' },
      { title: 'Allergens and labels (vegan, spicy, new)', text: 'Per item, so nobody has to ask the waiter.' },
      { title: 'Your logo and colours', text: 'The menu looks like your place, not like our software.' },
      {
        title: 'Who looks and who orders, per table',
        text: 'See which tables scan, what gets ordered and when it gets busy.',
      },
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
      'Table ordering and call-the-waiter',
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
        q: 'Do I have to turn ordering on?',
        a: 'No. You choose: menu only, menu with call-the-waiter, or full ordering. When it gets busy you pause it with one switch and the menu keeps working.',
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
        a: 'Open otvori.menu on your phone, change the price, press Publish. When something runs out, flip “Not today”. The dish comes back on the menu by itself at 06:00.',
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
  cta: { h: 'Open the menu on every table.' },
  footer: {
    desc: 'A digital menu and table ordering for cafés, kafanas and restaurants. Guests scan, open and order.',
    contact: 'Contact',
    links: [
      { label: 'Pricing', href: '#cene' },
      { label: 'FAQ', href: '#pitanja' },
      { label: 'Sign in', href: links.signIn },
      { label: 'Terms', href: links.terms },
      { label: 'Privacy', href: links.privacy },
    ],
    copyright: `© ${brand.foundingYear} ${brand.domain} · Belgrade`,
  },
  card: {
    logo: 'YOUR LOGO',
    note: 'Print on 300 g matte stock, 90 × 90 mm, single-sided. The link under the code is for phones without a reader.',
  },
  langSwitch: { label: 'Language', sr: 'Srpski', en: 'English' },
};
