/** Signed-in routes that must stay reachable while terms or onboarding are incomplete. */
export function isOnboardingFlowRoute(path: string): boolean {
  return path === '/accept-terms' || path === '/onboarding' || path.startsWith('/legal/') || path === '/join' || path === '/intro' || path.startsWith('/intro/');
}
