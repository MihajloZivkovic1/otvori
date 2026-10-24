import { AsyncLocalStorage } from 'node:async_hooks';
import type { MembershipRole } from '@qr-menu/shared';

/** Who is acting in the current request; set by requireMembership(), read by audit.record(). */
export interface Actor {
  userId: string | null;
  name: string | null;
  email: string | null;
  role: MembershipRole | 'superadmin' | null;
  /** Read lazily: requireOwner marks the request elevated after requireMembership already opened the context. */
  elevated: () => boolean;
  ip: string | null;
}

const storage = new AsyncLocalStorage<Actor>();

export function runWithActor<T>(actor: Actor, fn: () => T): T {
  return storage.run(actor, fn);
}

/** Null outside a request (seeds, jobs, tests calling services directly). */
export function currentActor(): Actor | null {
  return storage.getStore() ?? null;
}
