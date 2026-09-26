// Safety guards for the DEV seed runner. Kept separate from the runner so
// scripts/audit-seed.mjs can unit-test them without any network access.
//
// The seed can only ever target the fairpath-mobile-dev project.

export const DEV_PROJECT_REF = 'znvhmuhojvwvjzmaqwff';
export const PROD_PROJECT_REF = 'rqpczemdagoddhuwefxt';

export function projectRefFromUrl(url) {
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec(String(url || '').trim());
  return m ? m[1] : null;
}

/** Decodes a JWT payload WITHOUT verifying it (we only inspect claims to refuse wrong keys). */
export function decodeJwtPayload(token) {
  try {
    const part = String(token).split('.')[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Throws unless every condition for a safe DEV-only write is satisfied.
 * Returns { ref } on success. Never logs the key.
 */
export function assertDevTarget({ url, serviceKey, linkedRef, confirmDev, apply }) {
  const problems = [];
  const ref = projectRefFromUrl(url);

  if (!ref) problems.push(`Supabase URL is missing or not a https://<ref>.supabase.co URL (got "${url || ''}").`);
  if (ref === PROD_PROJECT_REF) problems.push(`REFUSING: the URL points at the PRODUCTION project (${PROD_PROJECT_REF}). The seed never touches production.`);
  else if (ref && ref !== DEV_PROJECT_REF) problems.push(`REFUSING: URL project "${ref}" is not the DEV project (${DEV_PROJECT_REF}).`);
  if (linkedRef && linkedRef.trim() !== DEV_PROJECT_REF) problems.push(`REFUSING: supabase/.temp/project-ref is "${linkedRef.trim()}", not the DEV ref (${DEV_PROJECT_REF}).`);

  if (apply) {
    if (!confirmDev) problems.push('Writing requires the explicit --confirm-dev flag.');
    if (!serviceKey) problems.push('SUPABASE_SERVICE_ROLE_KEY is not set in the environment (it is never read from a file).');
    else {
      const key = String(serviceKey).trim();
      if (key.startsWith('sb_publishable_')) problems.push('That is a publishable/anon key. The seed needs the DEV service_role (secret) key.');
      else if (key.startsWith('sb_secret_')) { /* opaque secret key: cannot inspect claims */ }
      else {
        const payload = decodeJwtPayload(key);
        if (!payload) problems.push('SUPABASE_SERVICE_ROLE_KEY is neither an sb_secret_ key nor a decodable JWT.');
        else {
          if (payload.role !== 'service_role') problems.push(`Key role is "${payload.role}", expected "service_role" (never use the anon key for seeding).`);
          if (payload.ref && payload.ref !== DEV_PROJECT_REF) problems.push(`REFUSING: the key belongs to project "${payload.ref}", not DEV (${DEV_PROJECT_REF}).`);
        }
      }
    }
  }

  if (problems.length) throw new Error('Seed safety guard failed:\n - ' + problems.join('\n - '));
  return { ref };
}
