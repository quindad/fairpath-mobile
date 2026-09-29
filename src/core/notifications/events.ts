/**
 * Canonical internal notification event vocabulary.
 *
 * This is the ONE place that defines what a FairPath notification event is, before any external delivery
 * channel exists. `create_notification()` (server-side) is already the single write path for the in-app
 * inbox (user_notifications) — this file is the client-side catalog of what those categories/dedupe patterns
 * MEAN, so a future push/email/SMS adapter has one source of truth instead of guessing from ad-hoc strings
 * scattered across server functions.
 *
 * Nothing here sends anything. `notification_deliveries` (queued automatically by a DB trigger whenever
 * create_notification() runs) is the real delivery boundary, and it stays exactly as honest as it is today:
 * rows sit at status='pending' until a real worker with real provider credentials exists. This file does not
 * change that — it only gives a future worker/UI a canonical vocabulary to consume instead of raw category
 * strings.
 */

export type NotificationEventId =
  | 'MARKET_OPENED' | 'EARLY_ACCESS_GRANTED' | 'FAIRPATH_PLUS_EXPIRING'
  | 'NEW_MATCHING_JOB' | 'NEW_MATCHING_HOUSING' | 'SAVED_JOB_CHANGED' | 'SAVED_HOUSING_CHANGED'
  | 'APPLICATION_UPDATED' | 'HOUSING_APPLICATION_UPDATED' | 'INQUIRY_RESPONSE'
  | 'MEETING_REMINDER' | 'CREDIT_DISPUTE_FOLLOW_UP' | 'RECORD_RELIEF_DATE' | 'DOCUMENT_EXPIRING' | 'MARKETPLACE_CLAIM_UPDATE';

export type Channel = 'in_app' | 'push' | 'email' | 'sms';

/** Whether the event body can ever contain something a member would consider sensitive on a lock screen. */
export type PrivacyLevel = 'safe' | 'sensitive';

export type NotificationEventDef = {
  id: NotificationEventId;
  /** Channels this event is ALLOWED to use once they exist — not a claim any of them are connected today. */
  allowedChannels: Channel[];
  privacy: PrivacyLevel;
  /** Route the notification deep-links to. */
  route: string;
  /** How create_notification()'s dedupe_key should be shaped for this event, so every emitter stays consistent. */
  dedupeKeyPattern: string;
  urgency: 'low' | 'normal' | 'high';
  /** Whether this requires the member's marketing/product-update consent, vs. being an account-critical message
   * that should never be silenced by a marketing opt-out (a future preferences UI must respect this split). */
  requiresMarketingConsent: boolean;
};

export const NOTIFICATION_EVENTS: Record<NotificationEventId, NotificationEventDef> = {
  MARKET_OPENED: {
    id: 'MARKET_OPENED', allowedChannels: ['in_app', 'push', 'email'], privacy: 'safe', route: '/find-jobs',
    dedupeKeyPattern: 'market_activated:{market_code}:{user_id}', urgency: 'normal', requiresMarketingConsent: true,
  },
  EARLY_ACCESS_GRANTED: {
    id: 'EARLY_ACCESS_GRANTED', allowedChannels: ['in_app', 'push', 'email'], privacy: 'safe', route: '/plus',
    dedupeKeyPattern: 'entitlement_granted:{grant_id}', urgency: 'normal', requiresMarketingConsent: false,
  },
  FAIRPATH_PLUS_EXPIRING: {
    id: 'FAIRPATH_PLUS_EXPIRING', allowedChannels: ['in_app', 'push', 'email'], privacy: 'safe', route: '/plus',
    dedupeKeyPattern: 'entitlement_expiring:{grant_id}:{threshold}', urgency: 'low', requiresMarketingConsent: false,
  },
  NEW_MATCHING_JOB: {
    id: 'NEW_MATCHING_JOB', allowedChannels: ['in_app', 'push', 'email'], privacy: 'safe', route: '/find-jobs',
    dedupeKeyPattern: 'new_job_match:{search_id}:{job_id}', urgency: 'low', requiresMarketingConsent: true,
  },
  NEW_MATCHING_HOUSING: {
    id: 'NEW_MATCHING_HOUSING', allowedChannels: ['in_app', 'push', 'email'], privacy: 'safe', route: '/find-housing',
    dedupeKeyPattern: 'new_housing_match:{search_id}:{listing_id}', urgency: 'low', requiresMarketingConsent: true,
  },
  SAVED_JOB_CHANGED: {
    id: 'SAVED_JOB_CHANGED', allowedChannels: ['in_app', 'push'], privacy: 'safe', route: '/saved-jobs',
    dedupeKeyPattern: 'saved_job_changed:{job_id}:{change}', urgency: 'low', requiresMarketingConsent: true,
  },
  SAVED_HOUSING_CHANGED: {
    id: 'SAVED_HOUSING_CHANGED', allowedChannels: ['in_app', 'push'], privacy: 'safe', route: '/saved-homes',
    dedupeKeyPattern: 'saved_housing_changed:{listing_id}:{change}', urgency: 'low', requiresMarketingConsent: true,
  },
  // Sensitive: application status can itself be information a member wouldn't want visible on a lock screen
  // (e.g. "denied"). Push/SMS previews must use a neutral body ("Your application was updated") not the outcome.
  APPLICATION_UPDATED: {
    id: 'APPLICATION_UPDATED', allowedChannels: ['in_app', 'push', 'email'], privacy: 'sensitive', route: '/job-applications',
    dedupeKeyPattern: 'job_application_updated:{application_id}:{status}', urgency: 'normal', requiresMarketingConsent: false,
  },
  HOUSING_APPLICATION_UPDATED: {
    id: 'HOUSING_APPLICATION_UPDATED', allowedChannels: ['in_app', 'push', 'email'], privacy: 'sensitive', route: '/housing-applications',
    dedupeKeyPattern: 'housing_application_updated:{application_id}:{status}', urgency: 'normal', requiresMarketingConsent: false,
  },
  INQUIRY_RESPONSE: {
    id: 'INQUIRY_RESPONSE', allowedChannels: ['in_app', 'push'], privacy: 'safe', route: '/housing-inquiries',
    dedupeKeyPattern: 'inquiry_reply:{inquiry_id}', urgency: 'normal', requiresMarketingConsent: false,
  },
  MEETING_REMINDER: {
    id: 'MEETING_REMINDER', allowedChannels: ['in_app', 'push', 'sms'], privacy: 'sensitive', route: '/meetings',
    dedupeKeyPattern: 'meeting_reminder:{meeting_id}:{offset}', urgency: 'high', requiresMarketingConsent: false,
  },
  // Sensitive: dispute/credit content must never appear in a push/SMS preview body.
  CREDIT_DISPUTE_FOLLOW_UP: {
    id: 'CREDIT_DISPUTE_FOLLOW_UP', allowedChannels: ['in_app', 'push'], privacy: 'sensitive', route: '/credit',
    dedupeKeyPattern: 'dispute_follow_up:{dispute_id}', urgency: 'normal', requiresMarketingConsent: false,
  },
  // Sensitive: a record-relief date/countdown is justice-history-adjacent information.
  RECORD_RELIEF_DATE: {
    id: 'RECORD_RELIEF_DATE', allowedChannels: ['in_app', 'push'], privacy: 'sensitive', route: '/record-relief',
    dedupeKeyPattern: 'relief_date:{case_id}:{evaluation_id}', urgency: 'normal', requiresMarketingConsent: false,
  },
  DOCUMENT_EXPIRING: {
    id: 'DOCUMENT_EXPIRING', allowedChannels: ['in_app', 'push', 'email'], privacy: 'safe', route: '/documents',
    dedupeKeyPattern: 'document_expiring:{document_id}', urgency: 'low', requiresMarketingConsent: false,
  },
  // Added to close a real catalog/producer mismatch found in the boardroom sprint's notification audit:
  // approve_marketplace_claim() and related Marketplace claim-lifecycle functions were already the most fully-
  // built notification producer in the schema (baseline_constraints_security_logic.sql), inserting directly
  // under the 'marketplace_claim' DB category, but had no entry here at all.
  MARKETPLACE_CLAIM_UPDATE: {
    id: 'MARKETPLACE_CLAIM_UPDATE', allowedChannels: ['in_app', 'push'], privacy: 'safe', route: '/marketplace-claim',
    dedupeKeyPattern: 'marketplace_claim_update:{claim_id}:{status}', urgency: 'normal', requiresMarketingConsent: false,
  },
};
