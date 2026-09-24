/**
 * Offense -> provisional taxonomy category keyword matcher.
 *
 * PURE, ZERO-IMPORT, DEPENDENCY-FREE by design:
 *   1. It must be genuinely unit-testable by plain Node (see
 *      scripts/audit-canonical-profile.mjs, which imports this file
 *      directly — Node 24's native TS type-stripping only resolves
 *      relative imports that include an explicit file extension, which
 *      is not this codebase's style, so the safest way to keep this
 *      file both app-safe and test-safe is to avoid importing anything).
 *   2. It must never touch Supabase, storage, or any user data on its
 *      own — it is a suggestion function, not a writer.
 *
 * The category key strings below must stay in sync with
 * src/core/models/offense-taxonomy.ts's OFFENSE_TAXONOMY_CATEGORIES.
 * scripts/audit-canonical-profile.mjs checks that the two files' key
 * lists match exactly.
 *
 * THIS DOES NOT RUN AUTOMATICALLY ANYWHERE. Per the Step 1 scope, no
 * code path in this pass calls this function against real user data or
 * mutates any conviction row. It exists so a *future, explicitly
 * invoked* categorization pass has a tested building block, and so its
 * behavior can be reviewed before it is ever wired to run.
 */

export type OffenseCategorizationConfidence = 'high' | 'low';

export type OffenseCategorizationResult = {
  categoryKey: string;
  confidence: OffenseCategorizationConfidence;
  matchedKeyword: string;
};

type KeywordRule = { keyword: string; categoryKey: string };

// Ordered: more specific/higher-signal keywords first, since the first
// match wins. Deliberately conservative — a short, common-sense list,
// not an attempt at legal precision. Provisional, same as the taxonomy
// it serves.
const KEYWORD_RULES: KeywordRule[] = [
  // sex_offenses (checked early: e.g. "sexual assault" should not fall
  // through to the broader "assault" -> violence rule below)
  { keyword: 'sexual assault', categoryKey: 'sex_offenses' },
  { keyword: 'rape', categoryKey: 'sex_offenses' },
  { keyword: 'indecent exposure', categoryKey: 'sex_offenses' },
  { keyword: 'sex offender', categoryKey: 'sex_offenses' },
  { keyword: 'sexual', categoryKey: 'sex_offenses' },

  // weapons
  { keyword: 'firearm', categoryKey: 'weapons' },
  { keyword: 'weapon', categoryKey: 'weapons' },
  { keyword: 'gun', categoryKey: 'weapons' },

  // violence
  { keyword: 'homicide', categoryKey: 'violence' },
  { keyword: 'murder', categoryKey: 'violence' },
  { keyword: 'manslaughter', categoryKey: 'violence' },
  { keyword: 'assault', categoryKey: 'violence' },
  { keyword: 'battery', categoryKey: 'violence' },
  { keyword: 'robbery', categoryKey: 'violence' },
  { keyword: 'domestic violence', categoryKey: 'violence' },
  { keyword: 'kidnapping', categoryKey: 'violence' },

  // drugs
  { keyword: 'possession of a controlled substance', categoryKey: 'drugs' },
  { keyword: 'controlled substance', categoryKey: 'drugs' },
  { keyword: 'narcotics', categoryKey: 'drugs' },
  { keyword: 'trafficking', categoryKey: 'drugs' },
  { keyword: 'drug', categoryKey: 'drugs' },
  { keyword: 'marijuana', categoryKey: 'drugs' },
  { keyword: 'cannabis', categoryKey: 'drugs' },

  // fraud_financial
  { keyword: 'fraud', categoryKey: 'fraud_financial' },
  { keyword: 'embezzlement', categoryKey: 'fraud_financial' },
  { keyword: 'forgery', categoryKey: 'fraud_financial' },
  { keyword: 'identity theft', categoryKey: 'fraud_financial' },
  { keyword: 'counterfeiting', categoryKey: 'fraud_financial' },

  // property_theft (checked after fraud/identity-theft so
  // "identity theft" doesn't fall through to the generic "theft" rule)
  { keyword: 'burglary', categoryKey: 'property_theft' },
  { keyword: 'larceny', categoryKey: 'property_theft' },
  { keyword: 'theft', categoryKey: 'property_theft' },
  { keyword: 'shoplifting', categoryKey: 'property_theft' },
  { keyword: 'vandalism', categoryKey: 'property_theft' },
  { keyword: 'trespass', categoryKey: 'property_theft' },
  { keyword: 'arson', categoryKey: 'property_theft' },

  // driving_vehicle
  { keyword: 'dui', categoryKey: 'driving_vehicle' },
  { keyword: 'dwi', categoryKey: 'driving_vehicle' },
  { keyword: 'driving under the influence', categoryKey: 'driving_vehicle' },
  { keyword: 'reckless driving', categoryKey: 'driving_vehicle' },
  { keyword: 'suspended license', categoryKey: 'driving_vehicle' },
  { keyword: 'hit and run', categoryKey: 'driving_vehicle' },

  // public_order
  { keyword: 'disorderly conduct', categoryKey: 'public_order' },
  { keyword: 'public intoxication', categoryKey: 'public_order' },
  { keyword: 'loitering', categoryKey: 'public_order' },
  { keyword: 'resisting arrest', categoryKey: 'public_order' },
  { keyword: 'probation violation', categoryKey: 'public_order' },
  { keyword: 'contempt of court', categoryKey: 'public_order' },
];

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

/**
 * Suggests a taxonomy category for an offense description. Returns
 * null (never a guess) when nothing matches confidently. Confidence is
 * 'high' only for a direct offense_title/offense_category match against
 * a known keyword; 'low' is not currently produced (reserved for a
 * future fuzzier pass) so every result returned today is a confident
 * one — callers should still treat this as a *suggestion* requiring
 * human/user confirmation, never an automatic write.
 */
export function categorizeOffense(input: {
  offenseTitle?: string | null;
  offenseCategory?: string | null;
}): OffenseCategorizationResult | null {
  const haystacks = [input.offenseCategory, input.offenseTitle]
    .filter((v): v is string => Boolean(v && v.trim()))
    .map(normalize);

  if (haystacks.length === 0) return null;

  for (const haystack of haystacks) {
    for (const rule of KEYWORD_RULES) {
      if (haystack.includes(rule.keyword)) {
        return { categoryKey: rule.categoryKey, confidence: 'high', matchedKeyword: rule.keyword };
      }
    }
  }

  return null;
}
