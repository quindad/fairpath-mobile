// Theme audit: semantic tokens, WCAG contrast in both modes, and the progressive-migration contract.
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const tk = await import('../src/core/theme/tokens.ts');
const routes = await import('../src/core/theme/themed-routes.ts');

// ---- both palettes define exactly the same token keys ----
const darkKeys = Object.keys(tk.DARK_TOKENS).sort().join();
const lightKeys = Object.keys(tk.LIGHT_TOKENS).sort().join();
check(darkKeys === lightKeys, 'Dark and light palettes must define identical token keys.');
check(tk.DARK_TOKENS.accent.toUpperCase() === '#A8F32C' && tk.LIGHT_TOKENS.accent.toUpperCase() === '#A8F32C', 'FairPath lime #A8F32C must remain the accent fill in both modes.');

// ---- contrast (WCAG AA 4.5:1 for text pairs) ----
const pairs = [
  ['text', 'background'], ['text', 'surface'], ['text', 'surfaceRaised'],
  ['textSecondary', 'background'], ['textSecondary', 'surface'],
  ['textMuted', 'background'], ['textMuted', 'surface'],
  ['accentText', 'background'], ['accentText', 'surface'], ['accentText', 'accentSubtle'],
  ['onAccent', 'accent'], ['onInverse', 'inverse'],
  ['error', 'background'], ['error', 'surface'],
  ['success', 'background'], ['success', 'surface'],
  ['warning', 'background'], ['warning', 'surface'],
  ['info', 'background'], ['info', 'surface'],
  ['text', 'navBackground'], ['textSecondary', 'navBackground'],
];
for (const palette of [tk.DARK_TOKENS, tk.LIGHT_TOKENS]) {
  for (const [fg, bg] of pairs) {
    const ratio = tk.contrastRatio(palette[fg], palette[bg]);
    check(ratio >= 4.5, `${palette.scheme}: ${fg} on ${bg} contrast ${ratio.toFixed(2)} is below 4.5.`);
  }
}

// ---- resolution rules ----
check(tk.resolveScheme('dark', 'light') === 'dark', 'Explicit dark must ignore the OS scheme.');
check(tk.resolveScheme('light', 'dark') === 'light', 'Explicit light must ignore the OS scheme.');
check(tk.resolveScheme('system', 'light') === 'light' && tk.resolveScheme('system', 'dark') === 'dark', 'System must follow the OS.');
check(tk.resolveScheme('system', null) === 'dark' && tk.resolveScheme('system', undefined) === 'dark', 'Unknown OS scheme must fall back to dark.');
check(tk.DEFAULT_APPEARANCE === 'dark', 'Default appearance stays dark until enough legacy screens are migrated.');
check(tk.isAppearanceMode('system') && !tk.isAppearanceMode('auto') && !tk.isAppearanceMode(null), 'Stored appearance values must be validated.');

// ---- progressive migration contract ----
check(routes.isThemedRoute('/appearance') && !routes.isThemedRoute('/find-jobs'), 'Only listed routes are themed; legacy routes are forced dark.');
check(!routes.isThemedRoute('/appearance-legacy'), 'Route matching must not use loose prefixes.');

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk('src').filter((f) => /\.tsx?$/.test(f)).map((f) => f.replace(/\\/g, '/'));

// Themed screens must not use the legacy palette or raw hex colors.
// A themed route is either src/app/<route>.tsx or every screen inside the src/app/<route>/ folder.
const routeToFiles = (route) => {
  const base = 'src/app' + route;
  const found = [];
  if (fs.existsSync(base + '.tsx')) found.push(base + '.tsx');
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) found.push(...walk(base).filter((f) => /\.tsx$/.test(f)).map((f) => f.replace(/\\/g, '/')));
  return found;
};
for (const route of routes.THEMED_ROUTES) {
  const themedFiles = routeToFiles(route);
  check(themedFiles.length > 0, `Themed route ${route} has no screen file.`);
  for (const file of themedFiles) {
    const src = read(file);
    check(!/FairPathColors/.test(src), `${file}: themed screens must not use FairPathColors.`);
    check(!/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/.test(src), `${file}: themed screens must not hardcode hex colors.`);
  }
}
// Shared components used by themed screens must be token-only too.
for (const file of ['src/components/ResourceCard.tsx']) {
  const src = read(file);
  check(!/FairPathColors/.test(src) && !/#[0-9a-fA-F]{6}\b/.test(src), `${file}: must use tokens only.`);
}

// Shared chrome must be token-driven and legacy-safe.
const chrome = read('src/components/ProductChrome.tsx');
check(!/FairPathColors/.test(chrome) && !/#[0-9a-fA-F]{6}\b/.test(chrome), 'ProductChrome must use tokens only.');
check(/ForcedDarkScope/.test(chrome) && /isThemedRoute/.test(chrome), 'ScreenFrame must force legacy routes to dark.');

// Provider wiring
const layout = read('src/app/_layout.tsx');
check(/<ThemeProvider>/.test(layout) && /tokens\.background/.test(layout), 'Root layout must mount ThemeProvider and use a token background.');
const provider = read('src/core/theme/ThemeProvider.tsx');
check(/AsyncStorage/.test(provider) && /isAppearanceMode/.test(provider), 'Appearance choice must persist and be validated on read.');

// Regression: the Lucide icon set otherwise lazy-loads its own font via a dynamic loader that logs
// "Failed to load font Lucide" on web (@react-native-vector-icons/common's dynamic-font-loading.js). It must be
// preloaded up front, under its exact font-family key ("Lucide", the package's postScriptName), alongside every
// other app font, so that path is never exercised.
check(/Lucide:\s*require\('@react-native-vector-icons\/lucide\/fonts\/Lucide\.ttf'\)/.test(layout), 'Root layout must preload the Lucide icon font under the "Lucide" key so it never falls back to the dynamic loader that logs "Failed to load font Lucide" on web.');

if (failures.length) {
  console.error('Theme audit FAILED:\n - ' + failures.join('\n - '));
  process.exit(1);
}
console.log('Theme audit passed.');
