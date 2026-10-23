import {
  DEFAULT_FEATURE_FLAGS,
  hasModule,
  moduleAvailable,
  visibleModules,
  type FeatureFlags,
  type ModuleKey,
  type RestaurantModules,
} from '@qr-menu/shared';
import { env } from './env.js';

/**
 * Global feature flags (Phase 10): `FEATURE_PAYMENTS` (default off) and `FEATURE_POS` (default on). They sit above
 * the per-venue modules — see `visibleModules()` in shared. Tests flip them through `setFeaturesForTests()`; the
 * object is read on every request, so routers do not need rebuilding (only `createApp()` mounts differ).
 */
export const features: FeatureFlags = {
  payments: env.FEATURE_PAYMENTS,
  pos: env.FEATURE_POS,
};

/** True unless the module is governed by a flag that is off in this deployment. */
export function featureEnabled(module: ModuleKey): boolean {
  return moduleAvailable(features, module);
}

/** The venue has the module *and* the deployment offers it. Use this instead of `hasModule()` inside the API. */
export function moduleOn(restaurant: { modules?: Partial<RestaurantModules> | null } | null | undefined, module: ModuleKey): boolean {
  return featureEnabled(module) && hasModule(restaurant, module);
}

/** Modules for a DTO: what the venue stored, minus every module whose feature is off. */
export function dtoModules(modules: Partial<RestaurantModules> | null | undefined): RestaurantModules {
  return visibleModules({ ordering: false, payments: false, pos: false, ...modules }, features);
}

/** Test hook: override one or more flags; returns a function that restores the previous values. */
export function setFeaturesForTests(overrides: Partial<FeatureFlags>): () => void {
  const previous = { ...features };
  Object.assign(features, overrides);
  return () => {
    Object.assign(features, previous);
  };
}

export { DEFAULT_FEATURE_FLAGS };
