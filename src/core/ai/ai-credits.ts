import { supabase } from '@/lib/supabase';

/** Read-only balance for signed-in members (RLS). Null when signed out or unreadable. */
export async function loadAiCreditBalance(): Promise<number | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('ai_credit_balances').select('balance').maybeSingle();
  if (error) return null;
  return data?.balance ?? 0;
}
