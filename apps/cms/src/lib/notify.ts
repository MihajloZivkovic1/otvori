import { notificationsAsked } from './storage';

/** Alerts for a new order / call on the waiter screen: a short bundled sound, a vibration and (in the background) a system notification. */

let audio: HTMLAudioElement | null = null;

function sound(): HTMLAudioElement | null {
  if (audio) return audio;
  if (typeof Audio === 'undefined') return null;
  audio = new Audio('/sounds/order.wav');
  audio.preload = 'auto';
  return audio;
}

/** Create the element early (first user gesture) so the first real alert does not wait for the download. */
export function primeAlertSound(): void {
  sound()?.load();
}

export function playAlertSound(): void {
  const element = sound();
  if (!element) return;
  try {
    element.currentTime = 0;
    // Browsers refuse to play before the user interacted with the page; the badge and title still change.
    void element.play().catch(() => undefined);
  } catch {
    // ignore
  }
}

export function vibrate(): void {
  try {
    navigator.vibrate?.([120, 60, 120]);
  } catch {
    // unsupported
  }
}

/** Only while the tab is hidden and the user granted permission. */
export function notifyInBackground(title: string, body: string, tag: string, onClick: () => void): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || !document.hidden) return;
  try {
    const notification = new Notification(title, { body, tag, icon: '/icons/icon-192.png' });
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  } catch {
    // ignore
  }
}

/** Ask once, from a user gesture (browsers ignore unsolicited prompts). */
export async function requestNotificationPermission(): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default' || notificationsAsked.get()) return;
  notificationsAsked.set();
  try {
    await Notification.requestPermission();
  } catch {
    // ignore
  }
}
