// Pure module (no imports) so scripts/audit-theme.mjs can execute it directly under Node.

/**
 * Routes whose screens have been migrated to semantic theme tokens and may follow light/dark/system.
 * EVERY OTHER route is a legacy screen (hardcoded dark palette): ScreenFrame renders those inside a forced-dark
 * scope, so light mode never produces a dark screen inside light chrome.
 *
 * Migrating a screen = convert it to tokens (no FairPathColors, no hex), then add its route here.
 * scripts/audit-theme.mjs enforces both halves.
 */
export const THEMED_ROUTES: readonly string[] = ['/appearance', '/resources', '/resource', '/saved-resources', '/opportunity-profile', '/documents', '/me', '/privacy', '/credit', '/record-relief', '/fairpath-ai'];

export function isThemedRoute(path: string): boolean {
  return THEMED_ROUTES.some((route) => path === route || path.startsWith(route + '/'));
}
