/** Maps internal / RPC errors to member-safe copy (no stack traces, IDs, or PII). */
export function foodRescueErrorMessage(code: string): { title: string; body: string } {
  switch (code) {
    case 'SIGNED_OUT':
      return { title: 'Sign in required', body: 'Sign in to browse, save, or claim Food Rescue listings.' };
    case 'CLAIM_LIMIT_REACHED':
      return {
        title: 'Monthly claim limit reached',
        body: 'FairPath limits free Marketplace claims each month. Upgrade or wait until your limit resets.',
      };
    case 'OWN_ITEM':
      return { title: 'This is your donation', body: 'You cannot claim food you listed yourself.' };
    case 'ITEM_UNAVAILABLE':
      return { title: 'No longer available', body: 'Someone else reserved this food or the listing was closed.' };
    case 'RESERVE_RPC_BLOCKED':
      return {
        title: 'Claiming not available yet',
        body: 'Food Rescue claiming is not enabled on this environment. Browse listings is read-only until the server is updated.',
      };
    case 'LOAD_FAILED':
      return { title: 'Could not load', body: 'Check your connection and try again.' };
    case 'DONATION_FAILED':
      return { title: 'Could not publish donation', body: 'Review the form and try again.' };
    case 'MODERATION_REQUIRED':
      return {
        title: 'Submitted for review',
        body: 'Your donation was saved and may need a quick safety review before neighbors can see it.',
      };
    default:
      return { title: 'Something went wrong', body: 'Please try again in a moment.' };
  }
}

export function foodRescueClaimErrorCode(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg === 'SIGNED_OUT' || msg === 'CLAIM_LIMIT_REACHED' || msg === 'OWN_ITEM' || msg === 'ITEM_UNAVAILABLE') return msg;
    if (msg.includes('request_marketplace_claim') || msg.includes('Could not find the function')) return 'RESERVE_RPC_BLOCKED';
  }
  return 'UNKNOWN';
}
