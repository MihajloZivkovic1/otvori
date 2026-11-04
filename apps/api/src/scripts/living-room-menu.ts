import type { TranslatedText } from '@qr-menu/shared';
import { rsd, type CatalogCategory, type CatalogItem } from './menu-catalog.js';

/**
 * The real menu of Living Room 21 (Beogradska 21, Vračar), transcribed from the venue's printed A3 menu (one sheet in
 * Serbian, one in English): coffee, the "Japanese wellness" lattes, juices, shakes, water, soft drinks, energy drinks,
 * then breakfast, starters, mains, salads and desserts — the order of the printed columns. Used by `seed-living-room.ts`.
 */

const t = (sr: string, en: string): TranslatedText => ({ sr, en });

/** A plain item: name, price and an optional description (sr/en) with allergens and tags. */
function item(name: TranslatedText, price: number, extra: Partial<CatalogItem> & { description?: TranslatedText } = {}): CatalogItem {
  return { name, priceCents: rsd(price), ...extra };
}

/** A bottled drink: the volume goes into the description ("0,25 l"). */
function bottle(name: TranslatedText, litres: string, price: number, note?: TranslatedText): CatalogItem {
  const volume = `${litres.replace('.', ',')} l`;
  return item(name, price, {
    description: note ? t(`${volume} · ${note.sr}`, `${litres} l · ${note.en}`) : t(volume, `${litres} l`),
  });
}

const ADD_ONS = t(
  'Dodaci +50 RSD: marakuja, breskva, jagoda, malina, kokos',
  'Add-ons +50 RSD: passion fruit, peach, strawberry, raspberry, coconut',
);

export const LIVING_ROOM_COFFEE: CatalogCategory = {
  name: t('Coffee menu', 'Coffee menu'),
  items: [
    item(t('Espresso', 'Espresso'), 250, { description: t('Dimello Cento (100% arabica), Molinari (80/20)', 'Dimello Cento (100% arabica), Molinari (80/20)') }),
    item(t('Freddo espresso', 'Freddo espresso'), 320),
    item(t('Dupli espresso', 'Double espresso'), 390),
    item(t('Espresso sa mlekom', 'Espresso with milk'), 270, { allergens: ['M'] }),
    item(t('Dupli espresso sa mlekom', 'Double espresso with milk'), 420, { allergens: ['M'] }),
    item(t('Cappuccino', 'Cappuccino'), 290, { allergens: ['M'] }),
    item(t('Dupli cappuccino', 'Double cappuccino'), 440, { allergens: ['M'] }),
    item(t('Flat white', 'Flat white'), 350, { allergens: ['M'] }),
    item(t('Latte coffee', 'Latte coffee'), 290, { allergens: ['M'] }),
    item(t('Čaj', 'Tea'), 280, {
      variantLabel: t('Vrsta čaja', 'Tea'),
      variants: ['Menta', 'Kamilica', 'Zeleni', 'Crni', 'Voćni'].map((name) => ({ name, priceCents: rsd(280) })),
      description: t('Menta, kamilica, zeleni, crni ili voćni', 'Mint, chamomile, green, black or fruit'),
    }),
    item(t('Čaša mleka', 'Glass of milk'), 140, { allergens: ['M'] }),
    item(t('Biljno mleko', 'Plant-based milk'), 60, { description: t('Doplata za biljno mleko u bilo kom napitku', 'Surcharge for plant-based milk in any drink') }),
    item(t('Dodaci', 'Add-ons'), 50, {
      variantLabel: t('Ukus', 'Flavour'),
      variants: ['Marakuja', 'Breskva', 'Jagoda', 'Malina', 'Kokos'].map((name) => ({ name, priceCents: rsd(50) })),
      description: t('Sirup po izboru u bilo kom napitku', 'A syrup of your choice in any drink'),
    }),
  ],
};

export const LIVING_ROOM_WELLNESS: CatalogCategory = {
  name: t('Japanese wellness', 'Japanese wellness'),
  items: [
    item(t('Matcha latte', 'Matcha latte'), 470, {
      description: t(`Japanska premium matcha, šećer kokosovog cveta\n${ADD_ONS.sr}`, `Premium Japanese matcha blended with milk and lightly sweetened with coconut blossom sugar\n${ADD_ONS.en}`),
      allergens: ['M'],
    }),
    item(t('Chai latte', 'Chai latte'), 430, {
      description: t(`Crni čaj, inulin, šećer kokosovog cveta, kardamon, cimet, karanfilić, crni biber\n${ADD_ONS.sr}`, `Black tea with coconut blossom sugar, inulin, cardamom, cinnamon, cloves and black pepper\n${ADD_ONS.en}`),
      allergens: ['M'],
    }),
    item(t('Golden latte', 'Golden latte'), 430, {
      description: t(`Kurkuma, šećer kokosovog cveta, inulin, cimet, đumbir, crni biber\n${ADD_ONS.sr}`, `Turmeric blend with coconut blossom sugar, cinnamon, ginger, inulin and black pepper\n${ADD_ONS.en}`),
      allergens: ['M'],
    }),
    item(t('Pink chai latte', 'Pink chai latte'), 430, {
      description: t(`Cvekla, šećer kokosovog cveta, inulin, cimet, đumbir\n${ADD_ONS.sr}`, `Beetroot latte with coconut blossom sugar, ginger and cinnamon\n${ADD_ONS.en}`),
      allergens: ['M'],
    }),
    item(t('Char coco latte', 'Char coco latte'), 430, {
      description: t(`Kokos, aktivni ugalj, kakao, šećer kokosovog cveta\n${ADD_ONS.sr}`, `Coconut latte with activated charcoal, cocoa and coconut blossom sugar\n${ADD_ONS.en}`),
      allergens: ['M'],
    }),
    item(t('Ube blend', 'Ube blend'), 430, {
      description: t(`70% ube, 30% ljubičasti batat\n${ADD_ONS.sr}`, `Creamy blend of 70% ube and 30% purple sweet potato\n${ADD_ONS.en}`),
      allergens: ['M'],
    }),
    item(t('Biljno mleko', 'Plant-based milk'), 60, { description: t('Doplata za biljno mleko', 'Surcharge for plant-based milk') }),
  ],
};

export const LIVING_ROOM_JUICES: CatalogCategory = {
  name: t('Ceđeni sokovi', 'Fresh squeezed juices'),
  items: [
    item(t('Limunada', 'Lemonade'), 350, { tags: ['vegan'] }),
    item(t('Ceđena pomorandža', 'Fresh orange juice'), 430, { tags: ['vegan'] }),
    item(t('Ceđeni grejp', 'Fresh grapefruit juice'), 480, { tags: ['vegan'] }),
    item(t('Citrus mix', 'Citrus mix'), 530, { description: t('Narandža, limun, grejp', 'Orange, lemon, grapefruit'), tags: ['vegan'] }),
    item(t('Detox mix', 'Detox mix'), 530, { description: t('Jabuka, đumbir, limeta, narandža', 'Apple, ginger, lime, orange'), tags: ['vegan'] }),
    item(t('Living Room mix', 'Living Room mix'), 530, { description: t('Cvekla, šargarepa, jabuka, limun', 'Beetroot, carrot, apple, lemon'), tags: ['vegan'] }),
  ],
};

export const LIVING_ROOM_SHAKES: CatalogCategory = {
  name: t('Shakes', 'Shakes'),
  items: [
    item(t('Plazma shake', 'Plazma shake'), 550, { description: t('Plazma, mleko, slatka pavlaka', 'Plazma biscuit, milk, sweet cream'), allergens: ['G', 'M'] }),
    item(t('Protein shake', 'Protein shake'), 850, {
      variantLabel: t('Ukus', 'Flavour'),
      variants: [
        { name: 'Vanila', priceCents: rsd(850) },
        { name: 'Belgijska čokolada', priceCents: rsd(850) },
      ],
      description: t(
        'Whey protein: vanila ili belgijska čokolada\nDodaci (uz doplatu): ovsene +100 RSD, banana +100 RSD, mix smrznutog crvenog voća +100 RSD',
        'Whey protein: vanilla or Belgian chocolate\nExtras (additional charge): oats +100 RSD, banana +100 RSD, frozen red fruit mix +100 RSD',
      ),
      allergens: ['M'],
    }),
  ],
};

export const LIVING_ROOM_WATER: CatalogCategory = {
  name: t('Voda', 'Water'),
  items: [
    bottle(t('Acqua Panna', 'Acqua Panna'), '0.25', 320),
    bottle(t('Rosa', 'Rosa'), '0.33', 240),
    bottle(t('San Pellegrino', 'San Pellegrino'), '0.25', 320),
    bottle(t('Rosa gazirana', 'Sparkling Rosa'), '0.33', 240),
    bottle(t('Römerquelle', 'Römerquelle'), '0.33', 290, t('limunska trava', 'lemongrass')),
    bottle(t('Kokosova voda', 'Coconut water'), '0.50', 690),
  ],
};

export const LIVING_ROOM_SOFT_DRINKS: CatalogCategory = {
  name: t('Sokovi', 'Soft drinks'),
  items: [
    item(t('Next', 'Next juice'), 290, {
      variantLabel: t('Ukus', 'Flavour'),
      variants: ['Jagoda', 'Breskva', 'Jabuka'].map((name) => ({ name, priceCents: rsd(290) })),
      description: t('0,20 l · jagoda, breskva ili jabuka', '0.20 l · strawberry, peach or apple'),
    }),
    item(t('Home made ice tea', 'Home made ice tea'), 390, {
      variantLabel: t('Ukus', 'Flavour'),
      variants: ['Breskva', 'Marakuja', 'Malina', 'Jagoda'].map((name) => ({ name, priceCents: rsd(390) })),
      description: t('0,30 l · breskva, marakuja, malina ili jagoda', '0.30 l · peach, passion fruit, raspberry or strawberry'),
    }),
    item(t('Ice tea', 'Ice tea'), 490, { description: t('0,30 l · lavanda, nana, limun, bez dodatog šećera', '0.30 l · lavender, mint, lemon, no added sugar'), tags: ['vegan'] }),
    bottle(t('Kombucha', 'Kombucha'), '0.33', 490),
    bottle(t('Coca-Cola', 'Coca-Cola'), '0.25', 300),
    bottle(t('Coca-Cola zero', 'Coca-Cola zero'), '0.25', 300),
    bottle(t('Fanta', 'Fanta'), '0.25', 300),
    bottle(t('Sprite', 'Sprite'), '0.25', 300),
    bottle(t('Schweppes bitter lemon', 'Schweppes bitter lemon'), '0.25', 300),
    bottle(t('Thomas Henry tonic', 'Thomas Henry tonic'), '0.20', 560),
  ],
};

export const LIVING_ROOM_ENERGY: CatalogCategory = {
  name: t('Energetska pića', 'Energy drinks'),
  items: [bottle(t('Red Bull', 'Red Bull'), '0.25', 550)],
};

export const LIVING_ROOM_BREAKFAST: CatalogCategory = {
  name: t('Doručak (do 13:00h)', 'Breakfast (until 1:00 PM)'),
  items: [
    item(t('Francuski kroasan sa puterom', 'French butter croissant'), 250, {
      description: t(
        '2 kom.\nDodaci (uz doplatu): džem +50 RSD, med +70 RSD, nutella +80 RSD, pistać krem +80 RSD, sos od maline +80 RSD',
        '2 pcs.\nExtras (additional charge): jam +50 RSD, honey +70 RSD, nutella +80 RSD, pistachio cream +80 RSD, raspberry sauce +80 RSD',
      ),
      allergens: ['G', 'M', 'E'],
    }),
    item(t('Palenta', 'Polenta'), 650, { description: t('Kremasta palenta sa hrskavom slaninom', 'Creamy polenta with crispy bacon'), allergens: ['M'] }),
    item(t('Ovsena kaša', 'Oatmeal'), 690, { description: t('Ovsena kaša sa sezonskim voćem i kikiriki puterom', 'Oatmeal with seasonal fruit and peanut butter'), allergens: ['G', 'M', 'N'] }),
    item(t('Domaća granola', 'Homemade granola'), 720, {
      description: t('Domaća granola sa sušenim voćem, grčki jogurt, sezonsko sveže voće i med', 'Homemade granola with dried fruit, Greek yogurt, seasonal fresh fruit and honey'),
      allergens: ['G', 'M', 'N'],
    }),
    item(t('Zdravi doručak', 'Healthy breakfast'), 850, {
      variantLabel: t('Opcija', 'Option'),
      variants: [
        { name: 'Sa pršutom', priceCents: rsd(850) },
        { name: 'Sa dimljenim lososom', priceCents: rsd(890) },
      ],
      description: t(
        'Beskvasni hleb, domaći gvakamole, poširano jaje i pršuta · opcija sa dimljenim lososom 890 RSD',
        'Unleavened bread, homemade guacamole, poached egg and prosciutto · option with smoked salmon 890 RSD',
      ),
      allergens: ['G', 'E', 'F'],
    }),
    item(t('Karpaćo doručak', 'Carpaccio breakfast'), 1190, {
      description: t('Bezglutenski hleb, ranch dresing, rukola, beef karpaćo, poširano jaje i pinjoli', 'Gluten-free bread, ranch dressing, arugula, beef carpaccio, poached egg and pine nuts'),
      allergens: ['M', 'E', 'N'],
    }),
    item(t('Francuska kajgana', 'French scrambled eggs'), 710, {
      description: t('Kremasta kajgana sa pastom od tartufa na beskvasnom hlebu, hrskava slanina i domaći krem sir', 'Creamy scrambled eggs with truffle paste on unleavened bread, crispy bacon and homemade cream cheese'),
      allergens: ['G', 'M', 'E'],
    }),
    item(t('Burek testo sa mortadelom i pistaćima', 'Phyllo pastry with mortadella & pistachios'), 760, {
      description: t('Hrskavo burek testo, domaći krem sir sa sušenim paradajzom i mortadela sa pistaćima', 'Crispy phyllo pastry, homemade cream cheese with sun-dried tomatoes and mortadella with pistachios'),
      allergens: ['G', 'M', 'N'],
    }),
    item(t('Sendvič sa buratom', 'Burrata sandwich'), 1290, { description: t('Domaća čabata, pesto, burata, pršuta i rukola', 'Homemade ciabatta, pesto, burrata, prosciutto and rocket salad'), allergens: ['G', 'M', 'N'] }),
    item(t('Sendvič sa mortadelom', 'Mortadella sandwich'), 950, {
      description: t('Domaća čabata, gauda, mortadela, domaći krem sir, namaz sa sušenim paradajzom', 'Homemade ciabatta, gouda, mortadella, homemade cream cheese spread with sun-dried tomatoes'),
      allergens: ['G', 'M'],
    }),
    item(t('Bowl sa lososom', 'Salmon bowl'), 890, { description: t('Prepečen crni hleb, svež avokado, dimljeni losos i kremasta kajgana', 'Toasted dark bread, fresh avocado, smoked salmon and creamy scrambled eggs'), allergens: ['G', 'E', 'F'] }),
    item(t('Bowl sa mortadelom', 'Mortadella bowl'), 730, { description: t('Prepečen crni hleb, svež avokado, mortadela i kremasta kajgana', 'Toasted dark bread, fresh avocado, mortadella and creamy scrambled eggs'), allergens: ['G', 'E'] }),
    item(t('Bowl sa pršutom', 'Prosciutto bowl'), 850, { description: t('Prepečen crni hleb, svež avokado, pršuta i kremasta kajgana', 'Toasted dark bread, fresh avocado, prosciutto and creamy scrambled eggs'), allergens: ['G', 'E'] }),
  ],
};

export const LIVING_ROOM_STARTERS: CatalogCategory = {
  name: t('Predjela (hladna i topla)', 'Starters (cold and warm)'),
  items: [
    item(t('Burata sa čeri paradajzom', 'Burrata with cherry tomatoes'), 1125, { description: t('Sveža burata sa čeri paradajzom', 'Fresh burrata with cherry tomatoes'), allergens: ['M'] }),
    item(t('Karpaćo', 'Carpaccio'), 1450, { description: t('Beef karpaćo sa rukolom', 'Beef carpaccio with rocket salad') }),
    item(t('Karpaćo sa buratom', 'Carpaccio with burrata'), 1950, { description: t('Beef karpaćo sa buratom u sredini i rukolom', 'Beef carpaccio with burrata in the center and rocket salad'), allergens: ['M'] }),
    item(t('Burek testo sa mortadelom i pistaćima', 'Phyllo pastry with mortadella & pistachios'), 760, {
      description: t('Hrskavo burek testo, domaći krem sir sa sušenim paradajzom i mortadela sa pistaćima', 'Crispy phyllo pastry, homemade cream cheese with sun-dried tomatoes and mortadella with pistachios'),
      allergens: ['G', 'M', 'N'],
    }),
    item(t('Naše mazalice sa domaćim pita bread-om', 'Homemade spreads with pita bread'), 850, {
      description: t('Humus, bakin ajvar i pašteta od čvaraka uz domaći pita hleb', 'Hummus, homemade ajvar and crackling pâté served with homemade pita bread'),
      allergens: ['G', 'Se'],
    }),
    item(t('Daska pršuta i sireva', 'Prosciutto & cheese board'), 1800, {
      description: t('Pršuta, kulen, goveđi ramstek, kozji sir, gauda, feta i gorgonzola', 'Prosciutto, kulen, beef rump, goat cheese, gouda, feta and gorgonzola'),
      allergens: ['M'],
    }),
    item(t('Daska sireva', 'Cheese board'), 1150, { description: t('Gorgonzola, gauda, feta, parmezan i kozji sir', 'Gorgonzola, gouda, feta, parmesan and goat cheese'), allergens: ['M'] }),
    item(t('Potaž dana', 'Soup of the day'), 390, { description: t('Dnevni potaž – pitati konobara za izbor dana', 'Daily soup – please ask your server for today’s selection') }),
    item(t('Teleća čorba', 'Veal soup'), 420, { description: t('Čorba sa komadićima telećeg mesa', 'Traditional veal soup with tender veal pieces') }),
  ],
};

export const LIVING_ROOM_MAINS: CatalogCategory = {
  name: t('Glavna jela', 'Main courses'),
  items: [
    item(t('Sweet chili taljatele', 'Sweet chili tagliatelle'), 1450, {
      description: t('Taljatele sa biftekom, sušenim paradajzom, sweet chili sosom i paradajz sosom', 'Tagliatelle with beef steak, sun-dried tomatoes, sweet chili sauce and tomato sauce'),
      allergens: ['G', 'E'],
    }),
    item(t('Taljatele sa piletinom', 'Chicken tagliatelle'), 980, { description: t('Taljatele, piletina, sezonsko povrće i parmezan', 'Tagliatelle with chicken, seasonal vegetables and parmesan'), allergens: ['G', 'M', 'E'] }),
    item(t('Pumpkin steak rižoto', 'Pumpkin steak risotto'), 1450, { description: t('Kremasti rižoto od bundeve sa taljatama bifteka na vrhu', 'Creamy pumpkin risotto topped with sliced beef steak'), allergens: ['M'] }),
    item(t('Salmon rižoto', 'Salmon risotto'), 1390, { description: t('Rižoto sa povrćem, lososom, maslinama i paradajz sosom', 'Risotto with vegetables, salmon, olives and tomato sauce'), allergens: ['M', 'F'] }),
    item(t('Garden chicken rižoto', 'Garden chicken risotto'), 990, { description: t('Rižoto sa piletinom i sezonskim povrćem', 'Risotto with chicken and seasonal vegetables'), allergens: ['M'] }),
    item(t('Living Room ćevapi', 'Living Room ćevapi'), 1370, {
      description: t('Preporuka kuće · ćevapi, pita hleb, ajvar, kajmak i hrskava slanina', 'Chef’s recommendation · ćevapi served with pita bread, ajvar, kajmak and crispy bacon'),
      allergens: ['G', 'M'],
    }),
    item(t('Beogradska pljeska', 'Belgrade burger'), 1370, {
      description: t('Pljeskavica u hrskavom burek testu, kajmak i hrskava slanina', 'Beef patty wrapped in crispy phyllo pastry with kajmak and crispy bacon'),
      allergens: ['G', 'M'],
    }),
    item(t('Alpska piletina sa njokama', 'Alpine chicken with gnocchi'), 1450, {
      description: t('Punjena piletina sa mocarelom, rukolom i čeri paradajzom, urolana u pršutu, servirana sa njokama', 'Chicken stuffed with mozzarella, arugula and cherry tomatoes, wrapped in prosciutto, served with gnocchi'),
      allergens: ['G', 'M', 'E'],
    }),
    item(t('Biftek taljata', 'Beef tagliata'), 2800, { description: t('Biftek, rukola, parmezan i pinjoli', 'Grilled beef steak with rocket salad, parmesan and pine nuts'), allergens: ['M', 'N'] }),
    item(t('Piletina sa žara', 'Grilled chicken'), 950, { description: t('Grilovana piletina, riža i grilovano povrće', 'Grilled chicken breast, rice and grilled vegetables') }),
    item(t('Brancin sa žara', 'Grilled sea bass'), 1950, { description: t('File brancina sa grilovanim povrćem', 'Sea bass fillet with grilled vegetables'), allergens: ['F'] }),
    item(t('Teriyaki losos', 'Teriyaki salmon'), 2200, { description: t('File lososa na žaru, pirinač, teriyaki sos', 'Grilled salmon fillet, rice, teriyaki sauce'), allergens: ['F', 'S', 'G', 'Se'] }),
    item(t('Panko piletina bowl', 'Panko chicken bowl'), 800, { description: t('Pohovani pileći štapići, pirinač i sweet chili sos', 'Crispy panko chicken strips, rice and sweet chili sauce'), allergens: ['G', 'E'] }),
    item(t('Cezar salata', 'Caesar salad'), 1090, {
      description: t('Mix zelenih salata, rukola, grilovana slanina, piletina, krutoni i cezar dresing', 'Mixed greens, rocket salad, grilled bacon, chicken, croutons and Caesar dressing'),
      allergens: ['G', 'M', 'E', 'F'],
    }),
    item(t('Salata sa lososom', 'Salmon salad'), 1390, {
      description: t('Mix zelenih salata, krastavac, čeri paradajz, seme bundeve, avokado i losos', 'Mixed greens, cucumber, cherry tomatoes, pumpkin seeds, avocado and salmon'),
      allergens: ['F'],
    }),
  ],
};

export const LIVING_ROOM_SALADS: CatalogCategory = {
  name: t('Salate', 'Salads'),
  items: [
    item(t('Šopska salata', 'Shopska salad'), 440, { allergens: ['M'] }),
    item(t('Mix zelenih salata', 'Mixed green salad'), 420, { tags: ['vegan'] }),
    item(t('Grčka salata', 'Greek salad'), 550, { allergens: ['M'] }),
    item(t('Rukola sa parmezanom', 'Arugula with parmesan'), 550, { allergens: ['M'] }),
    item(t('Kupus salata', 'Cabbage salad'), 350, { tags: ['vegan'] }),
    item(t('Prolećna salata', 'Spring salad'), 390, { description: t('Sezonska salata: puterica, rotkvice i sezonsko povrće', 'Seasonal salad: butter lettuce, radishes and seasonal vegetables'), tags: ['vegan'] }),
  ],
};

export const LIVING_ROOM_DESSERTS: CatalogCategory = {
  name: t('Dezerti', 'Desserts'),
  items: [
    item(t('Američke palačinke', 'American pancakes'), 720, {
      description: t('Nutella, plazma, sos od maline, vanila krem, karamel i sladoled od vanile', 'Nutella, Plazma biscuit crumble, raspberry sauce, vanilla cream, caramel and vanilla ice cream'),
      allergens: ['G', 'M', 'E', 'N'],
    }),
    item(t('Bakine domaće palačinke', 'Grandma’s homemade crepes'), 500, {
      description: t('Izbor: nutella, džem, pistać krem, plazma, orasi ili lešnici', 'Choice of: nutella, jam, pistachio cream, Plazma biscuit, walnuts or hazelnuts'),
      allergens: ['G', 'M', 'E', 'N'],
    }),
    item(t('Sezonska pita', 'Seasonal pie'), 490, { description: t('Jabuka ili višnja (posno)', 'Apple or cherry (vegan)'), allergens: ['G'], tags: ['vegan'] }),
    item(t('Kolač sa makom', 'Poppy seed cake'), 690, {
      description: t('Kolač sa makom, sos od bele čokolade, sos od maline i sladoled od vanile', 'Poppy seed cake with white chocolate sauce, raspberry sauce and vanilla ice cream'),
      allergens: ['G', 'M', 'E'],
    }),
    item(t('Banana bread', 'Banana bread'), 680, { description: t('Domaći banana bread sa prelivom od maline', 'Homemade banana bread with raspberry topping'), allergens: ['G', 'M', 'E'] }),
    item(t('Kugla sladoleda od vanile', 'Vanilla ice cream scoop'), 150, { allergens: ['M'] }),
  ],
};

/** The printed order: drinks column first, then breakfast and starters, then mains, salads and desserts. */
export const LIVING_ROOM_MENU: CatalogCategory[] = [
  LIVING_ROOM_COFFEE,
  LIVING_ROOM_WELLNESS,
  LIVING_ROOM_JUICES,
  LIVING_ROOM_SHAKES,
  LIVING_ROOM_WATER,
  LIVING_ROOM_SOFT_DRINKS,
  LIVING_ROOM_ENERGY,
  LIVING_ROOM_BREAKFAST,
  LIVING_ROOM_STARTERS,
  LIVING_ROOM_MAINS,
  LIVING_ROOM_SALADS,
  LIVING_ROOM_DESSERTS,
];
