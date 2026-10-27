/**
 * Provider-neutral credit score / monitoring presentation.
 * FairPath does not fabricate scores. Array (or another bureau partner) would implement
 * `CreditMonitoringProvider` behind feature flags + member consent — not wired here.
 */

export type CreditMonitoringProviderId = 'fairpath_manual' | 'array';

export type CreditWorkspaceCounts = {
  reports: number;
  uploads: number;
  accounts: number;
  accountsToConfirm: number;
  openIssues: number;
  confirmedIssues: number;
  activeDisputes: number;
};

export type CreditScorePresentation = {
  providerId: CreditMonitoringProviderId;
  /** Section title for "My Credit" */
  title: string;
  headline: string;
  detail: string;
  /** Always null until a real, authorized provider returns verified data */
  scoreDisplay: null;
  partnerReady: boolean;
  featureRows: { label: string; status: 'available' | 'coming_soon' | 'manual_only' }[];
};

export interface CreditMonitoringProvider {
  readonly id: CreditMonitoringProviderId;
  presentation(counts: CreditWorkspaceCounts): CreditScorePresentation;
}

const manualProvider: CreditMonitoringProvider = {
  id: 'fairpath_manual',
  presentation(counts) {
    const hasData = counts.reports > 0 || counts.uploads > 0 || counts.accounts > 0;
    return {
      providerId: 'fairpath_manual',
      title: 'My Credit',
      headline: hasData ? 'Your report workspace' : 'Start with your own report',
      detail: hasData
        ? `${counts.reports} report${counts.reports === 1 ? '' : 's'} on file · ${counts.accounts} account${counts.accounts === 1 ? '' : 's'} tracked. FairPath never shows a score unless a verified provider is connected.`
        : 'Upload a bureau PDF, enter accounts yourself, or connect a monitoring partner when available. No score is invented here.',
      scoreDisplay: null,
      partnerReady: false,
      featureRows: [
        { label: 'Upload, review, and dispute — under your control today', status: 'available' },
        { label: 'Live score & monitoring (Array, when approved)', status: 'coming_soon' },
      ],
    };
  },
};

/** Future: swap when Array credentials + legal approval exist. Must not call external APIs until then. */
const arrayPlaceholder: CreditMonitoringProvider = {
  id: 'array',
  presentation(counts) {
    const base = manualProvider.presentation(counts);
    return {
      ...base,
      providerId: 'array',
      partnerReady: false,
      detail:
        base.detail +
        ' Array integration is prepared in the app architecture but not activated — no credit data is sent to Array from this build.',
      featureRows: base.featureRows.map((r) =>
        r.label.includes('Array') ? { ...r, status: 'coming_soon' as const } : r,
      ),
    };
  },
};

let activeProvider: CreditMonitoringProvider = manualProvider;

/** DEV hook to select provider UI copy without network calls. */
export function setCreditMonitoringProvider(id: CreditMonitoringProviderId) {
  activeProvider = id === 'array' ? arrayPlaceholder : manualProvider;
}

export function getCreditMonitoringProvider(): CreditMonitoringProvider {
  return activeProvider;
}

export function loadCreditPresentation(counts: CreditWorkspaceCounts): CreditScorePresentation {
  return getCreditMonitoringProvider().presentation(counts);
}
