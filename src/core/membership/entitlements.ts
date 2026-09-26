import type { PlusFeature, PlusStatus } from '@/core/membership/plus-status';
import { hasFeature } from '@/core/membership/plus-status';

export type { PlusFeature } from '@/core/membership/plus-status';

/** Where each FairPath+ feature lives when the member has it (non-members are sent to /plus). */
export const PLUS_FEATURES: Record<PlusFeature, { title: string; route: string }> = {
  ai_resume: { title: 'Résumé Builder', route: '/plus' },
  ai_cover_letter: { title: 'Cover Letters', route: '/plus' },
  ai_application: { title: 'Application Assistant', route: '/plus' },
  ai_interview: { title: 'Interview Prep', route: '/plus' },
  ai_housing: { title: 'Housing Assistant', route: '/plus' },
  ai_forward_plan: { title: 'FairPath Forward Plan', route: '/plus' },
  ai_document: { title: 'Document Assistant', route: '/plus' },
  credit_builder: { title: 'Credit Builder', route: '/credit-tools' },
  marketplace_claims: { title: 'Marketplace claims', route: '/plus' },
  fasttrack_discount: { title: 'FastTrack savings', route: '/plus' },
};

export function getFeatureDestination(status: PlusStatus, feature: PlusFeature) {
  return hasFeature(status, feature) ? PLUS_FEATURES[feature].route : '/plus';
}
