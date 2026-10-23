import { supabase } from '@/lib/supabase';
import { filterGoalLabels, type MemberCapabilities } from '@/core/profile/member-capabilities';

export type HomePersonalization = {
  firstName: string | null;
  goals: string[];
  locationText: string | null;
  experienceSummary: string | null;
  workPrefs: string[];
  housingPrefs: string[];
};

const GOAL_ROUTES: Record<string, { label: string; route: string }> = {
  'Work & income': { label: 'Jobs', route: '/find-jobs' },
  Housing: { label: 'Housing', route: '/find-housing' },
  'Food & essentials': { label: 'Community', route: '/community' },
  Reentry: { label: 'Record relief', route: '/record-relief' },
  'Veteran transition': { label: 'Veterans', route: '/veterans' },
  'Safety & recovery': { label: 'Safety', route: '/safety' },
  'Give or help someone': { label: 'I can help', route: '/community/can-help' },
  'Learn new skills': { label: 'Academy', route: '/academy' },
  'Build a business': { label: 'Entrepreneurship', route: '/entrepreneurship' },
};

/** Signed-in member onboarding fields for Home tiles. Returns null when signed out. */
export async function loadHomePersonalization(): Promise<HomePersonalization | null> {
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('first_name,goals,location_text,experience_summary,work_preferences,housing_preferences')
    .eq('id', identity.user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    firstName: data.first_name?.trim() || null,
    goals: Array.isArray(data.goals) ? data.goals : [],
    locationText: data.location_text ?? null,
    experienceSummary: data.experience_summary ?? null,
    workPrefs: Array.isArray(data.work_preferences) ? data.work_preferences : [],
    housingPrefs: Array.isArray(data.housing_preferences) ? data.housing_preferences : [],
  };
}

/** Ordered quick links from onboarding goals (deduped, max 4). */
export function homeQuickLinks(
  p: HomePersonalization | null,
  caps: MemberCapabilities | null = null,
): { label: string; route: string }[] {
  const goals = filterGoalLabels(p?.goals ?? [], caps);
  if (!goals.length) {
    return [
      { label: 'Jobs', route: '/find-jobs' },
      { label: 'Housing', route: '/find-housing' },
      { label: 'Marketplace', route: '/marketplace' },
      { label: 'Resources', route: '/resources' },
    ];
  }
  const out: { label: string; route: string }[] = [];
  const seen = new Set<string>();
  for (const goal of goals) {
    const link = GOAL_ROUTES[goal];
    if (!link || seen.has(link.route)) continue;
    seen.add(link.route);
    out.push(link);
    if (out.length >= 4) break;
  }
  if (out.length < 4 && !seen.has('/resources')) out.push({ label: 'Resources', route: '/resources' });
  return out.slice(0, 4);
}

export function homeFocusLine(p: HomePersonalization | null, caps: MemberCapabilities | null = null): string | null {
  if (!p) return null;
  const parts: string[] = [];
  if (p.locationText?.trim()) parts.push(`Near ${p.locationText.trim()}`);
  const goals = filterGoalLabels(p.goals, caps);
  if (goals.length) parts.push(goals.slice(0, 2).join(' · '));
  return parts.length ? parts.join(' — ') : null;
}
