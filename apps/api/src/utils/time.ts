/**
 * Time-zone helpers built on Intl so no date library is needed.
 * All functions take IANA zone names such as "Europe/Belgrade".
 */

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** Wall-clock components of `date` in `timeZone`. */
export function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = formatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

/** UTC offset of `timeZone` at `date`, in milliseconds (positive east of UTC). */
export function zonedOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const truncated = Math.floor(date.getTime() / 1000) * 1000;
  return asUtc - truncated;
}

/** The instant at which the given wall-clock time occurs in `timeZone`. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = wall;
  // Two passes converge across DST transitions.
  for (let i = 0; i < 2; i++) {
    guess = wall - zonedOffsetMs(new Date(guess), timeZone);
  }
  return new Date(guess);
}

/** Start of the calendar day (00:00) in `timeZone` that contains `date`, shifted by `dayOffset` days. */
export function startOfDayInZone(date: Date, timeZone: string, dayOffset = 0): Date {
  const p = zonedParts(date, timeZone);
  const shifted = new Date(Date.UTC(p.year, p.month - 1, p.day + dayOffset));
  return zonedTimeToUtc(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), 0, 0, timeZone);
}

/**
 * Next occurrence of hh:mm in `timeZone` strictly after `now`
 * (today if that time has not passed yet, otherwise tomorrow).
 */
export function nextOccurrenceOfTime(hour: number, minute: number, timeZone: string, now = new Date()): Date {
  const p = zonedParts(now, timeZone);
  const today = zonedTimeToUtc(p.year, p.month, p.day, hour, minute, timeZone);
  if (today.getTime() > now.getTime()) return today;
  const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return zonedTimeToUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    hour,
    minute,
    timeZone,
  );
}

/** "YYYY-MM-DD" of `date` as seen in `timeZone`. */
export function formatZonedDate(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
