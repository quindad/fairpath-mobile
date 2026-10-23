import { ENGINE_REGISTRY } from './engine-registry.ts';
import { nationwideEngineeringCalculationGate } from './nationwide-completeness.ts';

/** Jurisdictions where the in-app 57-authority engine may run substantive calculations (engineering gate). */
export function loadEngineSupportedJurisdictionCodes(): Set<string> {
  return new Set(Object.keys(ENGINE_REGISTRY).filter(nationwideEngineeringCalculationGate));
}
