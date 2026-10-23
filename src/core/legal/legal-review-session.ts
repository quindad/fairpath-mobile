/** Session flags for registration legal review (sign-up / finish-registration). */
const opened = { terms: false, privacy: false };
const agreedOnDocumentScreen = { terms: false, privacy: false };

export type MemberLegalSlug = 'terms' | 'privacy';

/** Document was opened for reading (does not count as consent). */
export function markLegalDocumentOpened(slug: MemberLegalSlug) {
  opened[slug] = true;
}

export function hasOpenedLegalDocument(slug: MemberLegalSlug) {
  return opened[slug];
}

/** Explicit agreement tapped on the legal document screen (pre-selects registration checkboxes). */
export function markLegalDocumentAgreed(slug: MemberLegalSlug) {
  opened[slug] = true;
  agreedOnDocumentScreen[slug] = true;
}

export function hasAgreedLegalDocument(slug: MemberLegalSlug) {
  return agreedOnDocumentScreen[slug];
}

export function resetLegalReviewSession() {
  opened.terms = false;
  opened.privacy = false;
  agreedOnDocumentScreen.terms = false;
  agreedOnDocumentScreen.privacy = false;
}
