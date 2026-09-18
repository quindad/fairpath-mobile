import type {CompatibilityEvidence,MatchExplanation} from './types';
export function explainEvidence(evidence:CompatibilityEvidence[]):MatchExplanation{
 const explicit=evidence.some(e=>e.type==='second_chance_explicit'||e.type==='fair_chance_explicit');
 const restrictions=evidence.filter(e=>e.type==='restriction').map(e=>e.text).filter(Boolean) as string[];
 const unknowns=evidence.length===0||evidence.some(e=>e.type==='unknown')?['Background or screening policy needs additional review.']:[];
 return {band:restrictions.length?'needs_review':explicit?'verified_second_chance':unknowns.length?'unknown':'compatible',reasons:explicit?['The source contains explicit second-chance or fair-chance evidence.']:[],unknowns,hardRestrictions:restrictions};
}
