/** Documented DEV member personas — fictional fixtures, not production members. */
export const DEV_QA_MEMBER_A_EMAIL = 'dev-free1@fairpath.test';
export const DEV_QA_MEMBER_B_EMAIL = 'dev-plus2@fairpath.test';

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

/** Passwords MUST come from environment — never hardcoded in repo. */
export function resolveCommunityE2eMembers() {
  const emailA = process.env.QA_COMMUNITY_MEMBER_A_EMAIL ?? DEV_QA_MEMBER_A_EMAIL;
  const emailB = process.env.QA_COMMUNITY_MEMBER_B_EMAIL ?? DEV_QA_MEMBER_B_EMAIL;
  const passA = devQaPasswordForEmail(emailA);
  const passB = devQaPasswordForEmail(emailB);
  return { emailA, emailB, passA, passB };
}

export function requireMemberPasswords({ emailA, emailB, passA, passB }) {
  const missing = [];
  const sameMember = emailA.trim().toLowerCase() === emailB.trim().toLowerCase();
  if (!passA) {
    missing.push(
      `password for ${emailA} (QA_COMMUNITY_MEMBER_A_PASSWORD or QA_DEV_FREE_PASSWORD)`,
    );
  }
  if (!sameMember && !passB) {
    missing.push(
      `password for ${emailB} (QA_COMMUNITY_MEMBER_B_PASSWORD or QA_DEV_PLUS_PASSWORD)`,
    );
  }
  if (missing.length) {
    throw new Error(`Missing DEV test credentials: ${missing.join('; ')}. Never commit passwords — load from vault into env.`);
  }
}

export function maskEmail(email) {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
