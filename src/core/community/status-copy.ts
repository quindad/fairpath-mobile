/** Member-facing status labels — plain language, not internal enum dumps. */
export function communityRequestStatusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Open — waiting for help';
    case 'matched':
      return 'Matched — offer accepted (not fulfilled yet)';
    case 'fulfilled':
      return 'Fulfilled — assistance confirmed';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    default:
      return status.replace(/_/g, ' ');
  }
}

export function communityPlanStatusHint(status: string): string | null {
  if (status === 'matched') return 'Mark fulfilled only after assistance actually happened.';
  if (status === 'open') return 'Review offers below when helpers respond.';
  return null;
}
