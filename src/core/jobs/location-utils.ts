// Pure helpers (no imports) so audit scripts can execute them directly under Node.
// Shared by Jobs and Housing search.

/** A US ZIP is exactly five digits. */
export function isZip(value: string): boolean {
  return /^[0-9]{5}$/.test(value.trim());
}

const STATE_NAMES: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE',
  'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT',
  vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
};
// Names that are also well-known cities: a bare "New York" / "Washington" is left as typed so city matches still work.
const AMBIGUOUS_ALONE = new Set(['new york', 'washington']);
const STATE_NAMES_LONGEST_FIRST = Object.keys(STATE_NAMES).sort((a, b) => b.length - a.length);

/**
 * Normalizes typed places to the "City, ST" form stored on listings:
 *   "Columbus OH" / "columbus, ohio" -> "Columbus, OH"; "Ohio" -> "OH"; "Columbus" stays as typed.
 */
export function normalizePlace(value: string): string {
  const v = value.trim().replace(/\s+/g, ' ');
  if (!v) return v;
  const lower = v.toLowerCase();

  if (STATE_NAMES[lower] && !AMBIGUOUS_ALONE.has(lower)) return STATE_NAMES[lower];

  for (const name of STATE_NAMES_LONGEST_FIRST) {
    if (lower.length > name.length && lower.endsWith(name)) {
      const before = v.slice(0, v.length - name.length);
      if (/[,\s]$/.test(before)) {
        const city = before.replace(/[,\s]+$/, '').trim();
        if (city) return city + ', ' + STATE_NAMES[name];
      }
    }
  }

  const m = v.match(/^(.+?)[,\s]+([A-Za-z]{2})$/);
  return m ? m[1].replace(/,$/, '').trim() + ', ' + m[2].toUpperCase() : v;
}
