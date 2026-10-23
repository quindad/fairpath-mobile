// V1 food sharing rules for Marketplace / Food Rescue listings. Server moderation still applies.

const BLOCKED_FOOD_PATTERNS = [
  /\bhomemade\b/i,
  /\bcooked\b/i,
  /\bprepared meal\b/i,
  /\bleftover\b/i,
  /\brefrigerat/i,
  /\bopen(ed)?\s+(container|package|bag)\b/i,
  /\bunlabeled\b/i,
  /\braw\s+(meat|fish|poultry|seafood)\b/i,
];

export type FoodListingCheck = { ok: true } | { ok: false; reason: string };

export function validateFoodListingText(title: string, description: string): FoodListingCheck {
  const blob = `${title}\n${description}`;
  for (const re of BLOCKED_FOOD_PATTERNS) {
    if (re.test(blob)) {
      return {
        ok: false,
        reason:
          'FairPath food sharing focuses on sealed, shelf-stable groceries and properly packaged eligible foods. Homemade meals, open leftovers, and unlabeled prepared food are not supported in V1.',
      };
    }
  }
  return { ok: true };
}

export function foodListingRequiresBestBy(category: string): boolean {
  return category === 'Food';
}

export type FoodRescueDonorIntake = {
  title: string;
  description: string;
  quantity: number;
  bestByNote: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  storageNotes: string;
  city: string;
  state: string;
  pickupArea?: string;
  pickupCity: string;
  pickupState: string;
};

export function validateFoodRescueDonorIntake(input: FoodRescueDonorIntake): FoodListingCheck {
  if (input.title.trim().length < 3) {
    return { ok: false, reason: 'Add a short name for what you are sharing (at least 3 characters).' };
  }
  if (input.description.trim().length < 10) {
    return { ok: false, reason: 'Add a description so neighbors know quantity, packaging, and pickup expectations.' };
  }
  const textCheck = validateFoodListingText(input.title, input.description);
  if (!textCheck.ok) return textCheck;
  if (input.bestByNote.trim().length < 3) {
    return { ok: false, reason: 'Add best-by or expiration info (for example: Best by 12/2026, sealed boxes).' };
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 1 || input.quantity > 99) {
    return { ok: false, reason: 'Quantity must be between 1 and 99.' };
  }
  if (!input.pickupWindowStart.trim() || !input.pickupWindowEnd.trim()) {
    return { ok: false, reason: 'Add today’s pickup window start and end times.' };
  }
  if (input.storageNotes.trim().length > 0 && input.storageNotes.trim().length < 5) {
    return { ok: false, reason: 'Storage notes are optional — if you add them, include a bit more detail.' };
  }
  if (!input.city.trim() || input.state.trim().length < 2) {
    return { ok: false, reason: 'Add the public city and state where pickup happens.' };
  }
  if (!input.pickupCity.trim() || input.pickupState.trim().length < 2) {
    return { ok: false, reason: 'Add private pickup city and state (exact address can stay optional).' };
  }
  return { ok: true };
}
