// Pure helper (no imports) so audit scripts can execute it directly under Node.

/**
 * Routes reachable while signed out. The root layout redirects every OTHER route to /sign-in.
 *
 * /auth/callback MUST be public: it is the page that TURNS the tokens in the URL into a session (email
 * verification, OAuth return, the DEV QA sign-in URL). If the guard redirects it first, the URL fragment is dropped
 * and the session is never established. /check-email is shown right after sign-up, before any session exists.
 */
export function isPublicRoute(path: string): boolean {
  return (
    path === '/' ||
    path === '/find-jobs' ||
    path === '/early-access' ||
    path.startsWith('/job/') ||
    path === '/find-housing' ||
    path === '/housing-filters' ||
    path.startsWith('/housing/') ||
    path === '/sign-in' ||
    path === '/sign-up' ||
    path === '/forgot-password' ||
    path === '/reset-password' ||
    path === '/check-email' ||
    path === '/appearance' ||
    path === '/fairpath-ai' ||
    path === '/resources' ||
    path.startsWith('/resource/') ||
    path === '/auth/callback' ||
    path.startsWith('/auth/')
  );
}
