import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@fairpath/opportunity_plan_v1';

export type PlanItemStatus =
  | 'exploring'
  | 'saved'
  | 'requested'
  | 'offer_received'
  | 'pickup_arranged'
  | 'referral_submitted'
  | 'completed'
  | 'unresolved';

export type OpportunityPlanItem = {
  id: string;
  title: string;
  status: PlanItemStatus;
  route?: string;
  needLabels: string[];
  updatedAt: string;
  note?: string;
};

export type OpportunityPlan = {
  items: OpportunityPlanItem[];
  lastQuery?: string;
};

export async function loadOpportunityPlan(): Promise<OpportunityPlan> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { items: [] };
    return JSON.parse(raw) as OpportunityPlan;
  } catch {
    return { items: [] };
  }
}

export async function saveOpportunityPlan(plan: OpportunityPlan): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(plan));
}

export async function upsertPlanItem(item: Omit<OpportunityPlanItem, 'updatedAt'> & { updatedAt?: string }): Promise<OpportunityPlan> {
  const plan = await loadOpportunityPlan();
  const updatedAt = item.updatedAt ?? new Date().toISOString();
  const next: OpportunityPlanItem = { ...item, updatedAt };
  const idx = plan.items.findIndex((x) => x.id === item.id);
  if (idx >= 0) plan.items[idx] = next;
  else plan.items.unshift(next);
  plan.items = plan.items.slice(0, 40);
  await saveOpportunityPlan(plan);
  return plan;
}

export async function markPlanFromSearch(query: string, needLabels: string[]): Promise<void> {
  const plan = await loadOpportunityPlan();
  plan.lastQuery = query;
  const id = `search_${Date.now()}`;
  plan.items.unshift({
    id,
    title: needLabels.join(' · ') || query.slice(0, 80),
    status: 'exploring',
    needLabels,
    route: '/community/help-now',
    updatedAt: new Date().toISOString(),
  });
  plan.items = plan.items.slice(0, 40);
  await saveOpportunityPlan(plan);
}
