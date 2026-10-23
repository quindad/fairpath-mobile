/**
 * Canonical justice / veteran tool visibility. UI hiding is not RLS — routes may still exist for deep links.
 */
import { supabase } from '@/lib/supabase';
import {
  VETERAN_TOOLS_QUESTION_ID,
  normalizeCapabilityChoice,
  parseJusticeImpactedField,
  toProfileJusticeField,
  type MemberCapabilities,
} from './member-capabilities-core.ts';

export * from './member-capabilities-core.ts';

export async function loadMemberCapabilities(): Promise<MemberCapabilities | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: veteranRow }] = await Promise.all([
    supabase.from('profiles').select('justice_impacted').eq('id', user.id).maybeSingle(),
    supabase.from('profile_answers').select('answer').eq('user_id', user.id).eq('question_id', VETERAN_TOOLS_QUESTION_ID).maybeSingle(),
  ]);

  const veteranRaw = veteranRow?.answer;
  const veteran =
    typeof veteranRaw === 'string'
      ? normalizeCapabilityChoice(veteranRaw)
      : veteranRaw && typeof veteranRaw === 'object' && 'choice' in (veteranRaw as object)
        ? normalizeCapabilityChoice((veteranRaw as { choice: string }).choice)
        : 'prefer_not_to_say';

  return {
    justice: parseJusticeImpactedField(profile?.justice_impacted),
    veteran,
  };
}

export async function saveMemberCapabilities(next: MemberCapabilities): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('SIGNED_OUT');

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ justice_impacted: toProfileJusticeField(next.justice), updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (profileErr) throw profileErr;

  const { error: ansErr } = await supabase.from('profile_answers').upsert(
    {
      user_id: user.id,
      question_id: VETERAN_TOOLS_QUESTION_ID,
      answer: next.veteran,
      source: 'user',
      verification_state: 'self_reported',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,question_id' },
  );
  if (ansErr) throw ansErr;
}
