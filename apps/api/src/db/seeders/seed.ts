import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { Transaction } from 'sequelize';
import {
  DEFAULT_MODULES,
  RESTAURANT_DEFAULTS,
  type OrderStatus,
  tipCentsFor,
  type OrderingMode,
  type PaymentProviderKey,
  type PaymentStatus,
  type PosCloseMode,
  type PosProviderKey,
  type RestaurantModules,
  type Plan,
  type RestaurantStatus,
  type ServiceRequestType,
  type TranslatedText,
} from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { encryptSecret } from '../../utils/crypto.js';
import { hashPassword } from '../../utils/password.js';
import { formatZonedDate, startOfDayInZone, zonedParts } from '../../utils/time.js';
import { runMigrations } from '../migrate.js';
import {
  Category,
  ItemVariant,
  ItemView,
  Membership,
  MenuItem,
  Order,
  OrderItem,
  Restaurant,
  RestaurantTable,
  ScanEvent,
  ServiceRequest,
  User,
} from '../models/index.js';
import { sequelize } from '../sequelize.js';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const TIMEZONE = 'Europe/Belgrade';
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * DAY_MS);
const daysAhead = (days: number) => new Date(now.getTime() + days * DAY_MS);
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * MINUTE_MS);

// Deterministic PRNG so re-seeding produces the same analytics.
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261020);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
function weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let roll = rand() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

interface SeedVariant {
  name: string;
  priceCents: number;
}
interface SeedItem {
  name: TranslatedText;
  description?: TranslatedText;
  priceCents: number;
  allergens?: string[];
  tags?: string[];
  variants?: SeedVariant[];
  isAvailable?: boolean;
  /** Relative weight used when generating fake item views. */
  popularity: number;
  /** POS product code (Phase 9d); the demo venue maps every item so the mock register can close orders. */
  posProductCode?: string;
}
interface SeedCategory {
  name: TranslatedText;
  isHidden?: boolean;
  items: SeedItem[];
}
interface SeedRestaurant {
  slug: string;
  name: string;
  tagline?: string;
  menuNote?: string;
  primaryColor?: string;
  city: string;
  address?: string;
  status: RestaurantStatus;
  plan: Plan;
  trialEndsAt?: Date | null;
  publishedAt?: Date | null;
  owner: { name: string; email: string; password: string };
  /** Staff accounts (Phase 11): service screens only, no PIN. */
  staff?: { name: string; email: string; password: string }[];
  categories: SeedCategory[];
  tables: { number: number; label: string }[];
  /** Number of past days to generate scan events for. */
  scanDays: number;
  dailyScans: [number, number];
  /** Table ordering (Phase 6): off by default; `orderDays` adds a week of fake orders plus a few open ones. */
  orderingMode?: OrderingMode;
  orderDays?: number;
  /** Feature modules (Phase 9b); default all off. */
  modules?: Partial<RestaurantModules>;
  /** Online payment set-up (Phase 9c); the secret is encrypted at seed time. */
  paymentConfig?: { provider: PaymentProviderKey; merchantId: string; secret: string; tipPresets: number[]; receiptEmailEnabled: boolean };
  /** POS integration (Phase 9d): mock register for the demo venue; table ids are mapped after the tables exist. */
  posConfig?: { provider: PosProviderKey; baseUrl: string | null; apiKey: string; sendOrdersToPos: boolean; closeOnPayment: boolean; closeMode: PosCloseMode };
}

const SUPERADMIN = { email: 'admin@otvori.menu', password: 'admin1234', name: 'otvori admin' };

const kafeterija: SeedRestaurant = {
  slug: 'kafeterija',
  name: 'Kafeterija Dorćol',
  tagline: 'Specialty coffee & breakfast',
  menuNote: 'Kitchen until 16:00',
  primaryColor: '#7A3E48',
  city: 'Beograd',
  address: 'Cara Dušana 12',
  status: 'active',
  plan: 'pro',
  trialEndsAt: null,
  publishedAt: daysAgo(40),
  owner: { name: 'Ana Petrović', email: 'ana@kafeterija.rs', password: 'tabla1234' },
  staff: [{ name: 'Marko Konobar', email: 'marko@kafeterija.rs', password: 'tabla1234' }],
  categories: [
    {
      name: { sr: 'Kafa', en: 'Coffee' },
      items: [
        {
          name: { sr: 'Espresso', en: 'Espresso' },
          description: { sr: 'Zrna iz Etiopije, srednje prženje', en: 'Ethiopian beans, medium roast' },
          priceCents: 18000,
          variants: [
            { name: 'Single', priceCents: 18000 },
            { name: 'Double', priceCents: 22000 },
          ],
          popularity: 10,
        },
        {
          name: { sr: 'Kapućino', en: 'Cappuccino' },
          priceCents: 25000,
          allergens: ['M'],
          variants: [
            { name: 'Regular', priceCents: 25000 },
            { name: 'Large', priceCents: 29000 },
          ],
          popularity: 9,
        },
        { name: { sr: 'Flat white', en: 'Flat white' }, priceCents: 28000, allergens: ['M'], popularity: 7 },
        {
          name: { sr: 'Filter kafa', en: 'Filter coffee' },
          description: { sr: 'V60 ili Chemex, pitajte za dnevnu ponudu zrna', en: 'V60 or Chemex, ask about today’s beans' },
          priceCents: 26000,
          variants: [
            { name: 'V60', priceCents: 26000 },
            { name: 'Chemex (2 cups)', priceCents: 42000 },
          ],
          popularity: 5,
        },
      ],
    },
    {
      name: { sr: 'Doručak', en: 'Breakfast' },
      items: [
        {
          name: { sr: 'Tost sa avokadom', en: 'Avocado toast' },
          description: { sr: 'Kiselo testo, avokado, čeri paradajz, susam', en: 'Sourdough, avocado, cherry tomatoes, sesame' },
          priceCents: 65000,
          allergens: ['G', 'Se'],
          tags: ['vegan'],
          popularity: 8,
        },
        {
          name: { sr: 'Jaja Benedikt', en: 'Eggs Benedict' },
          description: { sr: 'Poširana jaja, holandez sos, brioš', en: 'Poached eggs, hollandaise, brioche' },
          priceCents: 72000,
          allergens: ['E', 'G', 'M'],
          popularity: 6,
        },
        {
          name: { sr: 'Granola sa jogurtom', en: 'Granola bowl' },
          priceCents: 52000,
          allergens: ['G', 'M', 'N'],
          tags: ['new'],
          popularity: 4,
        },
      ],
    },
    {
      name: { sr: 'Peciva', en: 'Pastries' },
      items: [
        { name: { sr: 'Kroasan', en: 'Croissant' }, priceCents: 22000, allergens: ['G', 'M', 'E'], popularity: 7 },
        {
          name: { sr: 'Rolnica sa cimetom', en: 'Cinnamon roll' },
          priceCents: 26000,
          allergens: ['G', 'M', 'E'],
          tags: ['new'],
          popularity: 5,
        },
        { name: { sr: 'Burek sa sirom', en: 'Cheese burek' }, priceCents: 28000, allergens: ['G', 'M'], popularity: 6 },
      ],
    },
    {
      name: { sr: 'Hladna pića', en: 'Cold drinks' },
      items: [
        { name: { sr: 'Ceđena pomorandža', en: 'Fresh orange juice' }, priceCents: 35000, popularity: 5 },
        {
          name: { sr: 'Limunada sa đumbirom', en: 'Ginger lemonade' },
          priceCents: 30000,
          tags: ['spicy', 'vegan'],
          popularity: 4,
        },
        { name: { sr: 'Ledeni late', en: 'Iced latte' }, priceCents: 32000, allergens: ['M'], popularity: 6 },
      ],
    },
    {
      name: { sr: 'Sezonsko', en: 'Seasonal' },
      isHidden: true,
      items: [{ name: { sr: 'Late sa bundevom', en: 'Pumpkin spice latte' }, priceCents: 34000, allergens: ['M'], popularity: 2 }],
    },
  ],
  tables: [
    ...Array.from({ length: 6 }, (_, i) => ({ number: i + 1, label: `Sto ${i + 1}` })),
    { number: 7, label: 'Bašta 1' },
    { number: 8, label: 'Bašta 2' },
  ],
  scanDays: 30,
  dailyScans: [18, 55],
  orderingMode: 'order',
  orderDays: 7,
  // Every module on: the demo venue shows ordering, the payment simulator and the mock POS (Phases 9c/9d).
  modules: { ordering: true, payments: true, pos: true },
  // Mock provider: scanning a payment QR opens the simulator page (PAYMENTS_MOCK=true), see docs/DEMO.md.
  paymentConfig: { provider: 'mock', merchantId: 'DEMO-KAFETERIJA', secret: 'demo-secret', tipPresets: [0, 5, 10, 15], receiptEmailEnabled: true },
  // Mock register (POS_MOCK=true): accepted orders are "opened", paid ones "closed" with a fake fiscal receipt.
  posConfig: { provider: 'mock', baseUrl: null, apiKey: 'demo-pos-key', sendOrdersToPos: true, closeOnPayment: true, closeMode: 'reuse-external-id' },
};

const smallMenu = (a: [string, string], b: [string, string], base: number): SeedCategory[] => [
  {
    name: { sr: a[0], en: a[1] },
    items: [
      { name: { sr: 'Dnevna supa', en: 'Soup of the day' }, priceCents: base, allergens: ['G'], popularity: 5 },
      { name: { sr: 'Salata', en: 'Salad' }, priceCents: base + 15000, tags: ['vegan'], popularity: 4 },
      { name: { sr: 'Glavno jelo', en: 'Main course' }, priceCents: base * 3, allergens: ['G', 'M'], popularity: 7 },
    ],
  },
  {
    name: { sr: b[0], en: b[1] },
    items: [
      { name: { sr: 'Kafa', en: 'Coffee' }, priceCents: 17000, popularity: 8 },
      { name: { sr: 'Sok', en: 'Juice' }, priceCents: 25000, popularity: 4 },
      { name: { sr: 'Kiselа voda', en: 'Sparkling water' }, priceCents: 15000, popularity: 3 },
    ],
  },
];
const fourTables = Array.from({ length: 4 }, (_, i) => ({ number: i + 1, label: `Sto ${i + 1}` }));

const others: SeedRestaurant[] = [
  {
    slug: 'bistro-zemun',
    name: 'Bistro Zemun',
    tagline: 'Riblja kuhinja na keju',
    primaryColor: '#1F4E79',
    city: 'Zemun',
    status: 'active',
    plan: 'pro',
    publishedAt: daysAgo(80),
    owner: { name: 'Marko Jovanović', email: 'marko@bistrozemun.rs', password: 'tabla1234' },
    categories: smallMenu(['Jela', 'Dishes'], ['Pića', 'Drinks'], 45000),
    tables: fourTables,
    scanDays: 30,
    dailyScans: [6, 22],
    orderingMode: 'call_waiter',
    modules: { ordering: true },
  },
  {
    slug: 'pekara-luna',
    name: 'Pekara Luna',
    primaryColor: '#B8860B',
    city: 'Novi Sad',
    status: 'trial',
    plan: 'trial',
    trialEndsAt: daysAhead(9),
    publishedAt: daysAgo(3),
    owner: { name: 'Jelena Nikolić', email: 'jelena@pekaraluna.rs', password: 'tabla1234' },
    categories: smallMenu(['Peciva', 'Pastries'], ['Napici', 'Beverages'], 12000),
    tables: fourTables.slice(0, 2),
    scanDays: 3,
    dailyScans: [2, 9],
  },
  {
    slug: 'caffe-nova',
    name: 'Caffe Nova',
    primaryColor: '#2E7D32',
    city: 'Niš',
    status: 'suspended',
    plan: 'starter',
    publishedAt: daysAgo(120),
    owner: { name: 'Nikola Stojanović', email: 'nikola@caffenova.rs', password: 'tabla1234' },
    categories: smallMenu(['Hrana', 'Food'], ['Kafa i pića', 'Coffee & drinks'], 30000),
    tables: fourTables,
    scanDays: 10,
    dailyScans: [1, 5],
  },
  {
    slug: 'stari-grad',
    name: 'Restoran Stari Grad',
    tagline: 'Domaća kuhinja od 1987.',
    primaryColor: '#8B0000',
    city: 'Beograd',
    address: 'Skadarska 5',
    status: 'active',
    plan: 'starter',
    publishedAt: daysAgo(200),
    owner: { name: 'Dragan Ilić', email: 'dragan@starigrad.rs', password: 'tabla1234' },
    categories: smallMenu(['Kuvana jela', 'Home cooking'], ['Pića', 'Drinks'], 55000),
    tables: [...fourTables, { number: 5, label: 'Sto 5' }, { number: 6, label: 'Sto 6' }],
    scanDays: 30,
    dailyScans: [10, 30],
  },
  {
    slug: 'bar-savamala',
    name: 'Bar Savamala',
    primaryColor: '#4A148C',
    city: 'Beograd',
    status: 'trial',
    plan: 'trial',
    trialEndsAt: daysAgo(2),
    publishedAt: null,
    owner: { name: 'Milica Đorđević', email: 'milica@barsavamala.rs', password: 'tabla1234' },
    categories: smallMenu(['Kokteli', 'Cocktails'], ['Grickalice', 'Snacks'], 60000),
    tables: fourTables.slice(0, 3),
    scanDays: 0,
    dailyScans: [0, 0],
  },
];

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const HOUR_WEIGHTS = [3, 8, 10, 8, 6, 9, 9, 6, 4, 4, 4, 3, 2];
const VIEW_COUNTS = [0, 1, 2, 3, 4, 5];
const VIEW_WEIGHTS = [10, 25, 30, 20, 10, 5];

/* ------------------------------------------------------------------ orders (Phase 6) */

interface OrderableItem {
  id: string;
  name: TranslatedText;
  priceCents: number;
  variants: { id: string; name: string; priceCents: number }[];
}
interface SeedLine {
  menuItemId: string;
  variantId: string | null;
  name: TranslatedText;
  variantName: string | null;
  unitPriceCents: number;
  quantity: number;
  lineNote: string | null;
}
interface SeedOrder {
  createdAt: Date;
  status: OrderStatus;
  table: RestaurantTable;
  lines: SeedLine[];
  guestName?: string;
  note?: string;
  rejectedReason?: string;
  acceptedAt?: Date;
  deliveredAt?: Date;
  closedAt?: Date;
  /** Online payment (Phase 9c): some delivered orders were paid through the app, some in cash. */
  paymentStatus?: PaymentStatus;
  tipPercent?: number;
}

const GUEST_NAMES = ['Marko', 'Jelena', 'Nikola', 'Ana', 'Stefan', 'Milica'];
const ORDER_NOTES = ['Sve odjednom, molim.', 'Bez šećera u kafi.', 'Račun odvojeno, molim.'];
const REJECT_REASONS = ['Nema na stanju', 'Kuhinja je zatvorena', 'Velika gužva, kasnije'];
const ORDER_HOURS = [9, 10, 11, 12, 13, 14, 15, 16];
const ORDER_HOUR_WEIGHTS = [6, 9, 7, 8, 9, 7, 4, 2];

function randomLines(items: OrderableItem[], guestLocale: string, defaultLocale: string): SeedLine[] {
  const count = weightedPick([1, 2, 3], [45, 40, 15]);
  const lines: SeedLine[] = [];
  for (let i = 0; i < count; i++) {
    const item = items[randInt(0, items.length - 1)]!;
    const variant = item.variants.length ? item.variants[randInt(0, item.variants.length - 1)]! : null;
    const name: TranslatedText = {};
    for (const locale of [defaultLocale, guestLocale]) {
      const value = item.name[locale as keyof TranslatedText] ?? item.name.sr ?? item.name.en;
      if (value) name[locale as keyof TranslatedText] = value;
    }
    lines.push({
      menuItemId: item.id,
      variantId: variant?.id ?? null,
      name,
      variantName: variant?.name ?? null,
      unitPriceCents: variant?.priceCents ?? item.priceCents,
      quantity: weightedPick([1, 2, 3], [70, 25, 5]),
      lineNote: rand() < 0.12 ? 'bez čilija' : null,
    });
  }
  return lines;
}

/** A week of history (mostly delivered, a few rejected/expired/cancelled), then a few open orders and two open calls. */
async function seedOrders(
  restaurant: Restaurant,
  tables: RestaurantTable[],
  items: OrderableItem[],
  days: number,
  transaction: Transaction,
): Promise<void> {
  if (items.length === 0 || tables.length === 0) return;
  const orders: SeedOrder[] = [];
  for (let dayOffset = days - 1; dayOffset >= 0; dayOffset--) {
    const dayStart = startOfDayInZone(now, TIMEZONE, -dayOffset);
    const count = randInt(4, 8);
    for (let i = 0; i < count; i++) {
      const hour = weightedPick(ORDER_HOURS, ORDER_HOUR_WEIGHTS);
      const createdAt = new Date(dayStart.getTime() + hour * 3600_000 + randInt(0, 3599) * 1000);
      if (createdAt.getTime() > now.getTime() - 30 * MINUTE_MS) continue;
      const guestLocale = rand() < 0.25 ? 'en' : restaurant.defaultLocale;
      const order: SeedOrder = {
        createdAt,
        status: 'delivered',
        table: weightedPick(tables, tables.map((_, index) => (index < 2 ? 3 : 2))),
        lines: randomLines(items, guestLocale, restaurant.defaultLocale),
        guestName: rand() < 0.4 ? GUEST_NAMES[randInt(0, GUEST_NAMES.length - 1)] : undefined,
        note: rand() < 0.2 ? ORDER_NOTES[randInt(0, ORDER_NOTES.length - 1)] : undefined,
      };
      const roll = rand();
      if (roll < 0.06) {
        order.status = 'rejected';
        order.rejectedReason = REJECT_REASONS[randInt(0, REJECT_REASONS.length - 1)];
        order.closedAt = new Date(createdAt.getTime() + randInt(40, 240) * 1000);
      } else if (roll < 0.1) {
        order.status = 'expired';
        order.closedAt = new Date(createdAt.getTime() + 20 * MINUTE_MS);
      } else if (roll < 0.13) {
        order.status = 'cancelled';
        order.closedAt = new Date(createdAt.getTime() + randInt(20, 120) * 1000);
      } else {
        order.acceptedAt = new Date(createdAt.getTime() + randInt(25, 240) * 1000);
        order.deliveredAt = new Date(order.acceptedAt.getTime() + randInt(4, 18) * MINUTE_MS);
        order.closedAt = order.deliveredAt;
        if (restaurant.modules.payments) {
          const pay = rand();
          if (pay < 0.45) {
            order.paymentStatus = 'paid';
            order.tipPercent = [0, 0, 5, 10, 10, 15][randInt(0, 5)];
          } else if (pay < 0.8) {
            order.paymentStatus = 'cash';
          }
        }
      }
      orders.push(order);
    }
  }
  // Open right now: two waiting for a waiter, one being prepared (the seeded waiter screen is never empty).
  const byNumber = (number: number) => tables.find((t) => t.number === number) ?? tables[0]!;
  orders.push(
    {
      createdAt: minutesAgo(11),
      status: 'accepted',
      acceptedAt: minutesAgo(9),
      table: byNumber(5),
      guestName: 'Jelena',
      lines: randomLines(items, restaurant.defaultLocale, restaurant.defaultLocale),
    },
    {
      createdAt: minutesAgo(9),
      status: 'new',
      table: byNumber(2),
      lines: randomLines(items, restaurant.defaultLocale, restaurant.defaultLocale),
    },
    {
      createdAt: minutesAgo(2),
      status: 'new',
      table: byNumber(7),
      guestName: 'Marko',
      note: 'Sve odjednom, molim.',
      lines: randomLines(items, restaurant.defaultLocale, restaurant.defaultLocale).map((line, index) =>
        index === 0 ? { ...line, lineNote: 'bez čilija' } : line,
      ),
    },
  );

  // Daily sequential numbers in creation order.
  orders.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  let day = '';
  let number = 0;
  const rows = orders.map((order) => {
    const orderDay = formatZonedDate(order.createdAt, TIMEZONE);
    if (orderDay !== day) {
      day = orderDay;
      number = 0;
    }
    number += 1;
    const totalCents = order.lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
    const lastChange = order.closedAt ?? order.acceptedAt ?? order.createdAt;
    return {
      id: randomUUID(),
      restaurantId: restaurant.id,
      tableId: order.table.id,
      tableNumber: order.table.number,
      sessionId: randomUUID(),
      status: order.status,
      number,
      guestName: order.guestName ?? null,
      note: order.note ?? null,
      totalCents,
      locale: order.lines[0]?.name.en && !order.lines[0]?.name.sr ? 'en' : restaurant.defaultLocale,
      rejectedReason: order.rejectedReason ?? null,
      paymentStatus: order.paymentStatus ?? 'unpaid',
      tipCents: order.paymentStatus === 'paid' ? tipCentsFor(totalCents, order.tipPercent ?? 0) : 0,
      paidAmountCents:
        order.paymentStatus === 'paid'
          ? totalCents + tipCentsFor(totalCents, order.tipPercent ?? 0)
          : order.paymentStatus === 'cash'
            ? totalCents
            : null,
      paidAt: order.paymentStatus ? (order.deliveredAt ?? lastChange) : null,
      providerRef: order.paymentStatus === 'paid' ? `mock_seed_${randomUUID().slice(0, 12)}` : null,
      acceptedAt: order.acceptedAt ?? null,
      deliveredAt: order.deliveredAt ?? null,
      closedAt: order.closedAt ?? null,
      createdAt: order.createdAt,
      updatedAt: lastChange,
      lines: order.lines,
    };
  });
  await Order.bulkCreate(
    rows.map(({ lines: _lines, ...row }) => row),
    { transaction },
  );
  await OrderItem.bulkCreate(
    rows.flatMap((row) => row.lines.map((line, index) => ({ orderId: row.id, ...line, sortOrder: index }))),
    { transaction },
  );

  const requests: { table: RestaurantTable; type: ServiceRequestType; createdAt: Date }[] = [
    { table: byNumber(4), type: 'call_waiter', createdAt: minutesAgo(1) },
    { table: byNumber(8), type: 'bill', createdAt: minutesAgo(3) },
  ];
  await ServiceRequest.bulkCreate(
    requests.map((request) => ({
      restaurantId: restaurant.id,
      tableId: request.table.id,
      tableNumber: request.table.number,
      type: request.type,
      status: 'open' as const,
      createdAt: request.createdAt,
      updatedAt: request.createdAt,
    })),
    { transaction },
  );
  logger.info({ slug: restaurant.slug, orders: rows.length, requests: requests.length }, 'Seeded orders');
}

async function seedRestaurant(def: SeedRestaurant, transaction: Transaction): Promise<void> {
  const owner = await User.create(
    { email: def.owner.email, name: def.owner.name, passwordHash: await hashPassword(def.owner.password) },
    { transaction },
  );
  const restaurant = await Restaurant.create(
    {
      slug: def.slug,
      name: def.name,
      tagline: def.tagline ?? null,
      menuNote: def.menuNote ?? null,
      primaryColor: def.primaryColor ?? RESTAURANT_DEFAULTS.primaryColor,
      city: def.city,
      address: def.address ?? null,
      status: def.status,
      plan: def.plan,
      trialEndsAt: def.trialEndsAt ?? null,
      publishedAt: def.publishedAt ?? null,
      orderingMode: def.orderingMode ?? RESTAURANT_DEFAULTS.orderingMode,
      modules: { ...DEFAULT_MODULES, ...def.modules },
      paymentConfig: def.paymentConfig
        ? {
            provider: def.paymentConfig.provider,
            merchantId: def.paymentConfig.merchantId,
            secretEncrypted: encryptSecret(def.paymentConfig.secret),
            tipPresets: def.paymentConfig.tipPresets,
            receiptEmailEnabled: def.paymentConfig.receiptEmailEnabled,
          }
        : null,
    },
    { transaction },
  );
  await Membership.create({ userId: owner.id, restaurantId: restaurant.id, role: 'owner' }, { transaction });
  for (const member of def.staff ?? []) {
    const staff = await User.create({ email: member.email, name: member.name, passwordHash: await hashPassword(member.password) }, { transaction });
    await Membership.create({ userId: staff.id, restaurantId: restaurant.id, role: 'staff' }, { transaction });
  }

  const viewableItems: { id: string; popularity: number }[] = [];
  const orderableItems: OrderableItem[] = [];
  for (const [categoryIndex, category] of def.categories.entries()) {
    const created = await Category.create(
      { restaurantId: restaurant.id, name: category.name, sortOrder: categoryIndex, isHidden: category.isHidden ?? false },
      { transaction },
    );
    for (const [itemIndex, item] of category.items.entries()) {
      const record = await MenuItem.create(
        {
          restaurantId: restaurant.id,
          categoryId: created.id,
          name: item.name,
          description: item.description ?? null,
          priceCents: item.priceCents,
          allergens: item.allergens ?? [],
          tags: item.tags ?? [],
          isAvailable: item.isAvailable ?? true,
          sortOrder: itemIndex,
          // Demo venue with a register: every item gets a code (K-<category><item>) so the mock POS can open/close orders.
          posProductCode: item.posProductCode ?? (def.posConfig ? `K-${categoryIndex + 1}${String(itemIndex + 1).padStart(2, '0')}` : null),
        },
        { transaction },
      );
      let variants: ItemVariant[] = [];
      if (item.variants?.length) {
        variants = await ItemVariant.bulkCreate(
          item.variants.map((variant, index) => ({
            menuItemId: record.id,
            name: variant.name,
            priceCents: variant.priceCents,
            sortOrder: index,
          })),
          { transaction, returning: true },
        );
      }
      if (!category.isHidden) {
        viewableItems.push({ id: record.id, popularity: item.popularity });
        if (item.isAvailable !== false) {
          orderableItems.push({
            id: record.id,
            name: item.name,
            priceCents: item.priceCents,
            variants: variants.map((v) => ({ id: v.id, name: v.name, priceCents: v.priceCents })),
          });
        }
      }
    }
  }

  const tables = await RestaurantTable.bulkCreate(
    def.tables.map((table, index) => ({
      restaurantId: restaurant.id,
      number: table.number,
      label: table.label,
      sortOrder: index,
    })),
    { transaction, returning: true },
  );

  const tableWeights = tables.map((_, index) => (index < 2 ? 3 : index < 6 ? 2 : 1));
  const itemWeights = viewableItems.map((item) => item.popularity);
  const scans: { id: string; restaurantId: string; tableId: string | null; sessionId: string; scannedAt: Date }[] = [];
  const views: { scanEventId: string; menuItemId: string; viewedAt: Date }[] = [];

  for (let dayOffset = def.scanDays - 1; dayOffset >= 0; dayOffset--) {
    const dayStart = startOfDayInZone(now, TIMEZONE, -dayOffset);
    const weekday = new Date(dayStart.getTime() + 12 * 3600_000).getUTCDay();
    const boost = weekday === 0 || weekday === 6 ? 1.3 : 1;
    const count = Math.round(randInt(def.dailyScans[0], def.dailyScans[1]) * boost);
    for (let i = 0; i < count; i++) {
      const hour = weightedPick(HOURS, HOUR_WEIGHTS);
      const scannedAt = new Date(dayStart.getTime() + hour * 3600_000 + randInt(0, 3599) * 1000);
      if (scannedAt.getTime() > now.getTime()) continue;
      const table = rand() < 0.08 ? null : weightedPick(tables, tableWeights);
      const scan = { id: randomUUID(), restaurantId: restaurant.id, tableId: table?.id ?? null, sessionId: randomUUID(), scannedAt };
      scans.push(scan);
      const viewCount = viewableItems.length ? weightedPick(VIEW_COUNTS, VIEW_WEIGHTS) : 0;
      for (let v = 0; v < viewCount; v++) {
        const item = weightedPick(viewableItems, itemWeights);
        views.push({ scanEventId: scan.id, menuItemId: item.id, viewedAt: new Date(scannedAt.getTime() + randInt(5, 900) * 1000) });
      }
    }
  }
  for (let i = 0; i < scans.length; i += 1000) {
    await ScanEvent.bulkCreate(scans.slice(i, i + 1000), { transaction });
  }
  for (let i = 0; i < views.length; i += 1000) {
    await ItemView.bulkCreate(views.slice(i, i + 1000), { transaction });
  }
  if (def.posConfig) {
    await restaurant.update(
      {
        posConfig: {
          provider: def.posConfig.provider,
          baseUrl: def.posConfig.baseUrl,
          apiKeyEncrypted: encryptSecret(def.posConfig.apiKey),
          // Our table ids → the register's table names (here simply the table number).
          tableMapping: Object.fromEntries(tables.map((table) => [table.id, String(table.number)])),
          sendOrdersToPos: def.posConfig.sendOrdersToPos,
          closeOnPayment: def.posConfig.closeOnPayment,
          printOnClose: false,
          closeMode: def.posConfig.closeMode,
        },
      },
      { transaction },
    );
  }
  if (def.orderDays) await seedOrders(restaurant, tables, orderableItems, def.orderDays, transaction);
  logger.info(
    { slug: def.slug, categories: def.categories.length, tables: tables.length, scans: scans.length, itemViews: views.length },
    `Seeded ${def.name}`,
  );
}

async function main(): Promise<void> {
  if (env.isProduction && process.env.ALLOW_SEED !== '1') {
    logger.fatal('Refusing to seed demo data in production (it deletes venues with the demo slugs and creates well-known logins). Set ALLOW_SEED=1 to override.');
    process.exit(2);
  }
  await runMigrations();
  const all = [kafeterija, ...others];
  await sequelize.transaction(async (transaction) => {
    // Re-runnable: wipe whatever a previous seed created (FKs cascade).
    await Restaurant.destroy({ where: { slug: all.map((r) => r.slug) }, transaction });
    await User.destroy({
      where: { email: [SUPERADMIN.email, ...all.map((r) => r.owner.email), ...all.flatMap((r) => (r.staff ?? []).map((m) => m.email))] },
      transaction,
    });

    await User.create(
      { email: SUPERADMIN.email, name: SUPERADMIN.name, passwordHash: await hashPassword(SUPERADMIN.password), isSuperadmin: true },
      { transaction },
    );
    for (const def of all) await seedRestaurant(def, transaction);
  });

  const today = zonedParts(now, TIMEZONE);
  logger.info(
    `Seed complete (${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')} ${TIMEZONE}).\n` +
      `  superadmin: ${SUPERADMIN.email} / ${SUPERADMIN.password}\n` +
      `  demo owner: ${kafeterija.owner.email} / ${kafeterija.owner.password} (restaurant "${kafeterija.name}", slug "${kafeterija.slug}")\n` +
      `  demo staff: ${(kafeterija.staff ?? []).map((m) => m.email).join(', ')} / tabla1234 (service screens only; no owner PIN is seeded)\n` +
      `  other owners: ${others.map((r) => r.owner.email).join(', ')} / tabla1234`,
  );
}

main()
  .then(() => sequelize.close())
  .then(() => process.exit(0))
  .catch(async (error: unknown) => {
    logger.error({ err: error }, 'Seed failed');
    await sequelize.close();
    process.exit(1);
  });
