/** localStorage/sessionStorage access that never throws (private mode, blocked storage). */

const LAST_RESTAURANT = 'tabla.cms.lastRestaurant';
const REMEMBER = 'tabla.cms.remember';
const SESSION = 'tabla.cms.session';
const INSTALL_DISMISSED = 'tabla.cms.installDismissed';
const ORDERS_MUTED = 'tabla.cms.ordersMuted';
const NOTIFICATIONS_ASKED = 'tabla.cms.notificationsAsked';
const UNLOCK_WINDOW = 'tabla.cms.unlockWindow';

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}
function write(storage: Storage, key: string, value: string | null): void {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Last opened venue, remembered per user so switching accounts on one device never lands in the wrong venue. */
export const lastRestaurant = {
  get: (userId: string): string | null => read(localStorage, `${LAST_RESTAURANT}.${userId}`),
  set: (userId: string, id: string | null): void => write(localStorage, `${LAST_RESTAURANT}.${userId}`, id),
};

/**
 * "Remember me" semantics: the refresh cookie always lives 30 days on the server, but the CMS only restores a
 * session silently when the user asked to be remembered, or while the same browser tab is still open.
 */
export const sessionFlags = {
  shouldRestore: (): boolean => read(localStorage, REMEMBER) === '1' || read(sessionStorage, SESSION) === '1',
  markSignedIn(remember: boolean): void {
    write(localStorage, REMEMBER, remember ? '1' : null);
    write(sessionStorage, SESSION, '1');
  },
  clear(): void {
    write(localStorage, REMEMBER, null);
    write(sessionStorage, SESSION, null);
  },
};

export const installHint = {
  dismissed: (): boolean => read(localStorage, INSTALL_DISMISSED) === '1',
  dismiss: (): void => write(localStorage, INSTALL_DISMISSED, '1'),
};

/** Waiter screen: alert sound off/on (device-wide, survives reloads). */
export const ordersMuted = {
  get: (): boolean => read(localStorage, ORDERS_MUTED) === '1',
  set: (muted: boolean): void => write(localStorage, ORDERS_MUTED, muted ? '1' : null),
};

/** The system-notification permission prompt is shown once. */
export const notificationsAsked = {
  get: (): boolean => read(localStorage, NOTIFICATIONS_ASKED) === '1',
  set: (): void => write(localStorage, NOTIFICATIONS_ASKED, '1'),
};

/** Owner PIN keypad: the window picked last time on this device (1 / 5 / 15 minutes or until sign-out). */
export const unlockWindow = {
  get: (): string | null => read(localStorage, UNLOCK_WINDOW),
  set: (value: string): void => write(localStorage, UNLOCK_WINDOW, value),
};
