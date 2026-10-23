export type PickupWindowCopy = { text: string; urgent: boolean; closed: boolean };

export function isPickupWindowClosed(pickupWindowEndIso: string | null | undefined, nowMs = Date.now()): boolean {
  if (!pickupWindowEndIso) return false;
  return new Date(pickupWindowEndIso).getTime() <= nowMs;
}

export function pickupWindowClosesIn(pickupWindowEndIso: string | null | undefined, nowMs = Date.now()): PickupWindowCopy {
  if (!pickupWindowEndIso) return { text: 'No pickup window listed', urgent: false, closed: false };
  const ms = new Date(pickupWindowEndIso).getTime() - nowMs;
  if (ms <= 0) return { text: 'Pickup window ended', urgent: false, closed: true };
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return { text: `Closes in ${mins} min`, urgent: true, closed: false };
  const hrs = Math.floor(mins / 60);
  return { text: `Closes in ${hrs}h ${mins % 60}m`, urgent: hrs < 2, closed: false };
}

/** True when pickup ends within the next two hours (browse “closing soon” filter). */
export function isClosingSoon(pickupWindowEndIso: string | null | undefined, nowMs = Date.now()): boolean {
  if (!pickupWindowEndIso) return false;
  const ms = new Date(pickupWindowEndIso).getTime() - nowMs;
  return ms > 0 && ms <= 2 * 60 * 60 * 1000;
}

const TIME_RE = /^(\d{1,2}):(\d{2})\s*(am|pm)?$/i;

function parseTimeOnDate(base: Date, raw: string): Date | null {
  const t = raw.trim().toLowerCase();
  const m = t.match(TIME_RE);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const mer = m[3]?.toLowerCase();
  if (mer === 'pm' && hour < 12) hour += 12;
  if (mer === 'am' && hour === 12) hour = 0;
  if (!mer && hour <= 12) {
    // Assume same-day 24h if no meridian and hour > 12 unlikely for food rescue UX
  }
  if (hour > 23 || minute > 59) return null;
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

/** Build ISO timestamps for today's pickup window in local time. */
export type TodayPickupWindowResult =
  | { start: string; end: string }
  | { ok: false; reason: string };

export function buildTodayPickupWindowIso(startTime: string, endTime: string, now = new Date()): TodayPickupWindowResult {
  const start = parseTimeOnDate(now, startTime);
  const end = parseTimeOnDate(now, endTime);
  if (!start || !end) {
    return { ok: false, reason: 'Use pickup times like 3:00 PM and 6:30 PM.' };
  }
  if (end.getTime() <= start.getTime()) {
    return { ok: false, reason: 'Pickup end time must be after the start time.' };
  }
  if (end.getTime() <= now.getTime()) {
    return { ok: false, reason: 'Pickup window must end in the future today.' };
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export function formatPickupWindowRange(startIso: string | null, endIso: string | null): string {
  if (!startIso || !endIso) return 'Pickup window not listed';
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${new Date(startIso).toLocaleTimeString([], opts)} – ${new Date(endIso).toLocaleTimeString([], opts)}`;
}
