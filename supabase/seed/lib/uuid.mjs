import crypto from 'node:crypto';

// Fixed namespace for FairPath DEV seed rows. Row ids are UUIDv5(name) so the seed is
// idempotent (upsert on id) — these are ids for seed-owned rows only. They are NEVER used for
// foreign keys to auth.users: employer_id / owner_id always come from real Auth Admin users.
export const SEED_NAMESPACE = 'b3f0c7de-5a41-4c2e-9d10-6e7a1f0c2a11';

export function uuidv5(name, namespace = SEED_NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const h = crypto.createHash('sha1').update(Buffer.concat([ns, Buffer.from(name, 'utf8')])).digest();
  h[6] = (h[6] & 0x0f) | 0x50; // version 5
  h[8] = (h[8] & 0x3f) | 0x80; // RFC 4122 variant
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export const isUuid = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
