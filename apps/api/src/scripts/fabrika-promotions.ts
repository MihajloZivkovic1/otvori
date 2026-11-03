import type { PromotionBody, PromotionDisplay } from '@qr-menu/shared';

export type SeedPromotion = PromotionBody & { title: string; display: PromotionDisplay; accentColor?: string; priority?: number; linkUrl?: string; linkLabel?: string };

/** Fabrika's delivery partner page (Ali Deda, Stara Pazova). */
export const FABRIKA_DELIVERY_URL = 'https://www.alideda.rs/fabrika-kafeterija-dostava-stara-pazova';

/** Fabrika Kafeterija's printed cocktail card (design/cocktail-menu.pdf), rendered by the drink_list template. */
export const FABRIKA_PROMOTIONS: SeedPromotion[] = [
  {
    title: 'Cocktail Menu',
    template: 'drink_list',
    display: 'banner',
    accentColor: '#E8453C',
    priority: 10,
    content: {
      logoText: 'Fabrika Kafeterija',
      columns: 2,
      entries: [
        { name: 'Negroni', lines: ['Beefeater gin', 'Campari liker', 'Martini Rosso vermut'] },
        { name: 'Hugo', lines: ['Penušavo vino', 'Sirup od zove', 'Sok od limete', 'Listovi nane'] },
        { name: 'Espresso Martini', lines: ['Kahlua', 'Smirnoff vodka', 'Espresso'] },
        { name: 'Mohito', lines: ['Bacardi rum', 'Limeta', 'Nana', 'Soda', 'Šećerni sirup'] },
        { name: 'Aperol Spritz', lines: ['Aperol liker', 'Penušavo vino', 'Soda voda'] },
        { name: 'Irish Coffee', lines: ['Jameson', 'Dupli espresso', 'Žuti šećer', 'Šlag'] },
        { name: 'Strawberry Splash', lines: ['Bacardi rum', 'Monin pire jagoda', 'Limeta'] },
        { name: 'Tropical Breeze', lines: ['Beefeater gin', 'Monin pire marakuja', 'Monin pire breskva', 'Limunov sok', 'Soda voda', 'Protein'] },
        { name: 'Raspberry Sparkle', lines: ['Beefeater gin', 'Monin pire malina', 'Limunov sok', 'Soda voda'] },
        { name: 'Minty Flower Fizz', lines: ['Beefeater gin', 'Sirup od zove', 'Listovi nane', 'Limunov sok', 'Soda voda'] },
        { name: 'Golden Passion', lines: ['Olmeca tequila', 'Monin liker Triple Sec', 'Limunov sok', 'Monin pire marakuja', 'Sok od pomorandže', 'Soda voda'] },
        { name: 'Pink Panther', lines: ['Olmeca tequila', 'Limunov sok', 'Monin pire jagoda', 'Sok od ananasa'] },
      ],
    },
  },
  /** The owner's own notice on the live venue (upserted by this exact title): takeaway + delivery through Ali Deda. */
  {
    title: 'Sva pića mogu za poneti i dostava preko Alidede',
    template: 'notice',
    display: 'modal',
    priority: 5,
    linkUrl: FABRIKA_DELIVERY_URL,
    linkLabel: 'Naruči dostavu',
    content: {
      headline: 'Sva pića mogu da se uzmu za poneti i takodje naručiti za dostavu preko Alidede',
      body: 'Naručiti i preuzeti za šankom, dostava na kućnu adresu preko alidede.',
    },
  },
];
