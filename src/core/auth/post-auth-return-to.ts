/** Honors returnTo only when terms + onboarding are already satisfied (next is /home). */
export function applyPostAuthReturnTo(next: string, returnTo?: string | null): string {
  if (next === '/accept-terms' || next === '/onboarding') return next;
  if (returnTo?.startsWith('/')) return returnTo;
  return next;
}
