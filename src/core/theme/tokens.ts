// Pure module (no imports) so scripts/audit-theme.mjs can execute it directly under Node.

export type ThemeScheme = 'dark' | 'light';
export type AppearanceMode = 'system' | 'light' | 'dark';

/**
 * Semantic tokens. Screens describe INTENT (text, textMuted, surface, accent), never a raw hex.
 * FairPath lime #A8F32C is the brand ACCENT FILL in both modes, always paired with `onAccent`.
 * Lime is not readable as small text on a light background, so text/links use `accentText`
 * (lime in dark, a darker green in light).
 */
export type ThemeTokens = {
  scheme: ThemeScheme;
  background: string;
  surface: string;
  surfaceRaised: string;
  input: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  accent: string;
  onAccent: string;
  accentText: string;
  accentSubtle: string;
  accentBorder: string;
  inverse: string;
  onInverse: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  navBackground: string;
  overlay: string;
};

export const DARK_TOKENS: ThemeTokens = {
  scheme: 'dark',
  background: '#090A09',
  surface: '#0F110F',
  surfaceRaised: '#111411',
  input: '#0A0C0A',
  text: '#F5F6F2',
  textSecondary: '#B8BDB8',
  textMuted: '#8D948D',
  border: '#242824',
  borderStrong: '#343A34',
  accent: '#A8F32C',
  onAccent: '#090A09',
  accentText: '#A8F32C',
  accentSubtle: '#11170D',
  accentBorder: '#526F2B',
  inverse: '#F5F6F2',
  onInverse: '#090A09',
  error: '#FF8A8A',
  success: '#6FD39A',
  warning: '#F5C451',
  info: '#7DB7FF',
  navBackground: '#090B09',
  overlay: 'rgba(0,0,0,0.6)',
};

export const LIGHT_TOKENS: ThemeTokens = {
  scheme: 'light',
  background: '#F5F6F2',
  surface: '#FFFFFF',
  surfaceRaised: '#ECEEE8',
  input: '#FFFFFF',
  text: '#0D0F0D',
  textSecondary: '#3A403A',
  textMuted: '#585F58',
  border: '#D5D9D1',
  borderStrong: '#AEB5AA',
  accent: '#A8F32C',
  onAccent: '#090A09',
  accentText: '#3F6B00',
  accentSubtle: '#EAF7CF',
  accentBorder: '#8DB84A',
  inverse: '#0D0F0D',
  onInverse: '#F5F6F2',
  error: '#B3261E',
  success: '#1E7A46',
  warning: '#8A5A00',
  info: '#1F5FBF',
  navBackground: '#FFFFFF',
  overlay: 'rgba(13,15,13,0.45)',
};

export function tokensFor(scheme: ThemeScheme): ThemeTokens {
  return scheme === 'light' ? LIGHT_TOKENS : DARK_TOKENS;
}

/** The mode the member picked + what the OS reports -> the scheme to render. Anything unknown falls back to dark. */
export function resolveScheme(mode: AppearanceMode, system: string | null | undefined): ThemeScheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark') return 'dark';
  return system === 'light' ? 'light' : 'dark';
}

/** Temporary default while legacy screens are migrated; flip to 'system' once coverage is good enough. */
export const DEFAULT_APPEARANCE: AppearanceMode = 'dark';

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
/** WCAG 2.x contrast ratio between two #RRGGBB colors. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
