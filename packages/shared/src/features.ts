import { z } from 'zod';
import type { ModuleKey, RestaurantModules } from './modules.js';

/**
 * Global feature flags (Phase 10). They come from the API's environment (`FEATURE_PAYMENTS`, `FEATURE_POS`) and sit
 * above the per-venue modules: a module whose feature is off is unavailable for *every* venue, whatever the venue's
 * own `modules` say — the API hides it in every DTO, answers 404 on its routes and refuses to switch it on.
 * `payments` defaults to **false** so `main` can be deployed while the bank integration is still being built; CI
 * fails if that default changes (scripts/check-feature-defaults.mjs).
 */
export const FEATURE_KEYS = ['payments', 'pos'] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const featureFlagsSchema = z.object({
  payments: z.boolean(),
  pos: z.boolean(),
});
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = { payments: false, pos: true };

/** The flag that governs a module; `ordering` has none (always available). */
export function featureFor(module: ModuleKey): FeatureKey | null {
  return module === 'payments' || module === 'pos' ? module : null;
}

/** True unless the module is governed by a feature flag that is off. */
export function moduleAvailable(features: FeatureFlags | null | undefined, module: ModuleKey): boolean {
  const key = featureFor(module);
  return key === null || (features ?? DEFAULT_FEATURE_FLAGS)[key];
}

/** A venue's modules as the rest of the system should see them: a module without its feature reads as off. */
export function visibleModules(modules: RestaurantModules, features: FeatureFlags | null | undefined): RestaurantModules {
  return {
    ordering: modules.ordering,
    payments: modules.payments && moduleAvailable(features, 'payments'),
    pos: modules.pos && moduleAvailable(features, 'pos'),
  };
}
