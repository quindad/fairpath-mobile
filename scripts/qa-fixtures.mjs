// Explicit, positively-allowlisted DEV QA identities.
//
// Born from a real incident (2026-09-30): a test script selected "the first real profile not in my exclude
// list" to use as a live Mobile member. It got lucky and hit a pre-existing dev-seed fixture, not a real
// person - but the selection logic itself could have hit anyone, including Sterling's own real account. The
// fix is structural, not "remember not to do that": every DEV mutation-capable test script must call
// assertDevQaIdentity() before writing, and it only accepts identities explicitly listed here. No scan over
// `profiles`, no "first N", no "anyone not excluded" - positive allowlist only.

export const QA_MOBILE_MEMBERS = [
  'qa.mobile.member1@fairpath.test',
  'qa.mobile.member2@fairpath.test',
];

export const QA_PARTNER_IDENTITIES = [
  'partnertest1@fairpath.test', // Buckeye Workforce Partners - employment + housing capability
  'partnertest2@fairpath.test', // Capital Reentry Legal Clinic - case_management capability
  'partnertest3@fairpath.test', // Chesapeake Second Chance Alliance - no capabilities, cross-tenant control
];

const ALLOWED = new Set([...QA_MOBILE_MEMBERS, ...QA_PARTNER_IDENTITIES]);

/**
 * Call this before ANY DEV mutation in a test script. Throws if the target isn't an explicitly approved QA
 * identity - a script that forgets to check this still can't reach a live write against a real person, because
 * every write in this repo's test scripts should go through an identity obtained via this allowlist in the
 * first place (no assertion can retroactively protect a write already made with a different identity, which is
 * exactly why the identity itself must always come from QA_MOBILE_MEMBERS / QA_PARTNER_IDENTITIES, never a
 * database scan).
 */
export function assertDevQaIdentity(emailOrUser) {
  const email = typeof emailOrUser === 'string' ? emailOrUser : emailOrUser?.email;
  if (!email || !ALLOWED.has(email)) {
    throw new Error(
      `REFUSING MUTATION: '${email}' is not an approved DEV QA identity. ` +
      `Positive-allowlist only - add it to scripts/qa-fixtures.mjs if it's genuinely a new QA fixture, ` +
      `never select an arbitrary/first/non-excluded real profile.`
    );
  }
  return true;
}
