import { supabase } from '@/lib/supabase';
import { currentUserOptional } from '@/core/supabase/current-user';
import {
  loadOpportunityPlan,
  saveOpportunityPlan,
  type OpportunityPlan,
  type OpportunityPlanItem,
} from './plan-store';

type PlanRow = {
  client_id: string;
  title: string;
  status: OpportunityPlanItem['status'];
  route: string | null;
  need_labels: string[];
  note: string | null;
  updated_at: string;
};

function missingTable(error: { code?: string; message?: string } | null): boolean {
  const msg = (error?.message ?? '').toLowerCase();
  return error?.code === 'PGRST205' || msg.includes('does not exist') || msg.includes('could not find the table');
}

function rowToItem(row: PlanRow): OpportunityPlanItem {
  return {
    id: row.client_id,
    title: row.title,
    status: row.status,
    route: row.route ?? undefined,
    needLabels: row.need_labels ?? [],
    note: row.note ?? undefined,
    updatedAt: row.updated_at,
  };
}

/** Load device plan merged with server rows when signed in and table is deployed. */
export async function loadMergedOpportunityPlan(): Promise<OpportunityPlan> {
  const local = await loadOpportunityPlan();
  const user = await currentUserOptional();
  if (!user) return local;

  const { data, error } = await supabase
    .from('member_opportunity_plan_items')
    .select('client_id,title,status,route,need_labels,note,updated_at')
    .order('updated_at', { ascending: false })
    .limit(40);

  if (error) {
    if (missingTable(error)) return local;
    return local;
  }

  const serverItems = (data ?? []).map((r) => rowToItem(r as PlanRow));
  if (!serverItems.length) return local;

  const byId = new Map<string, OpportunityPlanItem>();
  for (const item of local.items) byId.set(item.id, item);
  for (const item of serverItems) {
    const prev = byId.get(item.id);
    if (!prev || new Date(item.updatedAt).getTime() >= new Date(prev.updatedAt).getTime()) {
      byId.set(item.id, item);
    }
  }
  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
  const plan: OpportunityPlan = { items: merged.slice(0, 40), lastQuery: local.lastQuery };
  await saveOpportunityPlan(plan);
  return plan;
}

/** Persist confirmed plan items to server (RLS) and local cache. */
export async function syncOpportunityPlanItems(items: OpportunityPlanItem[]): Promise<{ synced: boolean; reason?: string }> {
  await saveOpportunityPlan({ items: items.slice(0, 40) });
  const user = await currentUserOptional();
  if (!user) return { synced: false, reason: 'signed_out' };

  const rows = items.slice(0, 40).map((item) => ({
    user_id: user.id,
    client_id: item.id,
    title: item.title,
    status: item.status,
    route: item.route ?? null,
    need_labels: item.needLabels,
    note: item.note ?? null,
    updated_at: item.updatedAt ?? new Date().toISOString(),
  }));

  const { error } = await supabase.from('member_opportunity_plan_items').upsert(rows, {
    onConflict: 'user_id,client_id',
  });

  if (error) {
    if (missingTable(error)) return { synced: false, reason: 'table_not_deployed' };
    return { synced: false, reason: error.message };
  }
  return { synced: true };
}
