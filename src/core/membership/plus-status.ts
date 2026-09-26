// Pure helpers (no imports) so audit scripts can execute them directly under Node.
// The SERVER decides whether a member has FairPath+ (public.my_fairpath_plus_status). Everything here only
// interprets that answer for display and UX gating. Client gating is UX, never security.

export type PlusSource =
  | 'paid_subscription'
  | 'correctional_transition'
  | 'institution_sponsor'
  | 'nonprofit_sponsor'
  | 'promo'
  | 'partner'
  | 'admin_grant'
  | 'support_exception';

export type PlusStatus = {
  active: boolean;
  source: PlusSource | null;
  complimentary?: boolean;
  provider?: string | null;
  starts_at?: string | null;
  expires_at?: string | null;
  days_remaining?: number | null;
  will_renew?: boolean | null;
  expired_source?: PlusSource | null;
  expired_at?: string | null;
};

export const NO_PLUS: PlusStatus = { active: false, source: null };

const SOURCE_LABEL: Record<PlusSource, string> = {
  paid_subscription: 'FairPath+ subscription',
  correctional_transition: 'Complimentary transition access',
  institution_sponsor: 'Sponsored by your program',
  nonprofit_sponsor: 'Sponsored access',
  promo: 'Promotional access',
  partner: 'Partner-provided access',
  admin_grant: 'Complimentary access',
  support_exception: 'Complimentary access',
};

export function sourceLabel(source: PlusSource | null | undefined): string {
  return source ? SOURCE_LABEL[source] : '';
}

/** Days until the (server-provided) expiry, or null when there is no fixed end. */
export function daysLeft(status: PlusStatus): number | null {
  return status.active && typeof status.days_remaining === 'number' ? status.days_remaining : null;
}

/** True inside the last 14 days of a complimentary period (used for the countdown emphasis). */
export function isExpiringSoon(status: PlusStatus): boolean {
  const d = daysLeft(status);
  return Boolean(status.active && status.complimentary && d !== null && d <= 14);
}

export type PlusView = {
  tone: 'active' | 'complimentary' | 'expired' | 'none';
  headline: string;
  detail: string;
  showSubscribe: boolean;
};

function longDate(iso: string | null | undefined): string | null {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : null;
}

/** What the FairPath+ screen should say. Never implies a charge for complimentary access. */
export function describePlus(status: PlusStatus): PlusView {
  if (status.active && status.complimentary) {
    const d = daysLeft(status);
    const ends = longDate(status.expires_at);
    return {
      tone: 'complimentary',
      headline: 'FairPath+ is active',
      detail:
        sourceLabel(status.source) + (ends ? ' · ends ' + ends : '') + (d !== null ? ' (' + d + ' day' + (d === 1 ? '' : 's') + ' left)' : '') +
        '. No payment is needed, and nothing will be charged when it ends.',
      showSubscribe: false,
    };
  }
  if (status.active) {
    const ends = longDate(status.expires_at);
    return {
      tone: 'active',
      headline: 'FairPath+ is active',
      detail: ends ? (status.will_renew ? 'Renews ' : 'Ends ') + ends + '.' : 'Your subscription is active.',
      showSubscribe: false,
    };
  }
  if (status.expired_source) {
    const when = longDate(status.expired_at);
    return {
      tone: 'expired',
      headline: 'Your FairPath+ access has ended',
      detail:
        sourceLabel(status.expired_source) + (when ? ' ended ' + when : ' ended') +
        '. Your account, profile, applications and saved items are unchanged. You can subscribe any time.',
      showSubscribe: true,
    };
  }
  return { tone: 'none', headline: 'FairPath is free to use', detail: 'FairPath+ adds AI tools, more Marketplace claims and FastTrack savings.', showSubscribe: true };
}

export type PlusFeature =
  | 'ai_resume' | 'ai_cover_letter' | 'ai_application' | 'ai_interview' | 'ai_housing' | 'ai_forward_plan' | 'ai_document'
  | 'credit_builder' | 'marketplace_claims' | 'fasttrack_discount';

/** UX gate only. Meaningful paid capabilities must ALSO be enforced by the server (see has_fairpath_plus). */
export function hasFeature(status: PlusStatus, _feature: PlusFeature): boolean {
  return Boolean(status.active);
}
