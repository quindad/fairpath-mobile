/**
 * @deprecated This file is now a backward-compatible re-export barrel.
 * The real implementations were split by domain as part of the V1
 * Foundation pass, so future work doesn't collide on one shared file:
 *
 *   - Jobs          -> @/core/jobs/jobs-service
 *   - Housing        -> @/core/housing/housing-service
 *   - Notifications  -> @/core/notifications/notifications-service
 *   - Analytics      -> @/core/analytics/product-events
 *
 * Existing screens keep importing from '@/core/opportunities/opportunity-service'
 * unchanged (zero import-path churn, zero regression risk). New code
 * should import directly from the domain module above instead of this
 * barrel.
 *
 * Two things were intentionally NOT carried over from the old file
 * because they were dead code with zero importers anywhere in the app
 * (verified before removal):
 *   - loadMarketplace / loadMarketplaceItem / saveMarketplace /
 *     claimMarketplaceItem — duplicated, out-of-date copies of the real,
 *     server-quota-enforced Marketplace flow in
 *     @/core/marketplace/marketplace-service. The old claimMarketplaceItem
 *     in particular bypassed the server-authoritative claim-quota RPC.
 *   - loadEmployerJobApplications / updateEmployerJobApplicationStatus —
 *     employer/Partner-side mutations that do not belong in the consumer
 *     Mobile bundle and had no caller.
 */
export * from '@/core/jobs/jobs-service';
export * from '@/core/housing/housing-service';
export * from '@/core/notifications/notifications-service';
export * from '@/core/analytics/product-events';
