// Veterans service profile persistence (device-local, not server-synced). Every stored field needs an explicit consent
// record for that exact field. Loads validate shape and drop anything unknown, so tampered storage cannot grant consent.

import { BRANCHES, type BranchId } from './branches.ts';
import { SERVICE_PROFILE_FIELDS, type ConsentRecord, type ServiceProfileField } from './service-profile.ts';

export const VETERAN_PROFILE_KEY = 'fairpath.veterans.profile.v1';

export type VeteranProfile = {
  branch: BranchId | null;
  components: ('active' | 'reserve' | 'national_guard')[];
  /** Field values the member chose to store. Keys are restricted to known service-profile fields. */
  values: Partial<Record<ServiceProfileField, string>>;
  consents: ConsentRecord[];
  updatedAt: string;
};

const FIELDS = new Set<string>(SERVICE_PROFILE_FIELDS.map((f) => f.field));
const BRANCH_IDS = new Set<string>(BRANCHES.map((b) => b.id));
const COMPONENTS = new Set(['active', 'reserve', 'national_guard']);

export function emptyProfile(nowIso: string): VeteranProfile {
  return { branch: null, components: [], values: {}, consents: [], updatedAt: nowIso };
}

/** A value is stored only when that exact field is consented. Consent-less values are dropped on read and write. */
export function consented(profile: VeteranProfile, field: ServiceProfileField): boolean {
  return profile.consents.some((c) => c.field === field && c.granted);
}

export function setConsent(profile: VeteranProfile, field: ServiceProfileField, granted: boolean, nowIso: string): VeteranProfile {
  const rest = profile.consents.filter((c) => c.field !== field);
  const values = granted ? profile.values : { ...profile.values, [field]: undefined };
  return { ...profile, consents: [...rest, { field, granted }], values: stripUndefined(values), updatedAt: nowIso };
}

export function setValue(profile: VeteranProfile, field: ServiceProfileField, value: string, nowIso: string): VeteranProfile {
  if (!consented(profile, field)) return profile;
  return { ...profile, values: { ...profile.values, [field]: value.slice(0, 200) }, updatedAt: nowIso };
}

function stripUndefined<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

export function parseProfile(raw: string | null, nowIso: string): VeteranProfile {
  if (!raw) return emptyProfile(nowIso);
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    if (!p || typeof p !== 'object') return emptyProfile(nowIso);
    const branch = typeof p.branch === 'string' && BRANCH_IDS.has(p.branch) ? (p.branch as BranchId) : null;
    const components = Array.isArray(p.components)
      ? p.components.filter((c): c is 'active' | 'reserve' | 'national_guard' => typeof c === 'string' && COMPONENTS.has(c))
      : [];
    const consents: ConsentRecord[] = Array.isArray(p.consents)
      ? p.consents.filter((c): c is ConsentRecord => !!c && typeof c === 'object' && FIELDS.has((c as ConsentRecord).field) && typeof (c as ConsentRecord).granted === 'boolean')
      : [];
    const rawValues = p.values && typeof p.values === 'object' ? (p.values as Record<string, unknown>) : {};
    const values: Partial<Record<ServiceProfileField, string>> = {};
    for (const [k, v] of Object.entries(rawValues)) {
      const granted = consents.some((c) => c.field === k && c.granted);
      if (FIELDS.has(k) && typeof v === 'string' && granted) values[k as ServiceProfileField] = v.slice(0, 200);
    }
    return {
      branch,
      components,
      values,
      consents,
      updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : nowIso,
    };
  } catch {
    return emptyProfile(nowIso);
  }
}

export function serializeProfile(profile: VeteranProfile): string {
  return JSON.stringify(profile);
}
