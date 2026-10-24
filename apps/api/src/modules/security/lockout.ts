import { PIN_LIMITS } from '@qr-menu/shared';

interface Counter {
  failures: number;
  lockedUntil: number | null;
}

/**
 * PIN attempt counters, in memory (single API instance, like the SSE bus): keyed per restaurant and per sign-in
 * session, 5 wrong attempts → 15-minute lockout. Lockouts themselves are persisted in the audit log, which is what
 * the "e-mail the owner after the 2nd lockout" rule counts.
 */
const counters = new Map<string, Counter>();

const keysFor = (restaurantId: string, sessionId: string | null) => [
  `r:${restaurantId}`,
  `s:${restaurantId}:${sessionId ?? 'anonymous'}`,
];

/** When the caller may not try (the later of the two lockouts), or null. */
export function lockedUntil(restaurantId: string, sessionId: string | null, now = Date.now()): Date | null {
  let until: number | null = null;
  for (const key of keysFor(restaurantId, sessionId)) {
    const counter = counters.get(key);
    if (counter?.lockedUntil && counter.lockedUntil > now) until = Math.max(until ?? 0, counter.lockedUntil);
  }
  return until ? new Date(until) : null;
}

/** Registers a wrong attempt; returns the lockout that just started (if any) and the attempts left before one. */
export function registerFailure(
  restaurantId: string,
  sessionId: string | null,
  now = Date.now(),
): { lockedUntil: Date | null; attemptsLeft: number } {
  let started: number | null = null;
  let attemptsLeft: number = PIN_LIMITS.maxAttempts;
  for (const key of keysFor(restaurantId, sessionId)) {
    const counter = counters.get(key) ?? { failures: 0, lockedUntil: null };
    if (counter.lockedUntil && counter.lockedUntil <= now) {
      counter.failures = 0;
      counter.lockedUntil = null;
    }
    counter.failures += 1;
    if (counter.failures >= PIN_LIMITS.maxAttempts) {
      counter.lockedUntil = now + PIN_LIMITS.lockoutMinutes * 60_000;
      counter.failures = 0;
      started = Math.max(started ?? 0, counter.lockedUntil);
    }
    attemptsLeft = Math.min(attemptsLeft, PIN_LIMITS.maxAttempts - counter.failures);
    counters.set(key, counter);
  }
  return { lockedUntil: started ? new Date(started) : null, attemptsLeft };
}

/** A correct PIN clears the session's counter (the restaurant-wide one keeps counting other sessions). */
export function registerSuccess(restaurantId: string, sessionId: string | null): void {
  counters.delete(`s:${restaurantId}:${sessionId ?? 'anonymous'}`);
  const key = `r:${restaurantId}`;
  const counter = counters.get(key);
  if (counter && !counter.lockedUntil) counter.failures = Math.max(0, counter.failures - 1);
}

/** Tests only. */
export function resetPinLockouts(): void {
  counters.clear();
}
