import { supabase } from '@/lib/supabase';

// A retention checkpoint the member can see is already RLS-scoped to their own person_id - no extra filtering
// needed here. Writes always go through the security-definer RPC (member_confirm_retention_checkpoint), never a
// direct table update, so a forged checkpoint id for another member still fails server-side (NOT_AUTHORIZED),
// not merely client-side.

export type RetentionCheckpoint = {
 id: string; placement_id: string; checkpoint_type: string; due_at: string; status: string; completed_at: string | null;
};

export const CHECKPOINT_LABELS: Record<string, string> = { day_7: 'Day 7', day_30: 'Day 30', day_60: 'Day 60', day_90: 'Day 90', day_180: 'Day 180' };
export const SUPPORT_CATEGORIES = [
 { code: 'transportation', label: 'Transportation' }, { code: 'childcare', label: 'Childcare' },
 { code: 'schedule', label: 'Schedule conflict' }, { code: 'work_clothing_equipment', label: 'Work clothing / equipment' },
 { code: 'training', label: 'Training' }, { code: 'financial_emergency', label: 'Financial emergency' },
 { code: 'housing_instability', label: 'Housing' }, { code: 'other', label: 'Something else' },
];

export async function loadMyCheckpoint(checkpointId: string): Promise<RetentionCheckpoint | null> {
 const { data, error } = await supabase.from('retention_checkpoints').select('id, placement_id, checkpoint_type, due_at, status, completed_at').eq('id', checkpointId).maybeSingle();
 if (error) throw error;
 return data ?? null;
}

export async function loadMyDueCheckpoints(): Promise<RetentionCheckpoint[]> {
 const { data: { user } } = await supabase.auth.getUser();
 if (!user) throw new Error('SIGNED_OUT');
 const { data, error } = await supabase.from('retention_checkpoints').select('id, placement_id, checkpoint_type, due_at, status, completed_at').eq('person_id', user.id).in('status', ['due', 'at_risk']).order('due_at');
 if (error) throw error;
 return data ?? [];
}

export async function confirmStillWorking(checkpointId: string): Promise<void> {
 const { error } = await supabase.rpc('member_confirm_retention_checkpoint', { p_checkpoint_id: checkpointId, p_status_report: 'still_working' });
 if (error) throw error;
}

export async function confirmEnded(checkpointId: string): Promise<void> {
 const { error } = await supabase.rpc('member_confirm_retention_checkpoint', { p_checkpoint_id: checkpointId, p_status_report: 'ended' });
 if (error) throw error;
}

export async function requestSupport(checkpointId: string, category: string, detail: string | null): Promise<void> {
 const { error } = await supabase.rpc('member_confirm_retention_checkpoint', { p_checkpoint_id: checkpointId, p_status_report: 'support_needed', p_support_category: category, p_support_detail: detail });
 if (error) throw error;
}
