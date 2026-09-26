// Pure helper (no imports) so audit scripts can execute it directly under Node.

/** Pure: extracts tokens/errors from the redirect URL (hash for implicit flow, query as a fallback). */
export function parseAuthRedirect(url: string): { accessToken?: string; refreshToken?: string; error?: string } {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const hash = hashIndex >= 0 ? url.slice(hashIndex + 1) : '';
  const query = queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 && hashIndex > queryIndex ? hashIndex : undefined) : '';
  const params = new URLSearchParams([hash, query].filter(Boolean).join('&'));
  const err = params.get('error_description') || params.get('error');
  return {
    accessToken: params.get('access_token') ?? undefined,
    refreshToken: params.get('refresh_token') ?? undefined,
    error: err ? err.replace(/\+/g, ' ') : undefined,
  };
}

