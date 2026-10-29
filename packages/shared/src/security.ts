/**
 * Owner PIN, elevation windows, team invites and the audit log (Phase 11).
 * The CMS and the API share these so the keypad, the guards and the tests agree on every number.
 */

/** How long one correct PIN keeps owner actions unlocked on a device. `session` = until sign-out. */
export const ELEVATION_WINDOWS = ['1', '5', '15', 'session'] as const;
export type ElevationWindow = (typeof ELEVATION_WINDOWS)[number];
export const DEFAULT_ELEVATION_WINDOW: ElevationWindow = '5';

export const PIN_LIMITS = {
  /** Exactly four digits. */
  length: 4,
  /** Wrong attempts before the lockout, counted per session and per restaurant. */
  maxAttempts: 5,
  lockoutMinutes: 15,
  /** The owner gets an e-mail once a restaurant has had this many lockouts in 24 hours. */
  lockoutsBeforeEmail: 2,
  /**
   * Longest lifetime of one elevation token (minutes). The `session` window renews it in the background
   * (POST …/security/extend) for as long as the app stays open and the user signed in.
   */
  maxTokenMinutes: 15,
} as const;

/** Elevation token lifetime in seconds for a window (`session` tokens renew; see PIN_LIMITS.maxTokenMinutes). */
export function elevationSeconds(window: ElevationWindow): number {
  if (window === 'session') return PIN_LIMITS.maxTokenMinutes * 60;
  return Math.min(Number(window), PIN_LIMITS.maxTokenMinutes) * 60;
}

/**
 * The 20 most common 4-digit PINs (DataGenetics' analysis of leaked PIN sets covers roughly a quarter of all PINs
 * with these) — rejected outright, together with any repeated digit and straight runs such as 0123 / 9876.
 */
export const COMMON_PINS = new Set([
  '1234', '1111', '0000', '1212', '7777', '1004', '2000', '4444', '2222', '6969',
  '9999', '3333', '5555', '6666', '1122', '1313', '8888', '4321', '2001', '1010',
]);

/** Why a PIN is refused, or null when it is acceptable. */
export function weakPinReason(pin: string): string | null {
  if (!/^\d{4}$/.test(pin)) return 'The PIN must be exactly 4 digits';
  if (COMMON_PINS.has(pin)) return 'That PIN is one of the most common ones — pick something less obvious';
  if (/^(\d)\1{3}$/.test(pin)) return 'A PIN made of one repeated digit is too easy to guess';
  const digits = pin.split('').map(Number);
  const ascending = digits.every((d, i) => i === 0 || d === digits[i - 1]! + 1);
  const descending = digits.every((d, i) => i === 0 || d === digits[i - 1]! - 1);
  if (ascending || descending) return 'A straight run of digits is too easy to guess';
  return null;
}

export const TEAM_LIMITS = {
  /** E-mail invites expire after this many days. */
  inviteDays: 7,
  /** The 6-digit join code a waiter types on the login screen stays valid for this long. */
  joinCodeHours: 24,
  joinCodeLength: 6,
} as const;

export const AUDIT_LIMITS = {
  /** Entries older than this are deleted by the retention job. */
  retentionDays: 90,
  pageSize: 50,
  maxPageSize: 200,
} as const;

/** Everything the audit log records. The entity names are singular; `*.reorder` carries the ordered ids. */
export const AUDIT_ACTIONS = [
  'restaurant.update',
  'restaurant.logo',
  'restaurant.publish',
  'restaurant.delete',
  'category.create',
  'category.update',
  'category.delete',
  'category.reorder',
  'item.create',
  'item.update',
  'item.delete',
  'item.reorder',
  'item.image',
  'item.availability',
  'table.create',
  'table.update',
  'table.delete',
  'table.reorder',
  'table.block',
  'table.unblock',
  'payment_config.update',
  'pos_config.update',
  'pos.sync',
  'order.accept',
  'order.reject',
  'order.deliver',
  'order.cash',
  'order.fiscal_retry',
  'order.fiscal_manual',
  'request.done',
  'auth.login',
  'auth.pin_set',
  'auth.pin_change',
  'auth.pin_remove',
  'auth.pin_unlock',
  'auth.pin_failed',
  'auth.pin_lockout',
  'team.invite',
  'team.invite_revoke',
  'team.join_code',
  'team.join',
  'team.remove',
  'team.role',
  'team.digest',
  // Phase 13: superadmin area (platform-level rows have no venue unless the action is about one)
  'auth.impersonate',
  'auth.password_change',
  'auth.sessions_revoke',
  'admin.restaurant_create',
  'admin.restaurant_update',
  'admin.restaurant_delete',
  'admin.member_add',
  'admin.member_role',
  'admin.member_remove',
  'admin.user_update',
  'admin.user_reset_password',
  'admin.user_magic_link',
  'admin.user_deactivate',
  'admin.user_activate',
  'admin.welcome_email',
  'admin.pos_job_retry',
  'menu.import',
  'menu.copy',
  'table.bulk_create',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Filters offered by the history screen; each is a set of actions. */
export const AUDIT_KINDS = ['all', 'prices', 'menu', 'availability', 'orders', 'auth', 'team', 'settings', 'admin'] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

export const AUDIT_KIND_ACTIONS: Record<Exclude<AuditKind, 'all' | 'prices'>, readonly AuditAction[]> = {
  menu: ['category.create', 'category.update', 'category.delete', 'category.reorder', 'item.create', 'item.update', 'item.delete', 'item.reorder', 'item.image', 'pos.sync', 'menu.import', 'menu.copy'],
  availability: ['item.availability'],
  orders: ['order.accept', 'order.reject', 'order.deliver', 'order.cash', 'order.fiscal_retry', 'order.fiscal_manual', 'request.done', 'table.block', 'table.unblock'],
  auth: ['auth.login', 'auth.pin_set', 'auth.pin_change', 'auth.pin_remove', 'auth.pin_unlock', 'auth.pin_failed', 'auth.pin_lockout', 'auth.impersonate', 'auth.password_change', 'auth.sessions_revoke'],
  team: ['team.invite', 'team.invite_revoke', 'team.join_code', 'team.join', 'team.remove', 'team.role', 'team.digest'],
  settings: ['restaurant.update', 'restaurant.logo', 'restaurant.publish', 'restaurant.delete', 'table.create', 'table.update', 'table.delete', 'table.reorder', 'table.bulk_create', 'payment_config.update', 'pos_config.update'],
  admin: [
    'auth.impersonate',
    'admin.restaurant_create',
    'admin.restaurant_update',
    'admin.restaurant_delete',
    'admin.member_add',
    'admin.member_role',
    'admin.member_remove',
    'admin.user_update',
    'admin.user_reset_password',
    'admin.user_magic_link',
    'admin.user_deactivate',
    'admin.user_activate',
    'admin.welcome_email',
    'admin.pos_job_retry',
  ],
};

/** True when an item change touched a price (base price or any variant price). */
export function isPriceChange(entry: { action: string; before?: unknown; after?: unknown }): boolean {
  if (entry.action !== 'item.update' && entry.action !== 'item.create' && entry.action !== 'pos.sync') return false;
  const keys = (value: unknown) => (value && typeof value === 'object' ? Object.keys(value as object) : []);
  const touched = new Set([...keys(entry.before), ...keys(entry.after)]);
  return touched.has('priceCents') || touched.has('variants') || touched.has('priceChanges');
}
