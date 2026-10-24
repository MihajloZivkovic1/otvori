import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ElevationWindow, RestaurantDto } from '@qr-menu/shared';
import { elevationStore, setElevationHandler, type Elevation } from '../../lib/elevation';
import { extendElevation } from '../../lib/queries';
import { PinKeypad } from './PinKeypad';

export interface ElevationContextValue {
  /** The venue has an owner PIN and the signed-in member is an owner: owner actions need the keypad. */
  pinSet: boolean;
  /** True while owner actions would be refused: PIN set, owner, no valid elevation on this device. */
  locked: boolean;
  /** Current elevation (null when locked or when no PIN applies). */
  elevation: Elevation | null;
  /** Resolves true when owner actions may proceed (immediately when no PIN applies), false if the keypad was cancelled. */
  ensureElevated: () => Promise<boolean>;
  /** "Lock" in the top bar: forget the elevation on this device now. */
  lock: () => void;
}

const NONE: ElevationContextValue = {
  pinSet: false,
  locked: false,
  elevation: null,
  ensureElevated: () => Promise.resolve(true),
  lock: () => undefined,
};

const ElevationContext = createContext<ElevationContextValue>(NONE);

export function useElevation(): ElevationContextValue {
  return useContext(ElevationContext);
}

/** Renew `session` elevations this long before they expire. */
const EXTEND_BEFORE_MS = 2 * 60_000;

interface Props {
  restaurant: RestaurantDto;
  isOwner: boolean;
  children: ReactNode;
}

/**
 * Owner PIN (Phase 11). Tracks this device's elevation for the venue, shows the keypad on demand (from a guarded
 * control or from the API client after a 403 PIN_REQUIRED) and renews "until sign-out" tokens in the background.
 */
export function ElevationProvider({ restaurant, isOwner, children }: Props) {
  const rid = restaurant.id;
  const applies = restaurant.pinSet && isOwner;
  const [elevation, setElevationState] = useState<Elevation | null>(() => elevationStore.get(rid));
  const [request, setRequest] = useState<{ resolve: (ok: boolean) => void } | null>(null);
  const pending = useRef<Promise<boolean> | null>(null);

  // Follow the store (sign-in elevations, unlock, lock, expiry).
  useEffect(() => {
    const sync = () => setElevationState(elevationStore.get(rid));
    sync();
    const unsubscribe = elevationStore.subscribe(sync);
    return () => {
      unsubscribe();
    };
  }, [rid]);

  // Flip to locked exactly when the token runs out; renew `session` tokens shortly before.
  useEffect(() => {
    if (!elevation) return;
    const remaining = new Date(elevation.expiresAt).getTime() - Date.now();
    if (elevation.window === 'session') {
      const timer = setTimeout(
        () => {
          extendElevation(rid)
            .then((next) => elevationStore.setFromDto(next))
            .catch(() => elevationStore.clear(rid));
        },
        Math.max(1_000, remaining - EXTEND_BEFORE_MS),
      );
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => elevationStore.clear(rid), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [elevation, rid]);

  const ensureElevated = useCallback((): Promise<boolean> => {
    if (!applies || elevationStore.get(rid)) return Promise.resolve(true);
    if (pending.current) return pending.current;
    const promise = new Promise<boolean>((resolve) => {
      setRequest({
        resolve: (ok) => {
          pending.current = null;
          setRequest(null);
          resolve(ok);
        },
      });
    });
    pending.current = promise;
    return promise;
  }, [applies, rid]);

  // The API client asks here after a 403 PIN_REQUIRED (owner request from devtools-level or expired token).
  useEffect(() => {
    setElevationHandler((requested) => (requested === rid ? ensureElevated() : Promise.resolve(false)));
    return () => setElevationHandler(null);
  }, [rid, ensureElevated]);

  const lock = useCallback(() => elevationStore.clear(rid), [rid]);

  const value = useMemo<ElevationContextValue>(
    () => ({
      pinSet: applies,
      locked: applies && elevation === null,
      elevation: applies ? elevation : null,
      ensureElevated,
      lock,
    }),
    [applies, elevation, ensureElevated, lock],
  );

  return (
    <ElevationContext.Provider value={value}>
      {children}
      {request ? (
        <PinKeypad
          restaurant={restaurant}
          onUnlocked={(dto) => {
            elevationStore.setFromDto(dto);
            request.resolve(true);
          }}
          onCancel={() => request.resolve(false)}
        />
      ) : null}
    </ElevationContext.Provider>
  );
}

/** "Owner action" wrapper: runs `fn` once the device is unlocked (or straight away when no PIN applies). */
export function useGuard(): { locked: boolean; guard: <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => void } {
  const { locked, ensureElevated } = useElevation();
  const guard = useCallback(
    <A extends unknown[]>(fn: (...args: A) => void) =>
      (...args: A) => {
        void ensureElevated().then((ok) => {
          if (ok) fn(...args);
        });
      },
    [ensureElevated],
  );
  return { locked, guard };
}

export type { ElevationWindow };
