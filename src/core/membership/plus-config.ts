/**
 * The ONE place FairPath+ product configuration lives. Screens must import from here, never hard-code a price.
 *
 * `displayPriceUsd` is what the FairPath+ screen advertises (current working price: $2/month). The amount a
 * member is actually billed is set by the App Store / Google Play product, not by this number, and FastTrack
 * pricing is server-controlled (payment_products). Store product ids stay null until the products exist in
 * App Store Connect / Google Play Console; while null the app shows an honest "not connected" state.
 */
export const FAIRPATH_PLUS_PRODUCT = {
  id: 'fairpath_plus_monthly',
  name: 'FairPath+',
  period: 'month',
  displayPriceUsd: 2,
  appleProductId: null as string | null,
  googleProductId: null as string | null,
} as const;

export const FAIRPATH_PLUS_MONTHLY_PRICE_USD = FAIRPATH_PLUS_PRODUCT.displayPriceUsd;
