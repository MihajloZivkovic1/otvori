import type { TranslatedText } from '@qr-menu/shared';
import { rsd, type CatalogCategory, type CatalogItem } from './menu-catalog.js';

/**
 * The real menu of Fabrika Kafeterija, transcribed from the venue's printed menu (four laminated sheets:
 * "Kafe", "Kafe 2 · čaj · sokovi · voda", "Rakije · pivo · vino · kokteli · kolači" and the "Fabrika Has" food
 * sheets "Sendviči / Stuffed fries" and "Burgeri / Umaci / Prilozi"). Coffee first, then food, then the rest of
 * the drinks — the order the owner asked for. Used by `seed-fabrika.ts`.
 */

const t = (sr: string, en: string): TranslatedText => ({ sr, en });

/** The four coffee blends the house serves; every espresso-based drink is priced per blend. */
const BLENDS = {
  b1: 'B1 · miks 4 arabike',
  b7: 'B7 · Brazil / Indija',
  k: 'K · kafa meseca',
  km: 'KM · Kolumbija Medelin',
} as const;

/** An espresso drink with a price per blend (B1, B7 and, when the house offers them, K and KM). */
function coffee(
  name: TranslatedText,
  description: TranslatedText,
  prices: { b1: number; b7: number; k?: number; km?: number },
  extra: Partial<CatalogItem> = {},
): CatalogItem {
  const variants = [
    { name: BLENDS.b1, priceCents: rsd(prices.b1) },
    { name: BLENDS.b7, priceCents: rsd(prices.b7) },
    ...(prices.k ? [{ name: BLENDS.k, priceCents: rsd(prices.k) }] : []),
    ...(prices.km ? [{ name: BLENDS.km, priceCents: rsd(prices.km) }] : []),
  ];
  return { name, description, priceCents: rsd(prices.b1), variants, variantLabel: t('Vrsta kafe', 'Coffee blend'), ...extra };
}

export const FABRIKA_COFFEE: CatalogCategory = {
  name: t('Kafa', 'Coffee'),
  items: [
    coffee(t('Espreso', 'Espresso'), t('25–30 ml', '25–30 ml'), { b1: 190, b7: 190, k: 200, km: 200 }),
    coffee(t('Ristreto', 'Ristretto'), t('20 ml, kraći i gušći espreso', '20 ml, a shorter, denser espresso'), { b1: 190, b7: 190, k: 200, km: 200 }),
    coffee(t('Dupli espreso', 'Double espresso'), t('50–60 ml', '50–60 ml'), { b1: 270, b7: 270, k: 280, km: 280 }),
    coffee(t('Makijato', 'Macchiato'), t('25–30 ml, espreso sa kapom mlečne pene', '25–30 ml, espresso with a cap of milk foam'), { b1: 200, b7: 200, k: 210, km: 210 }, { allergens: ['M'] }),
    coffee(t('Bebićino', 'Babyccino'), t('40 ml, topla mlečna pena bez kofeina', '40 ml, warm milk foam, no caffeine'), { b1: 200, b7: 200, k: 210, km: 210 }, { allergens: ['M'] }),
    coffee(t('Kapućino', 'Cappuccino'), t('180 ml, espreso, toplo mleko i gusta pena', '180 ml, espresso, steamed milk and thick foam'), { b1: 220, b7: 220, k: 230, km: 230 }, { allergens: ['M'] }),
    coffee(t('Kapućino XL', 'Cappuccino XL'), t('300 ml', '300 ml'), { b1: 310, b7: 310, k: 320, km: 320 }, { allergens: ['M'] }),
    coffee(t('Kafe late', 'Caffè latte'), t('200 ml, espreso sa puno toplog mleka', '200 ml, espresso with plenty of steamed milk'), { b1: 220, b7: 220, k: 230, km: 230 }, { allergens: ['M'] }),
    coffee(t('Late makijato', 'Latte macchiato'), t('250 ml, slojevito mleko, pena i espreso', '250 ml, layered milk, foam and espresso'), { b1: 250, b7: 250, k: 260, km: 260 }, { allergens: ['M'] }),
    coffee(
      t('Aromatizovani kafe late', 'Flavoured caffè latte'),
      t('200 ml, lešnik, karamela ili vanila · topla ili hladna', '200 ml, hazelnut, caramel or vanilla · hot or iced'),
      { b1: 290, b7: 290, k: 300, km: 300 },
      { allergens: ['M', 'N'] },
    ),
    coffee(t('Moka espreso', 'Mocha'), t('180 ml, espreso, čokolada i mleko · topla ili hladna', '180 ml, espresso, chocolate and milk · hot or iced'), { b1: 280, b7: 280, k: 290, km: 290 }, { allergens: ['M'] }),
    coffee(t('Kafa afogato', 'Affogato'), t('30 ml espresa preko kugle gelato sladoleda', 'A 30 ml shot of espresso poured over a scoop of gelato'), { b1: 270, b7: 270, k: 280, km: 280 }, { allergens: ['M'] }),
    coffee(t('Fredo hladni espreso', 'Freddo espresso'), t('250 ml, espreso umućen sa ledom', '250 ml, espresso shaken over ice'), { b1: 280, b7: 280 }),
    coffee(t('Fredo kapućino', 'Freddo cappuccino'), t('250 ml, fredo espreso sa hladnom mlečnom penom', '250 ml, freddo espresso topped with cold milk foam'), { b1: 310, b7: 310 }, { allergens: ['M'] }),
    coffee(t('Ledena kafa', 'Iced coffee'), t('250 ml, espreso, hladno mleko i led', '250 ml, espresso, cold milk and ice'), { b1: 290, b7: 290 }, { allergens: ['M'] }),
    coffee(t('Amerikano', 'Americano'), t('150 ml, espreso produžen vrelom vodom', '150 ml, espresso lengthened with hot water'), { b1: 270, b7: 270, k: 280, km: 280 }),
    { name: t('Nes frape', 'Nescafé frappé'), description: t('250 ml, hladna umućena nes kafa', '250 ml, cold whipped instant coffee'), priceCents: rsd(220), allergens: ['M'] },
    { name: t('Aromatizovani nes frape', 'Flavoured frappé'), description: t('250 ml, lešnik, karamela ili vanila', '250 ml, hazelnut, caramel or vanilla'), priceCents: rsd(270), allergens: ['M', 'N'] },
    { name: t('Topla čokolada', 'Hot chocolate'), description: t('Premium, crna ili bela', 'Premium, dark or white'), priceCents: rsd(250), allergens: ['M'], variantLabel: t('Vrsta', 'Type'), variants: [{ name: 'Crna', priceCents: rsd(250) }, { name: 'Bela', priceCents: rsd(250) }] },
    { name: t('Srpska kafa', 'Serbian coffee'), description: t('60 ml, kuvana u džezvi', '60 ml, brewed in a džezva'), priceCents: rsd(220) },
    { name: t('Mača late', 'Matcha latte'), description: t('Japanski zeleni čaj u prahu sa penastim mlekom', 'Japanese powdered green tea with frothed milk'), priceCents: rsd(400), allergens: ['M'] },
    { name: t('Biljno mleko', 'Plant milk'), description: t('Sojino ili bez laktoze, dodatak uz bilo koju kafu', 'Soy or lactose-free, added to any coffee'), priceCents: rsd(50), allergens: ['S'] },
    { name: t('Sveže mlevena domaća kafa 200 g', 'Freshly ground Serbian coffee, 200 g'), description: t('Za kuću, mlevena pred vama', 'To take home, ground in front of you'), priceCents: rsd(390) },
    { name: t('Espreso kafa 250 g', 'Espresso beans, 250 g'), description: t('U zrnu ili mlevena, za kuću', 'Whole bean or ground, to take home'), priceCents: rsd(1600) },
  ],
};

export const FABRIKA_BREWING: CatalogCategory = {
  name: t('Alternativne metode kuvanja kafe', 'Alternative brewing'),
  items: [
    { name: t('Sifon', 'Siphon'), description: t('200 ml, Etiopija Sidamo arabika, svetlo pržena', '200 ml, Ethiopia Sidamo arabica, light roast'), priceCents: rsd(450) },
    { name: t('V60', 'V60'), description: t('200 ml, Etiopija Sidamo arabika, svetlo pržena', '200 ml, Ethiopia Sidamo arabica, light roast'), priceCents: rsd(400) },
    { name: t('Kemeks', 'Chemex'), description: t('200 ml, Etiopija Sidamo arabika, svetlo pržena', '200 ml, Ethiopia Sidamo arabica, light roast'), priceCents: rsd(400) },
    { name: t('Frenč pres', 'French press'), description: t('200 ml, Etiopija Sidamo arabika, svetlo pržena', '200 ml, Ethiopia Sidamo arabica, light roast'), priceCents: rsd(400) },
    { name: t('Aero pres', 'AeroPress'), description: t('200 ml, Etiopija Sidamo arabika, svetlo pržena', '200 ml, Ethiopia Sidamo arabica, light roast'), priceCents: rsd(400) },
  ],
};

export const FABRIKA_TEA: CatalogCategory = {
  name: t('Čaj', 'Tea'),
  items: [
    { name: t('Zdravko', 'Zdravko'), description: t('Hibiskus, crni slez, neven, kamilica, nana, lipa', 'Hibiscus, mallow, marigold, chamomile, mint, linden'), priceCents: rsd(250) },
    { name: t('Gari', 'Gari'), description: t('Nana, kamilica, matičnjak, plod zove, neven, crni slez', 'Mint, chamomile, lemon balm, elderberry, marigold, mallow'), priceCents: rsd(250) },
    { name: t('Džindžer greni', 'Ginger Granny'), description: t('Nana i đumbir', 'Mint and ginger'), priceCents: rsd(250) },
    { name: t('Dark madnes', 'Dark Madness'), description: t('Crni čaj', 'Black tea'), priceCents: rsd(250) },
    { name: t('Detoks', 'Detox'), description: t('Zeleni čaj', 'Green tea'), priceCents: rsd(250) },
    { name: t('Greni', 'Granny'), description: t('Nana', 'Mint'), priceCents: rsd(250) },
    { name: t('Kamimajl', 'Camomile'), description: t('Kamilica', 'Chamomile'), priceCents: rsd(250) },
    { name: t('Blek mango', 'Black Mango'), description: t('Crni čaj sa mangom', 'Black tea with mango'), priceCents: rsd(250) },
    { name: t('Red mednes', 'Red Madness'), description: t('Voćni čaj', 'Fruit tea'), priceCents: rsd(250) },
  ],
};

export const FABRIKA_SANDWICHES: CatalogCategory = {
  name: t('Sendviči', 'Sandwiches'),
  items: [
    {
      name: t('Kapreze sendvič', 'Caprese sandwich'),
      description: t('Fokača, paradajz, bosiljak, pesto đenoveze, sveža mocarela, balzamiko redukcija', 'Focaccia, tomato, basil, pesto genovese, fresh mozzarella, balsamic reduction'),
      priceCents: rsd(590),
      allergens: ['G', 'M', 'N'],
      variantLabel: t('Veličina i dodaci', 'Size & extras'),
      variants: [
        { name: 'Ceo', priceCents: rsd(590) },
        { name: 'Pola', priceCents: rsd(380) },
        { name: 'Ceo + pršuta', priceCents: rsd(750) },
        { name: 'Ceo + dimljeni losos', priceCents: rsd(820) },
      ],
    },
    {
      name: t('Mortadela i pistaći', 'Mortadella & pistachio'),
      description: t('Fokača, italijanska mortadela, sveža mocarela, sirni namaz, domaći pesto od pistaća, baby spanać', 'Focaccia, Italian mortadella, fresh mozzarella, cream cheese, house pistachio pesto, baby spinach'),
      priceCents: rsd(740),
      allergens: ['G', 'M', 'N'],
      variants: [
        { name: 'Ceo', priceCents: rsd(740) },
        { name: 'Pola', priceCents: rsd(400) },
      ],
    },
    {
      name: t('Kafeterija klub sendvič', 'Kafeterija club sandwich'),
      description: t('Beli mlečni tost, pileći file, hrskava pančeta, meki čedar, sirača majonez, ajzberg, paradajz', 'White milk toast, chicken breast, crispy pancetta, soft cheddar, sriracha mayo, iceberg, tomato'),
      priceCents: rsd(620),
      allergens: ['G', 'M', 'E'],
    },
    {
      name: t('Chicken avocado burrito', 'Chicken avocado burrito'),
      description: t('Tortilja, pileći file, hrskava pančeta, guacamole, sirni namaz, paprika, krastavac', 'Tortilla, chicken breast, crispy pancetta, guacamole, cream cheese, pepper, cucumber'),
      priceCents: rsd(650),
      allergens: ['G', 'M'],
    },
    {
      name: t('Crispy chicken burrito', 'Crispy chicken burrito'),
      description: t('Tortilja, pileći nuggetsi, paradajz, paprika, sirača majonez, ajoli, ajzberg, pomfrit', 'Tortilla, chicken nuggets, tomato, pepper, sriracha mayo, aioli, iceberg, fries'),
      priceCents: rsd(680),
      allergens: ['G', 'E', 'M'],
    },
    {
      name: t('Italijanski tost sendvič', 'Italian toastie'),
      description: t('Beli mlečni tost, italijanska mortadela, dimljeni provolone, puter', 'White milk toast, Italian mortadella, smoked provolone, butter'),
      priceCents: rsd(380),
      allergens: ['G', 'M'],
    },
    {
      name: t('Ćuretina i brie', 'Turkey & brie'),
      description: t('Ćabata, dimljena ćureća prsa, brie sir, baby spanać, majonez sa brusnicom, sirni namaz', 'Ciabatta, smoked turkey breast, brie, baby spinach, cranberry mayo, cream cheese'),
      priceCents: rsd(690),
      allergens: ['G', 'M', 'E'],
    },
    {
      name: t('Tuna sendvič', 'Tuna sandwich'),
      description: t('Ćabata, komadi tune, marinara, ajoli, rukola, masline, kapar', 'Ciabatta, tuna chunks, marinara, aioli, rocket, olives, capers'),
      priceCents: rsd(540),
      allergens: ['G', 'F', 'E'],
    },
  ],
};

export const FABRIKA_BURGERS: CatalogCategory = {
  name: t('Burgeri', 'Burgers'),
  items: [
    {
      name: t('Pulled pork burger', 'Pulled pork burger'),
      description: t('Brioš, drpana svinjetina, coleslaw salata, BBQ sos', 'Brioche, pulled pork, coleslaw, BBQ sauce'),
      priceCents: rsd(870),
      allergens: ['G', 'E', 'M'],
    },
    {
      name: t('Angus bacon cheeseburger', 'Angus bacon cheeseburger'),
      description: t('Brioš, Angus burger, ajzberg, kiseli krastavac, paradajz, čedar, hrskava pančeta, burger sos', 'Brioche, Angus patty, iceberg, pickles, tomato, cheddar, crispy pancetta, burger sauce'),
      priceCents: rsd(890),
      allergens: ['G', 'M', 'E'],
    },
    {
      name: t('BBQ burger', 'BBQ burger'),
      description: t('Brioš, Angus burger, ajzberg, kiseli krastavac, paradajz, dimljeni provolone, BBQ sos', 'Brioche, Angus patty, iceberg, pickles, tomato, smoked provolone, BBQ sauce'),
      priceCents: rsd(930),
      allergens: ['G', 'M', 'E'],
    },
    {
      name: t('Diavolo burger', 'Diavolo burger'),
      description: t('Brioš, Angus burger, ajzberg, kiseli krastavac, paradajz, dimljeni provolone, sirača-čipotle majonez', 'Brioche, Angus patty, iceberg, pickles, tomato, smoked provolone, sriracha-chipotle mayo'),
      priceCents: rsd(930),
      allergens: ['G', 'M', 'E'],
      tags: ['spicy'],
    },
    {
      name: t('Chicken avocado burger', 'Chicken avocado burger'),
      description: t('Brioš, piletina, avokado, ajzberg, baby spanać, krastavac, paradajz, sirača majonez', 'Brioche, chicken, avocado, iceberg, baby spinach, cucumber, tomato, sriracha mayo'),
      priceCents: rsd(790),
      allergens: ['G', 'E', 'M'],
    },
    {
      name: t('Steak sendvič', 'Steak sandwich'),
      description: t('Ćabata, juneći ramstek, rukola, paradajz, parmezan, dimljeni provolone, balzamiko redukcija, ajoli', 'Ciabatta, beef rump steak, rocket, tomato, parmesan, smoked provolone, balsamic reduction, aioli'),
      priceCents: rsd(1100),
      allergens: ['G', 'M', 'E'],
    },
  ],
};

export const FABRIKA_STUFFED_FRIES: CatalogCategory = {
  name: t('Stuffed fries', 'Stuffed fries'),
  items: [
    { name: t('Garlic parm', 'Garlic parm'), description: t('Pomfrit, ajoli, parmezan', 'Fries, aioli, parmesan'), priceCents: rsd(520), allergens: ['M', 'E'] },
    { name: t('Truffle fries', 'Truffle fries'), description: t('Pomfrit, majonez sa tartufima, parmezan', 'Fries, truffle mayo, parmesan'), priceCents: rsd(550), allergens: ['M', 'E'] },
    {
      name: t('Burger wedges', 'Burger wedges'),
      description: t('Začinski krompir, burger meso, burger sos, kiseli krastavci, mocarela', 'Seasoned wedges, burger meat, burger sauce, pickles, mozzarella'),
      priceCents: rsd(620),
      allergens: ['M', 'E'],
    },
    {
      name: t('Chicken nuggets wedges', 'Chicken nuggets wedges'),
      description: t('Začinski krompir, pileći nuggetsi, mocarela, sirača majonez, ajoli, vlašac', 'Seasoned wedges, chicken nuggets, mozzarella, sriracha mayo, aioli, chives'),
      priceCents: rsd(610),
      allergens: ['G', 'M', 'E'],
    },
  ],
};

export const FABRIKA_SIDES: CatalogCategory = {
  name: t('Prilozi', 'Sides'),
  items: [
    { name: t('Pomfrit', 'French fries'), description: t('300 g', '300 g'), priceCents: rsd(350), tags: ['vegan'] },
    { name: t('Začinski krompir', 'Seasoned wedges'), description: t('300 g', '300 g'), priceCents: rsd(380), tags: ['vegan'] },
  ],
};

export const FABRIKA_SAUCES: CatalogCategory = {
  name: t('Umaci i sosevi', 'Dips & sauces'),
  items: [
    { name: t('Ajoli', 'Aioli'), description: t('Majonez sa belim lukom', 'Garlic mayo'), priceCents: rsd(100), allergens: ['E'] },
    { name: t('BBQ', 'BBQ'), description: t('Dimljeni barbikju sos', 'Smoky barbecue sauce'), priceCents: rsd(100), tags: ['vegan'] },
    { name: t('Sirača majonez', 'Sriracha mayo'), description: t('Ljuti majonez sa siračom', 'Hot mayo with sriracha'), priceCents: rsd(130), allergens: ['E'], tags: ['spicy'] },
    { name: t('Burger sos', 'Burger sauce'), description: t('Kućni sos za burgere', 'House burger sauce'), priceCents: rsd(110), allergens: ['E'] },
    { name: t('Guakamoli', 'Guacamole'), description: t('Avokado, limeta, luk, korijander', 'Avocado, lime, onion, coriander'), priceCents: rsd(150), tags: ['vegan'] },
  ],
};

export const FABRIKA_CAKES: CatalogCategory = {
  name: t('Kolači', 'Cakes & desserts'),
  items: [
    { name: t('Tart nutela', 'Nutella tart'), description: t('Hrskavo testo sa nutelom', 'Crisp pastry with Nutella'), priceCents: rsd(400), allergens: ['G', 'M', 'E', 'N'] },
    { name: t('Čokoladni mafin', 'Chocolate muffin'), priceCents: rsd(250), allergens: ['G', 'M', 'E'] },
    { name: t('Tart čokolada malina', 'Chocolate raspberry tart'), description: t('Tamna čokolada i sveže maline', 'Dark chocolate and fresh raspberries'), priceCents: rsd(400), allergens: ['G', 'M', 'E'] },
    {
      name: t('Sladoled', 'Ice cream'),
      description: t('Kugla, po želji sa prelivom', 'A scoop, with a topping if you like'),
      priceCents: rsd(100),
      allergens: ['M'],
      variants: [
        { name: 'Kugla', priceCents: rsd(100) },
        { name: 'Kugla sa prelivom', priceCents: rsd(150) },
      ],
    },
  ],
};

export const FABRIKA_FRESH_JUICES: CatalogCategory = {
  name: t('Ceđeni sokovi', 'Fresh juices'),
  items: [
    { name: t('Limunada', 'Lemonade'), description: t('0,4 l', '0.4 l'), priceCents: rsd(200), tags: ['vegan'] },
    { name: t('Voćna limunada', 'Fruit lemonade'), description: t('0,4 l, jagoda ili breskva', '0.4 l, strawberry or peach'), priceCents: rsd(250), tags: ['vegan'], variantLabel: t('Ukus', 'Flavour'), variants: [{ name: 'Jagoda', priceCents: rsd(250) }, { name: 'Breskva', priceCents: rsd(250) }] },
    { name: t('Đumbirlada', 'Ginger lemonade'), description: t('0,4 l, limunada sa svežim đumbirom', '0.4 l, lemonade with fresh ginger'), priceCents: rsd(250), tags: ['vegan'] },
    { name: t('F1', 'F1'), description: t('0,25 l, malina, jabuka, med', '0.25 l, raspberry, apple, honey'), priceCents: rsd(400) },
    { name: t('F2', 'F2'), description: t('Šargarepa, jabuka, narandža, đumbir', 'Carrot, apple, orange, ginger'), priceCents: rsd(350), tags: ['vegan'] },
    { name: t('F3', 'F3'), description: t('Ananas, jabuka, narandža, limun, med', 'Pineapple, apple, orange, lemon, honey'), priceCents: rsd(350) },
    { name: t('F4', 'F4'), description: t('Ceđena narandža', 'Freshly squeezed orange'), priceCents: rsd(350), tags: ['vegan'] },
    { name: t('F5', 'F5'), description: t('Kupina, jabuka, med', 'Blackberry, apple, honey'), priceCents: rsd(450) },
  ],
};

export const FABRIKA_SOFT_DRINKS: CatalogCategory = {
  name: t('Sokovi i voda', 'Soft drinks & water'),
  items: [
    { name: t('Kola', 'Cola'), description: t('0,33 l', '0.33 l'), priceCents: rsd(240) },
    { name: t('Fanta', 'Fanta'), description: t('0,33 l', '0.33 l'), priceCents: rsd(240) },
    { name: t('Tonik', 'Tonic'), description: t('0,33 l', '0.33 l'), priceCents: rsd(240) },
    { name: t('Biter', 'Bitter lemon'), description: t('0,33 l', '0.33 l'), priceCents: rsd(240) },
    { name: t('Sok od jabuke', 'Apple juice'), description: t('0,33 l', '0.33 l'), priceCents: rsd(240) },
    { name: t('Sok od narandže', 'Orange juice'), description: t('0,33 l', '0.33 l'), priceCents: rsd(240) },
    { name: t('Sok od borovnice', 'Blueberry juice'), description: t('0,33 l', '0.33 l'), priceCents: rsd(240) },
    { name: t('Rosa', 'Rosa still water'), description: t('Negazirana voda', 'Still water'), priceCents: rsd(190), variants: [{ name: '0,33 l', priceCents: rsd(190) }, { name: '0,75 l', priceCents: rsd(310) }] },
    { name: t('Knjaz Miloš', 'Knjaz Miloš sparkling water'), description: t('Gazirana voda', 'Sparkling water'), priceCents: rsd(190), variants: [{ name: '0,33 l', priceCents: rsd(190) }, { name: '0,75 l', priceCents: rsd(310) }] },
    { name: t('Red Bull', 'Red Bull'), description: t('0,33 l', '0.33 l'), priceCents: rsd(350) },
    { name: t('San Pellegrino / Acqua Panna', 'San Pellegrino / Acqua Panna'), description: t('Gazirana ili negazirana', 'Sparkling or still'), priceCents: rsd(300), variantLabel: t('Voda', 'Water'), variants: [{ name: 'San Pellegrino', priceCents: rsd(300) }, { name: 'Acqua Panna', priceCents: rsd(300) }] },
  ],
};

export const FABRIKA_BEER: CatalogCategory = {
  name: t('Pivo', 'Beer'),
  items: [
    { name: t('Heineken', 'Heineken'), description: t('0,25 l', '0.25 l'), priceCents: rsd(320), allergens: ['G'] },
    { name: t('Budweiser', 'Budweiser'), description: t('0,33 l', '0.33 l'), priceCents: rsd(320), allergens: ['G'] },
    { name: t('Bavaria', 'Bavaria'), description: t('0,25 l', '0.25 l'), priceCents: rsd(320), allergens: ['G'] },
    { name: t('Nikšićko tamno', 'Nikšićko dark'), description: t('0,33 l', '0.33 l'), priceCents: rsd(370), allergens: ['G'] },
    { name: t('Hoptopod', 'Hoptopod'), description: t('IPA, 6,5 %, 0,33 l', 'IPA, 6.5 %, 0.33 l'), priceCents: rsd(370), allergens: ['G'] },
    { name: t('Crna krava', 'Crna krava'), description: t('Milk stout, 6,5 %, 0,33 l', 'Milk stout, 6.5 %, 0.33 l'), priceCents: rsd(370), allergens: ['G', 'M'] },
    { name: t('Svetionik', 'Svetionik'), description: t('Pale ale, 4,7 %, 0,33 l', 'Pale ale, 4.7 %, 0.33 l'), priceCents: rsd(370), allergens: ['G'] },
    { name: t('New Pils on the Block', 'New Pils on the Block'), description: t('Pilsner, 4,7 %, 0,33 l', 'Pilsner, 4.7 %, 0.33 l'), priceCents: rsd(370), allergens: ['G'] },
  ],
};

export const FABRIKA_WINE: CatalogCategory = {
  name: t('Vino', 'Wine'),
  items: [
    { name: t('Grumen Sauvignon Blanc', 'Grumen Sauvignon Blanc'), description: t('Belo vino', 'White wine'), priceCents: rsd(480), variants: [{ name: '0,15 l', priceCents: rsd(480) }, { name: '0,7 l', priceCents: rsd(2600) }] },
    { name: t('Grumen Petit Verdot', 'Grumen Petit Verdot'), description: t('Crno vino', 'Red wine'), priceCents: rsd(480), variants: [{ name: '0,15 l', priceCents: rsd(480) }, { name: '0,7 l', priceCents: rsd(2600) }] },
    { name: t('Prosecco', 'Prosecco'), description: t('Penušavo vino', 'Sparkling wine'), priceCents: rsd(400), variants: [{ name: '0,15 l', priceCents: rsd(400) }, { name: '0,7 l', priceCents: rsd(1850) }] },
  ],
};

export const FABRIKA_COCKTAILS: CatalogCategory = {
  name: t('Kokteli', 'Cocktails'),
  items: [
    { name: t('Espresso martini', 'Espresso martini'), description: t('Votka, kafeni liker, sveži espreso', 'Vodka, coffee liqueur, fresh espresso'), priceCents: rsd(580) },
    { name: t('Irska kafa', 'Irish coffee'), description: t('Viski, kafa, smeđi šećer, šlag', 'Whiskey, coffee, brown sugar, cream'), priceCents: rsd(580), allergens: ['M'] },
    { name: t('Mojito', 'Mojito'), description: t('Rum, limeta, nana, šećer, soda', 'Rum, lime, mint, sugar, soda'), priceCents: rsd(580) },
    { name: t('Aperol Spritz', 'Aperol Spritz'), description: t('Aperol, prosecco, soda', 'Aperol, prosecco, soda'), priceCents: rsd(580) },
    { name: t('Strawberry Splash', 'Strawberry Splash'), priceCents: rsd(580) },
    { name: t('Tropical Breeze', 'Tropical Breeze'), priceCents: rsd(580) },
    { name: t('Raspberry Sparkle', 'Raspberry Sparkle'), priceCents: rsd(580) },
    { name: t('Hugo', 'Hugo'), description: t('Prosecco, sirup od zove, nana, limeta', 'Prosecco, elderflower syrup, mint, lime'), priceCents: rsd(580) },
    { name: t('Mint Flower Fizz', 'Mint Flower Fizz'), priceCents: rsd(580) },
    { name: t('Negroni', 'Negroni'), description: t('Džin, Campari, slatki vermut', 'Gin, Campari, sweet vermouth'), priceCents: rsd(580) },
    { name: t('Golden Passion', 'Golden Passion'), priceCents: rsd(580) },
    { name: t('Pink Panther', 'Pink Panther'), priceCents: rsd(580) },
  ],
};

export const FABRIKA_RAKIJA: CatalogCategory = {
  name: t('Rakije', 'Rakija'),
  items: [
    { name: t('Branko šljiva', 'Branko plum'), description: t('0,04 l', '0.04 l'), priceCents: rsd(400) },
    { name: t('Kovilj šljiva', 'Kovilj plum'), description: t('0,04 l', '0.04 l'), priceCents: rsd(330) },
    { name: t('Kovilj dunja', 'Kovilj quince'), description: t('0,04 l', '0.04 l'), priceCents: rsd(330) },
    { name: t('Kovilj kajsija', 'Kovilj apricot'), description: t('0,04 l', '0.04 l'), priceCents: rsd(330) },
    { name: t('Kovilj viljamovka', 'Kovilj Williams pear'), description: t('0,04 l', '0.04 l'), priceCents: rsd(330) },
    { name: t('Pruna od šljive', 'Pruna plum'), description: t('0,04 l', '0.04 l'), priceCents: rsd(300) },
    { name: t('1858 BB', '1858 BB'), description: t('0,04 l', '0.04 l'), priceCents: rsd(500) },
    { name: t('Stara pesma', 'Stara pesma'), description: t('0,04 l', '0.04 l'), priceCents: rsd(350) },
    { name: t('Zarić', 'Zarić'), description: t('0,04 l', '0.04 l'), priceCents: rsd(370) },
    { name: t('Kraljica', 'Kraljica'), description: t('0,04 l', '0.04 l'), priceCents: rsd(300) },
    { name: t('Koketa', 'Koketa'), description: t('0,04 l', '0.04 l'), priceCents: rsd(350) },
    // The printed menu shows no price next to Nirvana; 350 is a placeholder for the owner to confirm.
    { name: t('Nirvana', 'Nirvana'), description: t('0,04 l', '0.04 l'), priceCents: rsd(350) },
  ],
};

/** Coffee first, then food, then the rest of the drinks. */
export const FABRIKA_MENU: CatalogCategory[] = [
  FABRIKA_COFFEE,
  FABRIKA_BREWING,
  FABRIKA_TEA,
  FABRIKA_SANDWICHES,
  FABRIKA_BURGERS,
  FABRIKA_STUFFED_FRIES,
  FABRIKA_SIDES,
  FABRIKA_SAUCES,
  FABRIKA_CAKES,
  FABRIKA_FRESH_JUICES,
  FABRIKA_SOFT_DRINKS,
  FABRIKA_BEER,
  FABRIKA_WINE,
  FABRIKA_COCKTAILS,
  FABRIKA_RAKIJA,
];
