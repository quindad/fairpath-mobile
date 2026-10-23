/** Documented DEV member personas — passwords only via environment (never commit). */
export const DEV_QA_MEMBER_A_EMAIL = 'dev-free@fairpath.test';
export const DEV_QA_MEMBER_B_EMAIL = 'dev-plus@fairpath.test';

export function devQaPasswordForEmail(email) {
  const normalized = email.trim().toLowerCase();
  if (normalized === DEV_QA_MEMBER_A_EMAIL.toLowerCase()) {
    return process.env.QA_COMMUNITY_MEMBER_A_PASSWORD ?? process.env.QA_DEV_FREE_PASSWORD ?? null;
  }
  if (normalized === DEV_QA_MEMBER_B_EMAIL.toLowerCase()) {
    return process.env.QA_COMMUNITY_MEMBER_B_PASSWORD ?? process.env.QA_DEV_PLUS_PASSWORD ?? null;
  }
  if (normalized === (process.env.QA_COMMUNITY_MEMBER_A_EMAIL ?? '').toLowerCase()) {
    return process.env.QA_COMMUNITY_MEMBER_A_PASSWORD ?? null;
  }
  if (normalized === (process.env.QA_COMMUNITY_MEMBER_B_EMAIL ?? '').toLowerCase()) {
    return process.env.QA_COMMUNITY_MEMBER_B_PASSWORD ?? null;
  }
  return null;
}

export function resolveCommunityE2eMembers(options = {}) {
  const emailA = process.env.QA_COMMUNITY_MEMBER_A_EMAIL ?? DEV_QA_MEMBER_A_EMAIL;
  const emailB = process.env.QA_COMMUNITY_MEMBER_B_EMAIL ?? DEV_QA_MEMBER_B_EMAIL;
  let passA = devQaPasswordForEmail(emailA);
  let passB = devQaPasswordForEmail(emailB);
  if (options.useDocumentedSeedPasswords) {
    // Same values as scripts/seed-dev-test-users.mjs (DEV-only fixtures, not production).
    if (!passA && emailA === DEV_QA_MEMBER_A_EMAIL) passA = 'FairPath-Dev-Free-2026!';
    if (!passB && emailB === DEV_QA_MEMBER_B_EMAIL) passB = 'FairPath-Dev-Plus-2026!';
  }
  return { emailA, emailB, passA, passB };
}

export function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
