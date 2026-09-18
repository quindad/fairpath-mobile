import { supabase } from '@/lib/supabase';
import { calculateFairPathReadiness } from '@/core/models/readiness-engine';

export type StoredProfileAnswers = Record<string, unknown>;

export async function loadProfileAnswers(): Promise<StoredProfileAnswers> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('SIGNED_OUT');

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
  if (profile?.justice_impacted && answers['convictions.has_felony'] == null) {
    if (profile.justice_impacted === 'Yes') answers['convictions.has_felony'] = true;
    if (profile.justice_impacted === 'No') answers['convictions.has_felony'] = false;
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
}

export async function loadFairPathReadiness() {
  const answers = await loadProfileAnswers();
  return { answers, readiness: calculateFairPathReadiness(answers) };
}
