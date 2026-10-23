export const COMMUNITY_HELP_CATEGORIES = [
  { id: 'groceries', label: 'Groceries' },
  { id: 'food_assistance', label: 'Food assistance' },
  { id: 'clothing', label: 'Clothing' },
  { id: 'hygiene', label: 'Hygiene products' },
  { id: 'baby_supplies', label: 'Baby supplies' },
  { id: 'diapers', label: 'Diapers' },
  { id: 'school_supplies', label: 'School supplies' },
  { id: 'household_essentials', label: 'Household essentials' },
  { id: 'transportation', label: 'Transportation help' },
  { id: 'other', label: 'Other necessities' },
] as const;

export type CommunityHelpCategoryId = (typeof COMMUNITY_HELP_CATEGORIES)[number]['id'];

export const COMMUNITY_URGENCY = [
  { id: 'today', label: 'Needed today' },
  { id: 'this_week', label: 'This week' },
  { id: 'flexible', label: 'Flexible' },
] as const;

export type CommunityHelpUrgency = (typeof COMMUNITY_URGENCY)[number]['id'];

export function communityCategoryLabel(id: string): string {
  return COMMUNITY_HELP_CATEGORIES.find((c) => c.id === id)?.label ?? id.replaceAll('_', ' ');
}

/** Maps a community need category to Resource Center category slug(s). */
export function resourceSlugsForCommunityCategory(category: string): string[] {
  switch (category) {
    case 'groceries':
    case 'food_assistance':
      return ['food'];
    case 'clothing':
      return ['family_services'];
    case 'hygiene':
    case 'household_essentials':
    case 'baby_supplies':
    case 'diapers':
      return ['emergency_assistance', 'family_services'];
    case 'school_supplies':
      return ['education'];
    case 'transportation':
      return ['transportation'];
    default:
      return ['emergency_assistance'];
  }
}

/** Maps a community need to Marketplace browse categories (existing taxonomy). */
export function marketplaceCategoriesForNeed(category: string): string[] {
  switch (category) {
    case 'groceries':
    case 'food_assistance':
      return ['Food'];
    case 'clothing':
      return ['Clothing'];
    case 'baby_supplies':
    case 'diapers':
      return ['Kids & Baby'];
    case 'school_supplies':
      return ['Books & Media', 'Other'];
    case 'household_essentials':
      return ['Home'];
    case 'hygiene':
      return ['Other'];
    default:
      return [];
  }
}
