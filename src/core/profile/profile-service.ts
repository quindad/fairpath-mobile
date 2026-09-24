import { supabase } from '@/lib/supabase';
import { calculateFairPathReadiness } from '@/core/models/readiness-engine';
import { upsertFreeTextHomeAddress } from '@/core/profile/address-service';

export type StoredProfileAnswers = Record<string, unknown>;

/**
 * Step 1 Canonical Profile: promoted-field dual-write.
 *
 * profile_answers stays the primary read/write path for EVERY question,
 * completely unchanged — this preserves 100% of existing behavior
 * (readiness math, complete-profile.tsx, and the direct profile_answers
 * reads in jobs-service.ts/housing-service.ts autofill all keep working
 * off exactly the same data they did before).
 *
 * On top of that unchanged path, saving one of the fields below ALSO
 * writes into its new canonical home (profiles.phone/date_of_birth,
 * addresses, convictions, supervision_records, registration_records).
 * This is a dual-write, not a cutover: profile_answers is not retired
 * for these fields in Step 1 (a hard cutover would lose "answered No"
 * fidelity for the has_felony/sex_offender_registration yes/no gates —
 * see the Step 1 implementation report for the full reasoning). The
 * canonical tables become populated going forward without any existing
 * reader having to change.
 *
 * IMPORTANT: the migrations that create these tables/columns are NOT
 * applied to the live Supabase project as part of this pass (explicit
 * instruction). Every dual-write below is wrapped so a failure (e.g.
 * "column/table does not exist" against today's live schema) is
 * swallowed, not surfaced to the caller — the primary profile_answers
 * write always succeeds and the user sees no difference until the
 * migrations are applied. Once applied, these start populating silently.
 */
async function dualWrite(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (__DEV__) console.warn('[profile-service] canonical dual-write skipped:', e);
  }
}

function usDateToIso(text: string): string | null {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

async function findOrCreateQuestionnaireConviction(userId: string) {
  const { data: existing } = await supabase
    .from('convictions')
    .select('id')
    .eq('user_id', userId)
    .eq('origin', 'questionnaire')
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabase
    .from('convictions')
    .insert({ user_id: userId, origin: 'questionnaire', source_type: 'self_reported', verification_state: 'needs_review' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function findOrCreateQuestionnaireSupervisionRecord(userId: string) {
  const { data: existing } = await supabase
    .from('supervision_records')
    .select('id')
    .eq('user_id', userId)
    .eq('origin', 'questionnaire')
    .maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await supabase
    .from('supervision_records')
    .insert({ user_id: userId, origin: 'questionnaire', source_type: 'self_reported', verification_state: 'needs_review' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function classifySupervisionText(text: string) {
  const lower = text.toLowerCase();
  const supervision_type = lower.includes('parole') ? 'parole'
    : lower.includes('probation') ? 'probation'
    : (lower.includes('post-release') || lower.includes('post release')) ? 'post_release_control'
    : 'other';
  const status = lower.includes('complete') ? 'completed'
    : (lower.includes('active') || lower.includes('current')) ? 'active'
    : 'unknown';
  return { supervision_type, status };
}

async function applyDualWrite(userId: string, questionId: string, answer: unknown) {
  if (questionId === 'identity.phone' && typeof answer === 'string' && answer.trim()) {
    await dualWrite(async () => { await supabase.from('profiles').update({ phone: answer.trim(), updated_at: new Date().toISOString() }).eq('id', userId); });
    return;
  }
  if (questionId === 'identity.date_of_birth' && typeof answer === 'string') {
    const iso = usDateToIso(answer);
    if (iso) await dualWrite(async () => { await supabase.from('profiles').update({ date_of_birth: iso, updated_at: new Date().toISOString() }).eq('id', userId); });
    return;
  }
  if ((questionId === 'identity.address' || questionId === 'identity.current_location') && typeof answer === 'string' && answer.trim()) {
    await dualWrite(() => upsertFreeTextHomeAddress(answer));
    return;
  }
  if (questionId === 'convictions.has_felony' && answer === true) {
    await dualWrite(() => findOrCreateQuestionnaireConviction(userId));
    return;
  }
  if (questionId === 'convictions.offense_name' && typeof answer === 'string' && answer.trim()) {
    await dualWrite(async () => {
      const id = await findOrCreateQuestionnaireConviction(userId);
      await supabase.from('convictions').update({ offense_title: answer.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    });
    return;
  }
  if (questionId === 'convictions.offense_code' && typeof answer === 'string' && answer.trim()) {
    await dualWrite(async () => {
      const id = await findOrCreateQuestionnaireConviction(userId);
      await supabase.from('convictions').update({ offense_code: answer.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    });
    return;
  }
  if (questionId === 'convictions.jurisdiction_state' && typeof answer === 'string' && answer.trim()) {
    await dualWrite(async () => {
      const id = await findOrCreateQuestionnaireConviction(userId);
      await supabase.from('convictions').update({ state_code: answer.trim(), updated_at: new Date().toISOString() }).eq('id', id);
    });
    return;
  }
  if (questionId === 'convictions.conviction_date' && typeof answer === 'string') {
    const iso = usDateToIso(answer);
    if (iso) {
      await dualWrite(async () => {
        const id = await findOrCreateQuestionnaireConviction(userId);
        await supabase.from('convictions').update({ conviction_date: iso, updated_at: new Date().toISOString() }).eq('id', id);
      });
    }
    return;
  }
  if (questionId === 'restrictions.supervision_status' && typeof answer === 'string' && answer.trim()) {
    await dualWrite(async () => {
      const id = await findOrCreateQuestionnaireSupervisionRecord(userId);
      const { supervision_type, status } = await classifySupervisionText(answer);
      await supabase.from('supervision_records').update({
        supervision_type, status, source_notes: answer.trim(), updated_at: new Date().toISOString(),
      }).eq('id', id);
    });
    return;
  }
  if (questionId === 'restrictions.sex_offender_registration' && answer === true) {
    await dualWrite(async () => {
      const { data: existing } = await supabase.from('registration_records').select('id').eq('user_id', userId).eq('origin', 'questionnaire').maybeSingle();
      if (!existing) {
        await supabase.from('registration_records').insert({ user_id: userId, origin: 'questionnaire', registration_type: 'sex_offender', source_type: 'self_reported', verification_state: 'needs_review' });
      }
    });
    return;
  }
  // Answering "No"/false on the has_felony and sex_offender_registration
  // gates intentionally does NOT delete any existing questionnaire-origin
  // row — non-destructive by default, matches Sterling decision #8's
  // spirit applied to live user data, not just migration backfill.
}

export async function loadProfileAnswers(): Promise<StoredProfileAnswers> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return {};

  const [{ data: rows, error }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('profile_answers').select('question_id,answer').eq('user_id', user.id),
    supabase.from('profiles').select('location_text,justice_impacted,work_preferences,housing_preferences').eq('id', user.id).single(),
  ]);
  if (error || profileError) throw error ?? profileError;

  const answers: StoredProfileAnswers = {};
  for (const row of rows ?? []) answers[row.question_id] = row.answer;

  // Bridge existing onboarding data into the new readiness engine until the
  // adaptive profile flow replaces legacy onboarding completely.
  if (profile?.location_text && answers['identity.current_location'] == null) {
    answers['identity.current_location'] = profile.location_text;
  }
  if (profile?.work_preferences?.length && answers['employment.desired_roles'] == null) {
    answers['employment.desired_roles'] = profile.work_preferences;
  }
  if (profile?.housing_preferences?.length && answers['housing.target_cities'] == null) {
    answers['housing.target_cities'] = profile.housing_preferences;
  }
  // NOTE: the previous bridge here ("profiles.justice_impacted === 'Yes'
  // implies answers['convictions.has_felony'] = true") was removed per
  // Sterling decision #2. That inference fabricated an "answered" state
  // from a legacy signal with no structured data behind it. The legacy
  // signal is preserved on profiles.justice_impacted untouched and
  // surfaced instead as an explicit, non-fabricated completion prompt
  // (see `_meta.legacyJusticeSignalUnconverted` below) rather than a
  // synthesized answer.
  if (profile?.justice_impacted === 'Yes' && answers['convictions.has_felony'] == null) {
    answers['_meta.legacyJusticeSignalUnconverted'] = true;
  }

  return answers;
}

export async function saveProfileAnswer(questionId: string, answer: unknown) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('SIGNED_OUT');

  const { error } = await supabase.from('profile_answers').upsert({
    user_id: user.id,
    question_id: questionId,
    answer,
    source: 'user',
    verification_state: 'self_reported',
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,question_id' });
  if (error) throw error;

  await applyDualWrite(user.id, questionId, answer);
}

export async function loadFairPathReadiness() {
  const answers = await loadProfileAnswers();
  return { answers, readiness: calculateFairPathReadiness(answers) };
}

/**
 * True when the user's legacy onboarding.tsx signal (profiles.justice_impacted
 * = 'Yes') has not yet been backed by a structured convictions.has_felony
 * answer. UI should use this to explain, when the user reaches that
 * question, why they're being asked again (Sterling decision #2: prompt
 * to complete structured history, never fabricate it).
 */
export function hasUnconvertedLegacyJusticeSignal(answers: StoredProfileAnswers): boolean {
  return answers['_meta.legacyJusticeSignalUnconverted'] === true;
}
