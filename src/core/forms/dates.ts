// Pure date helpers (no imports) so audit scripts can execute them directly under Node.
// Single source of date rules for FairPathDatePicker and every screen that validates a date.

/** dob: born in the past (1900..today). past: on or before today. future: today or later (next 10 years). any: 1900..+30 years. */
export type DateKind = 'dob' | 'past' | 'future' | 'any';
export type DateBounds = { min: Date; max: Date };

export const MIN_YEAR = 1900;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function boundsForKind(kind: DateKind, now: Date = new Date()): DateBounds {
  const today = startOfDay(now);
  const y = today.getFullYear();
  switch (kind) {
    case 'dob':
    case 'past':
      return { min: new Date(MIN_YEAR, 0, 1), max: today };
    case 'future':
      return { min: today, max: new Date(y + 10, 11, 31) };
    default:
      return { min: new Date(MIN_YEAR, 0, 1), max: new Date(y + 30, 11, 31) };
  }
}

/** Parses strictly "MM/DD/YYYY" and rejects impossible dates (02/30/2000). */
export function parseDateText(text: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

export function formatDateText(d: Date): string {
  return String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0') + '/' + d.getFullYear();
}

export function isDateWithin(d: Date, b: DateBounds): boolean {
  const t = startOfDay(d).getTime();
  return t >= startOfDay(b.min).getTime() && t <= startOfDay(b.max).getTime();
}

/** True when the text is a real date allowed for the kind. */
export function isValidDateForKind(text: string, kind: DateKind, now: Date = new Date()): boolean {
  const d = parseDateText(text);
  return d !== null && isDateWithin(d, boundsForKind(kind, now));
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Years offered by the year list, in the order the list should show them (newest first for past kinds). */
export function yearsFor(b: DateBounds, kind: DateKind): number[] {
  const out: number[] = [];
  for (let y = b.min.getFullYear(); y <= b.max.getFullYear(); y++) out.push(y);
  return kind === 'future' ? out : out.reverse();
}

/** Months (0-11) selectable in a year given the bounds. */
export function monthsAllowed(year: number, b: DateBounds): number[] {
  const out: number[] = [];
  for (let m = 0; m < 12; m++) {
    const first = new Date(year, m, 1);
    const last = new Date(year, m, daysInMonth(year, m));
    if (last.getTime() >= startOfDay(b.min).getTime() && first.getTime() <= startOfDay(b.max).getTime()) out.push(m);
  }
  return out;
}

/** Year the picker opens on when nothing is selected yet. */
export function defaultYearFor(kind: DateKind, b: DateBounds, now: Date = new Date()): number {
  const y = now.getFullYear();
  if (kind === 'dob') return Math.min(Math.max(y - 30, b.min.getFullYear()), b.max.getFullYear());
  return Math.min(Math.max(y, b.min.getFullYear()), b.max.getFullYear());
}
