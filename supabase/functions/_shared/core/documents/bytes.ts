// Tiny byte helpers (no heavy imports), shared by the app and the Edge Function.

export function base64ToBytes(b64: string): Uint8Array {
  const g = globalThis as unknown as { atob?: (s: string) => string; Buffer?: { from(s: string, enc: string): Uint8Array } };
  if (g.Buffer) return new Uint8Array(g.Buffer.from(b64, 'base64'));
  const bin = g.atob!(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** SHA-256 hex via WebCrypto (browsers, Node, Deno, and React Native with the crypto polyfill). Null when unavailable. */
export async function sha256Hex(bytes: Uint8Array): Promise<string | null> {
  const subtle = (globalThis as unknown as { crypto?: { subtle?: { digest(a: string, d: Uint8Array): Promise<ArrayBuffer> } } }).crypto?.subtle;
  if (!subtle) return null;
  const digest = await subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
