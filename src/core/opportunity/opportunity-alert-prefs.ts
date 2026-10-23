import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@fairpath/opportunity_alert_prefs_v1';

export type OpportunityAlertPrefs = {
  /** Master opt-in for opportunity-style alerts (local + in-app; push still requires server push_enabled). */
  enabled: boolean;
  relevantGive: boolean;
  newResources: boolean;
  referralUpdates: boolean;
  educationDeadlines: boolean;
  orgOpportunities: boolean;
  /** Minimum hours between duplicate alert keys. */
  minHoursBetweenSameKey: number;
};

export const DEFAULT_OPPORTUNITY_ALERT_PREFS: OpportunityAlertPrefs = {
  enabled: false,
  relevantGive: true,
  newResources: true,
  referralUpdates: true,
  educationDeadlines: true,
  orgOpportunities: true,
  minHoursBetweenSameKey: 24,
};

export async function loadOpportunityAlertPrefs(): Promise<OpportunityAlertPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_OPPORTUNITY_ALERT_PREFS };
    return { ...DEFAULT_OPPORTUNITY_ALERT_PREFS, ...(JSON.parse(raw) as Partial<OpportunityAlertPrefs>) };
  } catch {
    return { ...DEFAULT_OPPORTUNITY_ALERT_PREFS };
  }
}

export async function saveOpportunityAlertPrefs(prefs: OpportunityAlertPrefs): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(prefs));
}

const LAST_SENT_KEY = '@fairpath/opportunity_alert_last_sent_v1';

type LastSentMap = Record<string, string>;

export async function shouldDeliverOpportunityAlert(alertKey: string, prefs: OpportunityAlertPrefs): Promise<boolean> {
  if (!prefs.enabled) return false;
  try {
    const raw = await AsyncStorage.getItem(LAST_SENT_KEY);
    const map: LastSentMap = raw ? JSON.parse(raw) : {};
    const last = map[alertKey];
    if (!last) return true;
    const hours = (Date.now() - new Date(last).getTime()) / 3600000;
    return hours >= prefs.minHoursBetweenSameKey;
  } catch {
    return true;
  }
}

export async function recordOpportunityAlertDelivery(alertKey: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(LAST_SENT_KEY);
    const map: LastSentMap = raw ? JSON.parse(raw) : {};
    map[alertKey] = new Date().toISOString();
    const keys = Object.keys(map).slice(-80);
    const trimmed = Object.fromEntries(keys.map((k) => [k, map[k]]));
    await AsyncStorage.setItem(LAST_SENT_KEY, JSON.stringify(trimmed));
  } catch {
    /* best-effort dedupe store */
  }
}

/** Maps server notification metadata to a deep link route when safe. */
export function opportunityDeepLinkFromMetadata(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null;
  const requestId = metadata.request_id;
  if (typeof requestId === 'string') return `/community/need-help/${requestId}`;
  const referralId = metadata.referral_request_id;
  if (typeof referralId === 'string' && typeof metadata.resource_id === 'string') {
    return `/resource/${metadata.resource_id}`;
  }
  return null;
}
