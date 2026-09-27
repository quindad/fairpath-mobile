import { supabase } from '@/lib/supabase';
import type { MemberSummary } from '@/core/profile/next-step';

/** Server-derived numbers for the member hub. Nothing is computed from client state. */
export async function loadMemberSummary(): Promise<MemberSummary> {
  const { data, error } = await supabase.rpc('get_member_home_summary');
  if (error) throw error;
  return (data ?? {}) as MemberSummary;
}

export type DeletionStatus = { id: string; status: 'requested' | 'processing' | 'failed' | 'cancelled'; requested_at: string; scheduled_for: string } | null;

export async function loadDeletionStatus(): Promise<DeletionStatus> {
  const { data, error } = await supabase.rpc('get_account_deletion_status');
  if (error) throw error;
  return (data as DeletionStatus) ?? null;
}
export async function requestAccountDeletion(reason?: string): Promise<void> {
  const { error } = await supabase.rpc('request_account_deletion', { p_reason: reason ?? null });
  if (error) throw error;
}
export async function cancelAccountDeletion(): Promise<void> {
  const { error } = await supabase.rpc('cancel_account_deletion');
  if (error) throw error;
}

export type ConsentState = { event_type: string; granted: boolean; document_version: string | null; created_at: string };

/** Latest ledger entry per consent type (the ledger itself is append-only). */
export async function loadConsentState(): Promise<Record<string, ConsentState>> {
  const { data, error } = await supabase.from('consent_events').select('event_type,granted,document_version,created_at').order('created_at', { ascending: true });
  if (error) throw error;
  const latest: Record<string, ConsentState> = {};
  for (const row of (data ?? []) as ConsentState[]) latest[row.event_type] = row;
  return latest;
}
