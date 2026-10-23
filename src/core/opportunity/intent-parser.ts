import type { CommunityHelpCategoryId, CommunityHelpUrgency } from '../community/categories.ts';
import { newLocalId, type InterpretedOpportunity, type OpportunityLocation, type OpportunityPillar, type StructuredNeed } from './needs-model.ts';

type Signal = { re: RegExp; tag: string };

const URGENCY_TODAY: Signal[] = [
  { re: /\b(tonight|today|right now|asap|urgent|immediately)\b/i, tag: 'urgency:today' },
  { re: /\bthis week\b/i, tag: 'urgency:this_week' },
];

const TRANSPORT: Signal[] = [
  { re: /\b(no (car|transportation|ride)|can't drive|cannot drive|don't drive|do not have transportation|without a car)\b/i, tag: 'constraint:no_transport' },
  { re: /\b(need a ride|ride to)\b/i, tag: 'constraint:ride_needed' },
];

const ESSENTIAL: { category: CommunityHelpCategoryId; label: string; re: RegExp; tag: string }[] = [
  { category: 'groceries', label: 'Groceries', re: /\b(groceries|grocery|food for tonight|need food|hungry|pantry)\b/i, tag: 'need:food' },
  { category: 'food_assistance', label: 'Food assistance', re: /\b(food assistance|food bank|snap|ebt)\b/i, tag: 'need:food_program' },
  { category: 'diapers', label: 'Diapers', re: /\b(diapers|nappies)\b/i, tag: 'need:diapers' },
  { category: 'baby_supplies', label: 'Baby supplies', re: /\b(baby formula|infant formula|baby supplies)\b/i, tag: 'need:baby' },
  { category: 'clothing', label: 'Clothing', re: /\b(clothes|clothing|winter coat|coats)\b/i, tag: 'need:clothing' },
  { category: 'hygiene', label: 'Hygiene products', re: /\b(hygiene|soap|toothpaste|deodorant)\b/i, tag: 'need:hygiene' },
  { category: 'school_supplies', label: 'School supplies', re: /\b(school supplies|backpacks?)\b/i, tag: 'need:school' },
  { category: 'household_essentials', label: 'Household essentials', re: /\b(household essentials|cleaning supplies|toilet paper)\b/i, tag: 'need:household' },
  { category: 'transportation', label: 'Transportation assistance', re: /\b(bus pass|gas money|transportation help)\b/i, tag: 'need:transport_program' },
];

const GROWTH: { category: StructuredNeed['category']; label: string; re: RegExp; tag: string }[] = [
  { category: 'education_scholarships', label: 'Education / GED / scholarships', re: /\b(ged|high school diploma|scholarship|tuition|apprenticeship|certification)\b/i, tag: 'grow:education' },
  { category: 'education', label: 'Education / classes', re: /\b(learn|training|certificate|adult education)\b/i, tag: 'grow:education_classes' },
  { category: 'skills_exchange', label: 'Skills & workshops', re: /\b(workshop|skills exchange|trade program|vocational)\b/i, tag: 'grow:skills' },
  { category: 'employment', label: 'Employment', re: /\b(job|work|employment|hire|career)\b/i, tag: 'grow:jobs' },
  { category: 'microbusiness', label: 'Start a business', re: /\b(start (a |my )?(business|company|cleaning business)|entrepreneur|microbusiness)\b/i, tag: 'grow:business' },
  { category: 'mentorship', label: 'Mentorship program', re: /\b(mentor|mentorship)\b/i, tag: 'grow:mentorship' },
  { category: 'housing', label: 'Housing', re: /\b(apartment|housing|rent|homeless|shelter)\b/i, tag: 'grow:housing' },
  { category: 'benefits_navigator', label: 'Benefits programs', re: /\b(snap|medicaid|food stamps|utility assistance|utilities help|utility help|benefits)\b/i, tag: 'grow:benefits' },
  { category: 'health_wellness', label: 'Health & wellness', re: /\b(clinic|dental|counseling|therapy|recovery|wellness|mental health)\b/i, tag: 'grow:health' },
  { category: 'transportation', label: 'Transportation programs', re: /\b(bus pass|transit pass|bicycle program|transportation voucher)\b/i, tag: 'grow:transport_program' },
  { category: 'legal', label: 'Legal / ID help', re: /\b(driver'?s license|license back|legal help|court)\b/i, tag: 'grow:legal' },
  { category: 'record_relief', label: 'Record relief', re: /\b(expunge|seal|record relief|criminal record)\b/i, tag: 'grow:record_relief' },
  { category: 'financial', label: 'Financial help', re: /\b(credit|debt|budget|financial)\b/i, tag: 'grow:financial' },
  { category: 'family_center', label: 'Family support', re: /\b(childcare|parenting|diapers|school supplies|baby essentials)\b/i, tag: 'grow:family' },
  { category: 'events_volunteering', label: 'Volunteering', re: /\b(volunteer|community garden|nonprofit event)\b/i, tag: 'grow:volunteer' },
  { category: 'community_drives', label: 'Community drive', re: /\b(donation drive|food drive|supply drive|community impact)\b/i, tag: 'grow:drives' },
];

const GIVE: Signal[] = [
  { re: /\b(give away|donate|want to give|have groceries to|offering)\b/i, tag: 'give:items' },
  { re: /\bvolunteer\b/i, tag: 'give:volunteer' },
];

function urgencyFromSignals(tags: Set<string>): CommunityHelpUrgency {
  if (tags.has('urgency:today')) return 'today';
  if (tags.has('urgency:this_week')) return 'this_week';
  return 'flexible';
}

function constraintsFromSignals(tags: Set<string>): StructuredNeed['constraints'] {
  const noPersonalTransport = tags.has('constraint:no_transport') || tags.has('constraint:ride_needed');
  return {
    noPersonalTransport,
    pickupOk: !noPersonalTransport,
    deliveryPreferred: false,
  };
}

/** Deterministic interpretation — no AI, no silent household/income inference. */
export function interpretOpportunityQuery(
  rawQuery: string,
  location: OpportunityLocation = { missing: true },
): InterpretedOpportunity {
  const q = rawQuery.trim();
  const tags = new Set<string>();
  for (const s of [...URGENCY_TODAY, ...TRANSPORT, ...GIVE]) {
    if (s.re.test(q)) tags.add(s.tag);
  }

  let pillar: OpportunityPillar = 'need_help';
  if ([...tags].some((t) => t.startsWith('give:'))) pillar = 'can_help';
  else if ([...tags].some((t) => t.startsWith('grow:'))) pillar = 'want_to_grow';

  const needs: StructuredNeed[] = [];
  const matchedSignals: string[] = [...tags];

  for (const e of ESSENTIAL) {
    if (e.re.test(q)) {
      needs.push({
        localId: newLocalId(),
        kind: 'essential',
        category: e.category,
        label: e.label,
        urgency: urgencyFromSignals(tags),
        constraints: constraintsFromSignals(tags),
      });
      matchedSignals.push(e.tag);
    }
  }
  for (const g of GROWTH) {
    if (g.re.test(q)) {
      needs.push({
        localId: newLocalId(),
        kind: 'growth',
        category: g.category,
        label: g.label,
        urgency: urgencyFromSignals(tags),
        constraints: constraintsFromSignals(tags),
      });
      matchedSignals.push(g.tag);
      pillar = 'want_to_grow';
    }
  }

  if (tags.has('constraint:ride_needed') || tags.has('constraint:no_transport')) {
    const hasTransportProgram = needs.some((n) => n.category === 'transportation');
    if (!hasTransportProgram) {
      needs.push({
        localId: newLocalId(),
        kind: 'essential',
        category: 'transportation',
        label: 'Transportation assistance',
        urgency: urgencyFromSignals(tags),
        constraints: constraintsFromSignals(tags),
      });
      matchedSignals.push('need:transport_inferred');
    }
  }

  if (needs.length === 0) {
    needs.push({
      localId: newLocalId(),
      kind: pillar === 'can_help' ? 'give' : 'essential',
      category: pillar === 'can_help' ? 'volunteer' : 'other',
      label: pillar === 'can_help' ? 'Give or volunteer' : 'General community help',
      urgency: urgencyFromSignals(tags),
      constraints: constraintsFromSignals(tags),
    });
    matchedSignals.push('fallback:general');
  }

  return { pillar, rawQuery: q, needs, location, matchedSignals };
}
