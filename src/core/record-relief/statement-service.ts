import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';

export function statementErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : '';
  if (text.includes('SIGNED_OUT')) return 'Sign in to continue.';
  return 'Something went wrong. Please try again.';
}

/** The member's own private "explain my record" statement. Empty body if they have never written one. */
export async function loadMyRecordStatement(): Promise<string> {
  const { data, error } = await supabase.from('member_record_statements').select('body').maybeSingle();
  if (error) throw error;
  return data?.body ?? '';
}

export async function saveMyRecordStatement(body: string): Promise<void> {
  const user = await currentUser();
  const trimmed = body.slice(0, 3000);
  const { error } = await supabase.from('member_record_statements').upsert({ user_id: user.id, body: trimmed });
  if (error) throw error;
}
