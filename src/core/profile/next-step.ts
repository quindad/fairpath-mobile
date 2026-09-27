// Deterministic "Next Step" rules over the SERVER-derived member summary. Pure (no imports) so an audit can run it.
//
// Rules are ordered and explainable: every step names the real fact that triggered it. There is no AI wording, no
// engagement score and no fabricated urgency. Same summary in -> same steps out, whatever order keys arrive in.

export type MemberSummary = {
  jobs?: { applied?: number; saved?: number; by_status?: Record<string, number> };
  housing?: { applications?: number; drafts?: number; saved_homes?: number };
  resources?: { saved?: number; started?: number; completed?: number; unavailable_saved?: number };
  profile?: { completed_sections?: number; total_sections?: number; next_section?: string | null };
  documents?: { generated?: number; stored_copies?: number; expiring_soon?: number };
  notifications?: { unread?: number };
  plus?: { active?: boolean; complimentary?: boolean; days_remaining?: number | null; expires_at?: string | null };
  deletion_request?: { status?: string; scheduled_for?: string } | null;
  credit?: { items_to_review?: number; disputes_awaiting_response?: number; response_due_soon?: number };
  record_relief?: { cases?: number; eligible_now?: number; countdowns_due_soon?: number; rule_updates?: number };
};

export type NextStep = { key: string; title: string; body: string; route: string; reason: string };

const SECTION_LABEL: Record<string, string> = {
  contact: 'Add your contact details', location: 'Set where you want to work', work_experience: 'Add your work experience', education: 'Add your education',
  skills: 'Add your skills', preferences: 'Choose the work you want', availability: 'Add when you can work', transportation: 'Add how you get to work',
};
const SECTION_ROUTE: Record<string, string> = {
  contact: '/opportunity-profile/contact', location: '/location-setup', work_experience: '/opportunity-profile/experience', education: '/opportunity-profile/education',
  skills: '/opportunity-profile/skills', preferences: '/opportunity-profile/preferences', availability: '/opportunity-profile/availability', transportation: '/opportunity-profile/transportation',
};

const n = (v: number | undefined | null) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Ordered by real-world urgency: deadlines and things that lapse first, then unfinished work, then discovery. */
export function nextSteps(s: MemberSummary | null | undefined): NextStep[] {
  if (!s) return [];
  const out: NextStep[] = [];

  // 1. Time-sensitive facts from other modules (present only when those modules report them).
  if (n(s.credit?.response_due_soon) > 0) {
    out.push({ key: 'credit_response_due', title: 'A dispute response is due soon', body: `${n(s.credit?.response_due_soon)} dispute response${n(s.credit?.response_due_soon) === 1 ? '' : 's'} due within 7 days.`, route: '/credit', reason: 'credit.response_due_soon' });
  }
  if (n(s.record_relief?.eligible_now) > 0) {
    out.push({ key: 'rr_eligible_now', title: 'A case may now be eligible for review', body: 'A waiting period on one of your cases has ended under the rule we used. Review it and confirm next steps.', route: '/record-relief', reason: 'record_relief.eligible_now' });
  }
  if (n(s.record_relief?.rule_updates) > 0) {
    out.push({ key: 'rr_rule_update', title: 'A rule for one of your cases changed', body: 'The verified rule version changed. Your countdown may be different. Review the case.', route: '/record-relief', reason: 'record_relief.rule_updates' });
  }
  if (n(s.credit?.items_to_review) > 0) {
    out.push({ key: 'credit_review', title: `${n(s.credit?.items_to_review)} credit item${n(s.credit?.items_to_review) === 1 ? '' : 's'} need your review`, body: 'Confirm or correct what was read from your report.', route: '/credit', reason: 'credit.items_to_review' });
  }
  if (n(s.record_relief?.countdowns_due_soon) > 0) {
    out.push({ key: 'rr_countdown_soon', title: 'A waiting period ends soon', body: 'One of your case countdowns ends within 30 days.', route: '/record-relief', reason: 'record_relief.countdowns_due_soon' });
  }

  // 2. Things that lapse.
  if (s.plus?.active && s.plus.days_remaining != null && s.plus.days_remaining <= 14) {
    out.push({ key: 'plus_ending', title: `FairPath+ access ends in ${s.plus.days_remaining} day${s.plus.days_remaining === 1 ? '' : 's'}`, body: s.plus.complimentary ? 'Your complimentary access is ending.' : 'Renew to keep your membership.', route: '/plus', reason: 'plus.days_remaining<=14' });
  }
  if (n(s.documents?.expiring_soon) > 0) {
    out.push({ key: 'document_expiring', title: 'A stored document copy is expiring', body: 'FairPath removes stored copies on the date you chose. Download it now if you need it.', route: '/documents', reason: 'documents.expiring_soon' });
  }
  if (n(s.resources?.unavailable_saved) > 0) {
    out.push({ key: 'saved_unavailable', title: 'A saved resource is no longer available', body: 'It was removed or is being re-verified. Find a replacement.', route: '/saved-resources', reason: 'resources.unavailable_saved' });
  }

  // 3. Unfinished work.
  if (n(s.housing?.drafts) > 0) {
    out.push({ key: 'housing_draft', title: 'Finish your housing application', body: `You have ${n(s.housing?.drafts)} draft${n(s.housing?.drafts) === 1 ? '' : 's'}.`, route: '/housing-applications', reason: 'housing.drafts' });
  }
  const done = n(s.profile?.completed_sections);
  const total = n(s.profile?.total_sections);
  const nextSection = s.profile?.next_section ?? null;
  if (total > 0 && done < total && nextSection) {
    out.push({ key: 'profile_' + nextSection, title: SECTION_LABEL[nextSection] ?? 'Finish your Opportunity Profile', body: `${done} of ${total} profile sections complete.`, route: SECTION_ROUTE[nextSection] ?? '/opportunity-profile', reason: `profile.next_section=${nextSection}` });
  }

  // 4. Discovery, only when the member has not started it.
  if (total > 0 && done >= 3 && n(s.jobs?.applied) === 0) {
    out.push({ key: 'find_jobs', title: 'Look for jobs near you', body: 'Your profile has what most applications need.', route: '/find-jobs', reason: 'jobs.applied=0' });
  }
  if (n(s.resources?.saved) === 0 && n(s.resources?.started) === 0) {
    out.push({ key: 'find_resources', title: 'Find help near you', body: 'Search food, housing, ID, transportation and more. Save what you need.', route: '/resources', reason: 'resources.saved=0' });
  }
  return out;
}

export function primaryNextStep(s: MemberSummary | null | undefined): NextStep | null {
  return nextSteps(s)[0] ?? null;
}
