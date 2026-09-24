import { supabase } from '@/lib/supabase';

/**
 * Shared helper for every service that requires a signed-in member.
 * Throws Error('SIGNED_OUT') so call sites can keep using the existing
 * `e.message === 'SIGNED_OUT'` redirect-to-auth pattern.
 */
export async function currentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('SIGNED_OUT');
  return user;
}
