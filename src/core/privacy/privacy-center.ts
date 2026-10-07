// Privacy Center core. Device-side rules and state; the server must enforce the same rules with RLS. Every disclosure is
// recorded, every grant can be revoked, and deletion requests move through explicit states and are never silently dropped.

export type Disclosure = {
  id: string;
  documentOrDataId: string;
  audience: string; // e.g. 'employer', 'housing_provider', 'partner_org', 'case_manager'
  action: 'granted' | 'revoked' | 'accessed';
  atIso: string;
};

export type DeletionState = 'none' | 'requested' | 'in_review' | 'completed' | 'legally_retained';

export type DeletionRequest = {
  id: string;
  requestedAt: string;
  state: Exclude<DeletionState, 'none'>;
  /** Some records must be kept under legal retention rules. The reason is shown to the member. */
  retentionReason: string | null;
};

export type PrivacySettings = {
  aiDataUse: 'allowed_for_my_requests' | 'off';
  locationSharing: 'off';
  safetyPathwayPartnerVisibility: 'none';
};

export const DEFAULT_SETTINGS: PrivacySettings = {
  aiDataUse: 'allowed_for_my_requests',
  locationSharing: 'off',
  safetyPathwayPartnerVisibility: 'none',
};

/** Location and Safety visibility are fixed off in the app. Changing them is not a user setting in this build. */
export function enforceFixedSettings(s: PrivacySettings): PrivacySettings {
  return { ...s, locationSharing: 'off', safetyPathwayPartnerVisibility: 'none' };
}

export function recordDisclosure(log: readonly Disclosure[], entry: Omit<Disclosure, 'id'>): Disclosure[] {
  return [...log, { ...entry, id: `disc-${log.length + 1}` }];
}

/** Active grants are the latest grant for each (data, audience) pair that has not been revoked since. */
export function activeGrants(log: readonly Disclosure[]): { documentOrDataId: string; audience: string }[] {
  const latest = new Map<string, Disclosure>();
  for (const d of log) {
    if (d.action === 'accessed') continue;
    latest.set(`${d.documentOrDataId}|${d.audience}`, d);
  }
  return [...latest.values()]
    .filter((d) => d.action === 'granted')
    .map((d) => ({ documentOrDataId: d.documentOrDataId, audience: d.audience }));
}

export function requestDeletion(existing: DeletionRequest | null, id: string, nowIso: string): DeletionRequest {
  if (existing && existing.state !== 'completed' && existing.state !== 'legally_retained') return existing;
  return { id, requestedAt: nowIso, state: 'requested', retentionReason: null };
}

export function advanceDeletion(req: DeletionRequest, to: Exclude<DeletionState, 'none' | 'requested'>, retentionReason: string | null): DeletionRequest {
  const order: DeletionState[] = ['requested', 'in_review', 'completed', 'legally_retained'];
  if (req.state === 'completed' || req.state === 'legally_retained') return req;
  if (order.indexOf(to) <= order.indexOf(req.state)) return req;
  if (to === 'legally_retained' && !retentionReason?.trim()) return req;
  return { ...req, state: to, retentionReason: to === 'legally_retained' ? retentionReason : null };
}

/** Export contains only the member's own data categories. Donor and partner-side internal records are never included. */
export const EXPORT_CATEGORIES = ['profile', 'documents', 'academy_progress', 'veteran_profile', 'disclosure_history', 'consents'] as const;
