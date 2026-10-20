/**
 * Effective availability = is_available AND (unavailable_until IS NULL OR unavailable_until < now()).
 * Shared so the CMS can show the same state the public menu will.
 */
export function isEffectivelyAvailable(
  isAvailable: boolean,
  unavailableUntil: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isAvailable) return false;
  if (unavailableUntil == null) return true;
  const until = unavailableUntil instanceof Date ? unavailableUntil : new Date(unavailableUntil);
  if (Number.isNaN(until.getTime())) return true;
  return until.getTime() < now.getTime();
}
