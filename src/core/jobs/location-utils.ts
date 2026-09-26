// Pure helpers (no imports) so scripts/audit-jobs.mjs can execute them directly under Node.

/** A US ZIP is exactly five digits. */
export function isZip(value: string): boolean {
  return /^[0-9]{5}$/.test(value.trim());
}

/** "Columbus OH" -> "Columbus, OH" so it matches the "City, ST ZIP" location text stored on jobs. */
export function normalizePlace(value: string): string {
  const v = value.trim().replace(/\s+/g, ' ');
  const m = v.match(/^(.+?)[,\s]+([A-Za-z]{2})$/);
  return m ? m[1].replace(/,$/, '').trim() + ', ' + m[2].toUpperCase() : v;
}
