/** Lightweight prompt-injection heuristics for on-device Signal routing (not a security boundary). */
const INJECTION_PATTERNS: RegExp[] = [
  /\bignore (all )?(previous|prior) instructions\b/i,
  /\bdisregard (your|the) (system|developer) (prompt|message)\b/i,
  /\byou are now\b/i,
  /\bact as (an? )?(unrestricted|jailbroken)\b/i,
  /\breveal (your|the) (system|hidden) prompt\b/i,
  /\bDAN\b/,
];

export function looksLikePromptInjection(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return INJECTION_PATTERNS.some((p) => p.test(t));
}

export function sanitizeToolQuery(text: string, maxLen = 120): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLen);
}
