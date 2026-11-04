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

/** Surcharge for a plant-based or lactose-free milk in any milk drink (the owner's "fejk mleko" line). */
const PLANT_MILK_RSD = 60;
const PLANT_MILK_NOTE = t(
  `Biljno mleko +${PLANT_MILK_RSD} RSD: sojino, bademovo, kokosovo, ovseno ili bez laktoze`,
  `Plant milk +${PLANT_MILK_RSD} RSD: soy, almond, coconut, oat or lactose-free`,
);

/** Every drink made with milk carries the plant-milk line under its own description. */
function withMilk(description: TranslatedText): TranslatedText {
  return { sr: `${description.sr}\n${PLANT_MILK_NOTE.sr}`, en: `${description.en}\n${PLANT_MILK_NOTE.en}` };
}

/** The syrups the house has: the same list for the flavoured latte (hot and iced) and the flavoured frappé. */
const FLAVOURS = ['Lešnik', 'Karamela', 'Vanila', 'Bela čokolada', 'Čoko kuki', 'Pumpkin spice'] as const;

function flavoured(price: number): Pick<CatalogItem, 'variantLabel' | 'variants'> {
  return { variantLabel: t('Ukus', 'Flavour'), variants: FLAVOURS.map((name) => ({ name, priceCents: rsd(price) })) };
}

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

/** Same, for a drink made with milk: the plant-milk line is appended to the description. */
function milkCoffee(
  name: TranslatedText,
  description: TranslatedText,
  prices: { b1: number; b7: number; k?: number; km?: number },
  extra: Partial<CatalogItem> = {},
): CatalogItem {
  return coffee(name, withMilk(description), prices, { allergens: ['M'], ...extra });
}

/**
 * Descriptions follow the owner's live edits (dose in grams, sizes), with the plant-milk line on every milk drink and
 * the flavour list as variants where the house has syrups.
 */
export const FABRIKA_COFFEE: CatalogCategory = {
  name: t('Kafa', 'Coffee'),
  items: [
    coffee(t('Espreso', 'Espresso'), t('25–30 ml / 10 g kafe', '25–30 ml / 10 g of coffee'), { b1: 190, b7: 190, k: 200, km: 200 }),
    coffee(t('Ristreto', 'Ristretto'), t('20 ml, kraći i gušći espreso', '20 ml, a shorter, denser espresso'), { b1: 190, b7: 190, k: 200, km: 200 }),
    coffee(t('Dupli espreso', 'Double espresso'), t('50–60 ml / 18 g kafe', '50–60 ml / 18 g of coffee'), { b1: 270, b7: 270, k: 280, km: 280 }),
    milkCoffee(t('Makijato', 'Macchiato'), t('25–30 ml / 10 g kafe sa malo pene', '25–30 ml / 10 g of coffee with a cap of milk foam'), { b1: 200, b7: 200, k: 210, km: 210 }),
    {
      // Coffee for kids — no espresso, so no blend to choose; the sticker drawing is `bebicino.jpg`.
      name: t('Bebićino', 'Babyccino'),
      description: withMilk(
        t(
          'Kafa za decu ☺ 40 ml tople mlečne pene bez kofeina, posute kakaom. Mala šolja, velika radost.',
          'Coffee for kids ☺ 40 ml of warm milk foam, no caffeine, dusted with cocoa. Small cup, big smile.',
        ),
      ),
      priceCents: rsd(200),
      allergens: ['M'],
    },
    milkCoffee(t('Kapućino', 'Cappuccino'), t('220 ml / 10 g kafe, toplo mleko i gusta pena', '220 ml / 10 g of coffee, steamed milk and thick foam'), { b1: 220, b7: 220, k: 230, km: 230 }),
    milkCoffee(t('Kapućino XL', 'Cappuccino XL'), t('300 ml / 18 g kafe, toplo mleko i gusta pena', '300 ml / 18 g of coffee, steamed milk and thick foam'), { b1: 310, b7: 310, k: 320, km: 320 }),
    milkCoffee(t('Kafe late', 'Caffè latte'), t('200 ml / 10 g kafe i mikropena od toplog mleka', '200 ml / 10 g of coffee and warm milk microfoam'), { b1: 220, b7: 220, k: 230, km: 230 }),
    milkCoffee(
      t('Late makijato', 'Latte macchiato'),
      t('250 ml / 10 g kafe, slojevito mleko, pena i espreso · „nes kafa od espresa“', '250 ml / 10 g of coffee, layered milk, foam and espresso · our "instant coffee made of espresso"'),
      { b1: 250, b7: 250, k: 260, km: 260 },
    ),
    {
      name: t('Kafe late sa ukusom', 'Flavoured caffè latte'),
      description: withMilk(t('200 ml / 10 g kafe · topla ili hladna · K / KM blend +10 RSD', '200 ml / 10 g of coffee · hot or iced · K / KM blend +10 RSD')),
      priceCents: rsd(290),
      allergens: ['M', 'N'],
      ...flavoured(290),
    },
    milkCoffee(t('Moka espreso', 'Mocha'), t('200 ml / 10 g kafe, crna čokolada, mleko i mikropena', '200 ml / 10 g of coffee, dark chocolate, milk and microfoam'), { b1: 280, b7: 280, k: 290, km: 290 }),
    coffee(t('Kafa afogato', 'Affogato'), t('30 ml / 10 g kafe preko kugle gelato sladoleda', '30 ml / 10 g of coffee poured over a scoop of gelato'), { b1: 270, b7: 270, k: 280, km: 280 }, { allergens: ['M'] }),
    coffee(t('Fredo hladni espreso', 'Freddo espresso'), t('350 ml / 18 g kafe, dupli espreso umućen sa ledom', '350 ml / 18 g of coffee, double espresso shaken over ice'), { b1: 280, b7: 280 }),
    milkCoffee(t('Fredo kapućino', 'Freddo cappuccino'), t('350 ml / 18 g kafe, dupli espreso umućen u ledu pre mlečne pene', '350 ml / 18 g of coffee, double espresso shaken over ice under cold milk foam'), { b1: 310, b7: 310 }),
    {
      name: t('Ledena kafa', 'Iced coffee'),
      description: withMilk(t('300 ml, nes kafa sa kuglom sladoleda i hladnim mlekom', '300 ml, instant coffee with a scoop of ice cream and cold milk')),
      priceCents: rsd(290),
      allergens: ['M'],
    },
    // The three iced drinks and "fejk mleko" carry the owner's own live wording (2026-11-04): no flavour variants on the
    // flavoured latte (the syrups are listed in the text, plant milk +50 there), no plant-milk line on the plain latte.
    {
      name: t('Hladan Kafe Late', 'Iced caffè latte'),
      description: t('200ml / 10g Kafe i mikropena od hladnog mleka', '200 ml / 10 g of coffee and cold milk microfoam'),
      priceCents: rsd(220),
      allergens: ['M'],
    },
    {
      name: t('Hladni Kafe Late sa ukusom', 'Iced flavoured latte'),
      description: t(
        '200 ml / 10g Kafe. Lešnik,karamela,bela čokolada, choco cookie, vanila(sezonski pumpkin spice)\nBiljno mleko +50 RSD: sojino, bademovo, kokosovo, ovseno ili bez laktoze',
        '200 ml / 10 g of coffee. Hazelnut, caramel, white chocolate, choco cookie, vanilla (seasonal pumpkin spice)\nPlant milk +50 RSD: soy, almond, coconut, oat or lactose-free',
      ),
      priceCents: rsd(290),
      allergens: ['M', 'N'],
    },
    {
      name: t('Hladna Moka', 'Iced mocha'),
      description: withMilk(t('200 ml / 10g Kafe, crna čokolada, mleko i mikropena', '200 ml / 10 g of coffee, dark chocolate, milk and microfoam')),
      priceCents: rsd(280),
      allergens: ['M'],
    },
    { name: t('Hladni matcha late', 'Iced matcha latte'), priceCents: rsd(400), allergens: ['M'] },
    { name: t('Hladni matcha late sa jagodom', 'Iced strawberry matcha latte'), priceCents: rsd(450), allergens: ['M'] },
    coffee(
      t('Amerikano', 'Americano'),
      t('250 ml / 18 g kafe, espreso produžen vrelom vodom · „domaća kafa od espresa“', '250 ml / 18 g of coffee, espresso lengthened with hot water · our "Serbian coffee made of espresso"'),
      { b1: 270, b7: 270, k: 280, km: 280 },
    ),
    { name: t('Nes frape', 'Nescafé frappé'), description: withMilk(t('300 ml, umućena nes kafa i mleko', '300 ml, whipped instant coffee and milk')), priceCents: rsd(220), allergens: ['M'] },
    {
      name: t('Nes frape sa ukusom', 'Flavoured frappé'),
      description: withMilk(t('300 ml, umućena nes kafa, mleko i sirup po izboru', '300 ml, whipped instant coffee, milk and the syrup of your choice')),
      priceCents: rsd(270),
      allergens: ['M', 'N'],
      ...flavoured(270),
    },
    {
      name: t('Topla čokolada', 'Hot chocolate'),
      description: withMilk(t('Premium, crna ili bela', 'Premium, dark or white')),
      priceCents: rsd(250),
      allergens: ['M'],
      variantLabel: t('Vrsta', 'Type'),
      variants: [
        { name: 'Crna', priceCents: rsd(250) },
        { name: 'Bela', priceCents: rsd(250) },
      ],
    },
    {
      name: t('Srpska kafa', 'Serbian coffee'),
      description: t('60 ml, kuvana u džezvi, Fabrika Kafeterija miks · može i na pakovanje od 200 g, mlevena ili u zrnu', '60 ml, brewed in a džezva, the Fabrika Kafeterija mix · also sold in 200 g packs, ground or whole bean'),
      priceCents: rsd(220),
    },
    { name: t('Mača late', 'Matcha latte'), description: withMilk(t('Japanski zeleni čaj u prahu sa penastim mlekom', 'Japanese powdered green tea with frothed milk')), priceCents: rsd(400), allergens: ['M'] },
    {
      name: t('fejk mleko', 'Plant milk'),
      description: t('Sojino, bademovo, kokosovo, ovseno ili bez laktoze · dodatak uz bilo koju kafu', 'Soy, almond, coconut, oat or lactose-free · added to any coffee'),
      priceCents: rsd(50),
      allergens: ['S', 'N'],
    },
    { name: t('Sveže mlevena domaća kafa 200 g', 'Freshly ground Serbian coffee, 200 g'), description: t('Za kuću, mlevena pred vama', 'To take home, ground in front of you'), priceCents: rsd(450) },
    {
      name: t('Espreso kafa 250 g', 'Espresso beans, 250 g'),
      description: t(
        ['Uvek na stanju:', '007 – Kućni blend', '001 – Kućni blend', 'Single blend – Kolumbija', 'Single blend – Etiopija', 'Decaf', 'U zrnu ili mlevena, za kuću'].join('\n'),
        ['Always in stock:', '007 – House blend', '001 – House blend', 'Single blend – Colombia', 'Single blend – Ethiopia', 'Decaf', 'Whole bean or ground, to take home'].join('\n'),
      ),
      priceCents: rsd(1600),
    },
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

export const FABRIKA_GRANOLA: CatalogCategory = {
  name: t('Granole', 'Granola'),
  // The owner split the granola into one row per kind (2026-11-04); both keep his shared description.
  items: [granola('Kućna granola čokolada', 'House granola, chocolate'), granola('Kućna granola brusnica', 'House granola, cranberry')],
};

function granola(sr: string, en: string): CatalogItem {
  return {
    name: t(sr, en),
    description: t(
      [
        'Hrskava, zapečena u rerni, sa svežom bananom. Dve vrste:',
        'Brusnica – brusnica, badem, mekinje, lan, suncokret, riža golice, med, semenke vanile, ovsene pahuljice',
        'Čokolada – čokolada, badem, mekinje, lan, suncokret, riža golice, med, semenke vanile, ovsene pahuljice',
        'Biljno mleko: sojino, bademovo, kokosovo, ovseno ili bez laktoze',
      ].join('\n'),
      [
        'Crunchy, oven-baked, with fresh banana. Two kinds:',
        'Cranberry – cranberry, almond, bran, flax, sunflower, puffed rice, honey, vanilla seeds, oats',
        'Chocolate – chocolate, almond, bran, flax, sunflower, puffed rice, honey, vanilla seeds, oats',
        'Plant milk: soy, almond, coconut, oat or lactose-free',
      ].join('\n'),
    ),
    priceCents: rsd(400),
    allergens: ['G', 'M', 'N'],
    variantLabel: t('Uz', 'Served with'),
    variants: [
      { name: 'Mleko', priceCents: rsd(400) },
      { name: 'Jogurt', priceCents: rsd(400) },
      { name: 'Biljno mleko', priceCents: rsd(400) },
    ],
  };
}

export const FABRIKA_SANDWICHES: CatalogCategory = {
  name: t('Sendviči', 'Sandwiches'),
  items: [
    {
      name: t('Kapreze sendvič', 'Caprese sandwich'),
      description: t('Fokača, paradajz, bosiljak, pesto đenoveze, sveža mocarela, balzamiko redukcija', 'Focaccia, tomato, basil, pesto genovese, fresh mozzarella, balsamic reduction'),
      priceCents: rsd(590),
      allergens: ['G', 'M', 'N'],
    },
    {
      name: t('Kapreze sendvič – pršuta', 'Caprese sandwich – prosciutto'),
      description: t('Fokača, paradajz, bosiljak, pesto đenoveze, sveža mocarela, balzamiko redukcija + pršuta', 'Focaccia, tomato, basil, pesto genovese, fresh mozzarella, balsamic reduction + prosciutto'),
      priceCents: rsd(750),
      allergens: ['G', 'M', 'N'],
      variantLabel: t('Veličina', 'Size'),
      variants: [
        { name: 'Ceo', priceCents: rsd(750) },
        { name: 'Pola', priceCents: rsd(540) },
      ],
    },
    {
      name: t('Kapreze sendvič – losos', 'Caprese sandwich – salmon'),
      description: t('Fokača, paradajz, bosiljak, pesto đenoveze, sveža mocarela, balzamiko redukcija + dimljeni losos', 'Focaccia, tomato, basil, pesto genovese, fresh mozzarella, balsamic reduction + smoked salmon'),
      priceCents: rsd(820),
      allergens: ['G', 'M', 'N', 'F'],
      variantLabel: t('Veličina', 'Size'),
      variants: [
        { name: 'Ceo', priceCents: rsd(820) },
        { name: 'Pola', priceCents: rsd(610) },
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
    // Ingredient lists are the owner's own live wording (2026-11-04); he removed "Tart nutela".
    { name: t('Čokoladni mafin', 'Chocolate muffin'), description: t('Čokolada,jaja,puter,brašno', 'Chocolate, eggs, butter, flour'), priceCents: rsd(250), allergens: ['G', 'M', 'E'] },
    {
      name: t('Tart čokolada malina', 'Chocolate raspberry tart'),
      description: t('KORA/jaja,brašno,šećer,mleko,puter\nFIL/malina,puter,šećer\nGLAZURA/čokolada,puter', 'CRUST/eggs, flour, sugar, milk, butter\nFILLING/raspberry, butter, sugar\nGLAZE/chocolate, butter'),
      priceCents: rsd(400),
      allergens: ['G', 'M', 'E'],
    },
    { name: t('Mafin sa sladoledom', 'Muffin with ice cream'), description: t('Čokoladni mafin sa kuglom sladoleda', 'Chocolate muffin with a scoop of ice cream'), priceCents: rsd(400), allergens: ['G', 'M', 'E'] },
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
    {
      name: t('Tart malina bela cokolada', 'White chocolate raspberry tart'),
      description: t('KORA/plazma,puter,mleko\nFIL/malina,šećer,puter\nGLAZURA/bela čokolada,slatka pavlaka', 'CRUST/Plazma biscuits, butter, milk\nFILLING/raspberry, sugar, butter\nGLAZE/white chocolate, cream'),
      priceCents: rsd(400),
      allergens: ['G', 'M'],
    },
    {
      name: t('San Sebastian cheesecake', 'San Sebastian cheesecake'),
      description: t('KORA/jaja,brašno,šećer,mleko,puter\nFIL/španski sir,šećer,vanila,slatka pavlaka,jaja\nPRELIV/malina', 'CRUST/eggs, flour, sugar, milk, butter\nFILLING/Spanish cheese, sugar, vanilla, cream, eggs\nTOPPING/raspberry'),
      priceCents: rsd(400),
      allergens: ['G', 'M', 'E'],
    },
  ],
};

export const FABRIKA_FRESH_JUICES: CatalogCategory = {
  name: t('Ceđeni sokovi', 'Fresh juices'),
  items: [
    { name: t('Limunada', 'Lemonade'), description: t('0,4 l', '0.4 l'), priceCents: rsd(200), tags: ['vegan'] },
    {
      name: t('Limunada sa ukusom', 'Flavoured lemonade'),
      description: t('0,4 l, jagoda, breskva, malina ili marakuja', '0.4 l, strawberry, peach, raspberry or passion fruit'),
      priceCents: rsd(250),
      tags: ['vegan'],
      variantLabel: t('Ukus', 'Flavour'),
      variants: [
        { name: 'Jagoda', priceCents: rsd(250) },
        { name: 'Breskva', priceCents: rsd(250) },
        { name: 'Malina', priceCents: rsd(250) },
        { name: 'Marakuja', priceCents: rsd(250) },
      ],
    },
    { name: t('Limunada jagoda', 'Strawberry lemonade'), description: t('0,4 l, jagoda', '0.4 l, strawberry'), priceCents: rsd(250), tags: ['vegan'] },
    { name: t('Đumbirlada', 'Ginger lemonade'), description: t('0,4 l, limunada sa svežim đumbirom', '0.4 l, lemonade with fresh ginger'), priceCents: rsd(250), tags: ['vegan'] },
    {
      name: t('Voćna limunada', 'Fruit lemonade'),
      description: t('0,4 l, jagoda ili breskva', '0.4 l, strawberry or peach'),
      priceCents: rsd(250),
      tags: ['vegan'],
      variantLabel: t('Ukus', 'Flavour'),
      variants: [
        { name: 'Jagoda', priceCents: rsd(250) },
        { name: 'Breskva', priceCents: rsd(250) },
      ],
    },
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
    // Fizzy drinks come in cans; the still juices are Next (the owner's "gusti sokovi").
    { name: t('Kola', 'Cola'), description: t('Coca-Cola, limenka 0,33 l', 'Coca-Cola, 0.33 l can'), priceCents: rsd(240) },
    { name: t('Fanta', 'Fanta'), description: t('Limenka 0,33 l', '0.33 l can'), priceCents: rsd(240) },
    { name: t('Tonik', 'Tonic'), description: t('Schweppes, limenka 0,33 l', 'Schweppes, 0.33 l can'), priceCents: rsd(240) },
    { name: t('Biter', 'Bitter lemon'), description: t('Schweppes, limenka 0,33 l', 'Schweppes, 0.33 l can'), priceCents: rsd(240) },
    { name: t('Sok od narandže', 'Orange juice'), description: t('Next, gusti sok, 0,33 l', 'Next, thick juice, 0.33 l'), priceCents: rsd(240) },
    { name: t('Sok od borovnice', 'Blueberry juice'), description: t('Next, gusti sok, 0,33 l', 'Next, thick juice, 0.33 l'), priceCents: rsd(240) },
    { name: t('Next sok od breskve', 'Peach juice'), description: t('Next, gusti sok, 0,33 l', 'Next, thick juice, 0.33 l'), priceCents: rsd(240) },
    { name: t('Sok od jabuke', 'Apple juice'), description: t('0,33 l', '0.33 l'), priceCents: rsd(240) },
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

/** The two Grumen wines (Vinarija Grumen, Fruška gora) with the winery's own descriptions from grumen.rs/vina.htm. */
const GRUMEN = {
  sauvignon: t(
    'Sveže vino izuzetne strukture, umereno punog tela, delikatne mineralnosti i veoma voćnog karaktera. Miris izrazito voćan, slojevit: prvo se javljaju note tropskog voća (papaje, manga, limete), a zatim herbalni tonovi vreže paradajza i bosiljka koji mirisu daju posebnu svežinu. U ustima se nastavlja razigranost koju najavljuje miris — suvo, vibrantnih kiselina, sa notama sočnih bresaka u završnici. Belo vino, Fruškogorsko vinogorje, 13,5 %.',
    'A fresh wine of remarkable structure, medium-full body, delicate minerality and a very fruity character. The nose is intensely fruity and layered: tropical fruit first (papaya, mango, lime), then herbal tones of tomato vine and basil that give it a special freshness. The palate keeps the playfulness the nose promises — dry, with vibrant acidity and juicy peach on the finish. White wine, Fruška gora, 13.5 %.',
  ),
  petitVerdot: t(
    'Vino punog tela, izraženih tanina i prijatnih kiselina, sa potencijalom za odležavanje. Intenzivne, tamnocrvene boje sa ljubičastim odsjajem na obodu. Na mirisu su dominantne note kakaa i crnog voća; vremenom se izdvajaju suve šljive i kupine, sa začinskim biljem u pozadini. Sjajno se slaže uz odležale sireve, jagnjetinu sa biljnim začinima, pečena svinjska rebra i burgere od čiste junetine sa dimljenim sirevima. Crveno vino, Fruškogorsko vinogorje, 14,5 %.',
    'A full-bodied wine with pronounced tannins and pleasant acidity, built to age. Deep dark red with a violet rim. Cocoa and black fruit lead on the nose; prunes and blackberries follow, with herbs in the background. Pairs beautifully with aged cheeses, herb-rubbed lamb, roast pork ribs and pure-beef burgers with smoked cheese. Red wine, Fruška gora, 14.5 %.',
  ),
  prosecco: t('Penušavo vino', 'Sparkling wine'),
};

/** The owner wants a glass and a bottle as separate rows, not variants. */
const GLASS = t('Čaša 0,15 l', 'Glass 0.15 l');
const BOTTLE = t('Flaša 0,75 l', 'Bottle 0.75 l');
const PROSECCO_BOTTLE = t('Flaša 0,7 l', 'Bottle 0.7 l');

function wine(name: string, serving: TranslatedText, note: TranslatedText, price: number): CatalogItem {
  return { name: t(name, name), description: t(`${serving.sr}. ${note.sr}`, `${serving.en}. ${note.en}`), priceCents: rsd(price) };
}

export const FABRIKA_WINE: CatalogCategory = {
  name: t('Vino', 'Wine'),
  items: [
    wine('Grumen Sauvignon Blanc · čaša', GLASS, GRUMEN.sauvignon, 480),
    wine('Grumen Sauvignon Blanc · flaša', BOTTLE, GRUMEN.sauvignon, 2600),
    wine('Grumen Petit Verdot · čaša', GLASS, GRUMEN.petitVerdot, 480),
    wine('Grumen Petit Verdot · flaša', BOTTLE, GRUMEN.petitVerdot, 2600),
    wine('Prosecco · čaša', GLASS, GRUMEN.prosecco, 400),
    wine('Prosecco · flaša', PROSECCO_BOTTLE, GRUMEN.prosecco, 1850),
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
  // FABRIKA_BREWING is kept above for the day the owner brings the siphon and V60 back; he removed the category live.
  FABRIKA_TEA,
  FABRIKA_GRANOLA,
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
