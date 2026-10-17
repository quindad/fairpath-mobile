export const INVALID_RECOVERY_LINK = 'This reset link is invalid or expired.';

export type RecoveryRedirect = {
  accessToken?: string;
  refreshToken?: string;
  code?: string;
  type?: string;
  error?: string;
};

export function isTrustedRecoveryRedirect(url: string, webOrigin?: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'fairpathmobile:') {
      return parsed.hostname === 'reset-password' && (parsed.pathname === '' || parsed.pathname === '/');
    }
    if (!webOrigin || parsed.pathname !== '/reset-password') return false;
    return parsed.origin === new URL(webOrigin).origin;
  } catch {
    return false;
  }
}

/** Parses both Supabase PKCE query redirects and legacy implicit hash redirects. */
export function parseRecoveryRedirect(url: string): RecoveryRedirect {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : undefined) : '';
  const params = new URLSearchParams([hash, query].filter(Boolean).join('&'));
  const error = params.get('error_description') || params.get('error');
  return {
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
    code: params.get('code') ?? undefined,
    type: params.get('type') ?? undefined,
    error: error ? INVALID_RECOVERY_LINK : undefined,
  };
}

export function recoveryCredentialKind(parsed: RecoveryRedirect): 'pkce' | 'implicit' | 'invalid' {
  if (parsed.error) return 'invalid';
  if (parsed.code) return 'pkce';
  if (parsed.type === 'recovery' && parsed.accessToken && parsed.refreshToken) return 'implicit';
  return 'invalid';
}
