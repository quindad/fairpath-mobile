import { ENGINE_REGISTRY } from './engine-registry.ts';
import { nationwideEngineeringCalculationGate } from './nationwide-completeness.ts';

/** Jurisdictions where the in-app 57-authority engine may run substantive calculations (engineering gate). */
export function loadEngineSupportedJurisdictionCodes(): Set<string> {
  return new Set(Object.keys(ENGINE_REGISTRY).filter(nationwideEngineeringCalculationGate));
}

export function jurisdictionHasEngineSupport(jurisdictionCode: string): boolean {
  return loadEngineSupportedJurisdictionCodes().has(jurisdictionCode.toUpperCase());
}

export const ENGINE_COVERAGE_LAYER = {
  engine: 'ENGINE',
  dbRule: 'DB RULE',
  engineHint: 'FairPath can run the shared eligibility calculator for that jurisdiction.',
  dbRuleHint: 'A verified filing rule is loaded from our database for steps and citations.',
} as const;
