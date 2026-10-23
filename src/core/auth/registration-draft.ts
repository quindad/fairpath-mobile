import {
  hasAgreedLegalDocument,
  hasOpenedLegalDocument,
  markLegalDocumentAgreed,
  markLegalDocumentOpened,
  resetLegalReviewSession,
  type MemberLegalSlug,
} from '../legal/legal-review-session.ts';

/** In-memory only — survives sign-up ↔ legal navigation; never persisted (password stays here only). */
export type RegistrationDraft = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  agreedTerms: boolean;
  agreedPrivacy: boolean;
};

const empty = (): RegistrationDraft => ({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  agreedTerms: false,
  agreedPrivacy: false,
});

let draft: RegistrationDraft = empty();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

// Returns the live object, not a copy: draft is only ever replaced (never mutated in place) by
// patchRegistrationDraft/clearRegistrationDraft below, so this stays referentially stable between real changes --
// required for useSyncExternalStore (use-registration-draft.ts), which re-renders forever if its snapshot
// function returns a new object identity on every call even when nothing actually changed.
export function getRegistrationDraft(): RegistrationDraft {
  return draft;
}

export function patchRegistrationDraft(patch: Partial<RegistrationDraft>) {
  const next = { ...draft, ...patch };
  const unchanged = (Object.keys(next) as (keyof RegistrationDraft)[]).every((k) => next[k] === draft[k]);
  if (unchanged) return;
  draft = next;
  emit();
}

export function subscribeRegistrationDraft(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearRegistrationDraft() {
  draft = empty();
  resetLegalReviewSession();
  emit();
}

export function registrationDraftLegalReady(d: RegistrationDraft = draft) {
  const termsOk = (hasOpenedLegalDocument('terms') || hasAgreedLegalDocument('terms')) && d.agreedTerms;
  const privacyOk = (hasOpenedLegalDocument('privacy') || hasAgreedLegalDocument('privacy')) && d.agreedPrivacy;
  return termsOk && privacyOk;
}

/** Explicit agreement on the legal document screen — updates draft + session flags. */
export function agreeRegistrationDocument(slug: MemberLegalSlug) {
  markLegalDocumentOpened(slug);
  markLegalDocumentAgreed(slug);
  if (slug === 'terms') patchRegistrationDraft({ agreedTerms: true });
  else patchRegistrationDraft({ agreedPrivacy: true });
}

export function syncRegistrationDraftFromLegalSession() {
  patchRegistrationDraft({
    agreedTerms: draft.agreedTerms || hasAgreedLegalDocument('terms'),
    agreedPrivacy: draft.agreedPrivacy || hasAgreedLegalDocument('privacy'),
  });
}
