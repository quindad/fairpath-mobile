// Pure helpers (no imports) so scripts/audit-resources-ui.mjs can execute them directly under Node.

export type ResourceFreshness = 'fresh' | 'stale' | 'expired' | 'unknown';
export type ResourceCost = 'free' | 'sliding' | 'paid' | 'unknown';
export type ResourceMode = 'in_person' | 'virtual' | 'phone' | 'hybrid';

export type ResourceHoursRow = { weekday: number; opens_at: string | null; closes_at: string | null; is_24h: boolean; note?: string | null };

export function costLabel(cost: string | null | undefined): string {
  switch (cost) {
    case 'free': return 'Free';
    case 'sliding': return 'Sliding scale';
    case 'paid': return 'Costs money';
    default: return 'Cost not listed';
  }
}

export function modeLabel(mode: string | null | undefined): string {
  switch (mode) {
    case 'virtual': return 'Online';
    case 'phone': return 'By phone';
    case 'hybrid': return 'In person + online';
    default: return 'In person';
  }
}

export function freshnessLabel(freshness: string | null | undefined): { label: string; tone: 'ok' | 'warn' | 'none' } {
  if (freshness === 'fresh') return { label: 'VERIFIED', tone: 'ok' };
  if (freshness === 'stale') return { label: 'MAY BE OUT OF DATE', tone: 'warn' };
  return { label: '', tone: 'none' };
}

/** "Verified Sep 2026" from an ISO timestamp; empty string when unknown. */
export function verifiedOn(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function distanceLabel(miles: number | null | undefined): string {
  if (miles === null || miles === undefined || !Number.isFinite(miles)) return '';
  if (miles < 0.1) return 'Less than 0.1 mi';
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

const ACCESS_LABELS: Record<string, string> = {
  wheelchair: 'Wheelchair accessible',
  asl: 'ASL available',
  translation: 'Interpreters available',
  transit_nearby: 'Near public transit',
  free_parking: 'Free parking',
  childcare: 'Childcare on site',
  text_relay: 'Text / relay accessible',
  screen_reader: 'Screen-reader friendly',
};
export function accessibilityLabels(codes: readonly string[] | null | undefined): string[] {
  return (codes ?? []).map((c) => ACCESS_LABELS[c] ?? c.replace(/_/g, ' '));
}

const LANGUAGE_LABELS: Record<string, string> = { en: 'English', es: 'Spanish', fr: 'French', ar: 'Arabic', zh: 'Chinese', so: 'Somali', ne: 'Nepali' };
export function languageLabels(codes: readonly string[] | null | undefined): string[] {
  return (codes ?? []).map((c) => LANGUAGE_LABELS[c] ?? c.toUpperCase());
}

function to12h(value: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return value;
  const h = Number(m[1]);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m[2]} ${suffix}`;
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // week starts Monday

/** Groups consecutive days that share the same hours: "Mon–Fri 9:00 AM – 5:00 PM". 24-hour days read "Open 24 hours". */
export function formatHours(rows: readonly ResourceHoursRow[] | null | undefined): string[] {
  if (!rows || rows.length === 0) return [];
  const byDay = new Map<number, string[]>();
  for (const r of rows) {
    const text = r.is_24h ? 'Open 24 hours' : r.opens_at && r.closes_at ? `${to12h(r.opens_at)} – ${to12h(r.closes_at)}` : 'Hours vary';
    byDay.set(r.weekday, [...(byDay.get(r.weekday) ?? []), text]);
  }
  const lines: string[] = [];
  let i = 0;
  while (i < DAY_ORDER.length) {
    const day = DAY_ORDER[i];
    const text = byDay.get(day)?.join(', ');
    if (!text) { i++; continue; }
    let j = i;
    while (j + 1 < DAY_ORDER.length && byDay.get(DAY_ORDER[j + 1])?.join(', ') === text) j++;
    const first = DAY_SHORT[DAY_ORDER[i]];
    const last = DAY_SHORT[DAY_ORDER[j]];
    lines.push(`${i === j ? first : j === i + 1 ? `${first}, ${last}` : `${first}–${last}`} ${text}`);
    i = j + 1;
  }
  if (lines.length === 1 && lines[0].startsWith('Mon–Sun Open 24 hours')) return ['Open 24 hours, every day'];
  return lines;
}

export function openNowLabel(openNow: boolean | null | undefined): string {
  if (openNow === true) return 'Open now';
  if (openNow === false) return 'Closed now';
  return '';
}

/** Digits-only tel: link; returns null when the value cannot be dialed. */
export function telUrl(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^0-9+]/g, '');
  return digits.replace(/\+/g, '').length >= 7 ? `tel:${digits}` : null;
}

/** Only http(s) links are ever opened from resource data. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
  } catch {
    return null;
  }
}

export function isZip5(value: string | null | undefined): boolean {
  return /^\d{5}$/.test((value ?? '').trim());
}

export function radiusOptions(): number[] {
  return [5, 10, 25, 50, 100];
}

/** Shown for rows that are not production data (DEV fixtures). Production rows return ''. */
export function provenanceBadge(dataOrigin: string | null | undefined): string {
  return dataOrigin && dataOrigin !== 'production' ? 'DEV TEST DATA' : '';
}

export function eligibilityLine(rule: { description: string; is_hard?: boolean }): string {
  return rule.is_hard === false ? `${rule.description} (preferred)` : rule.description;
}
