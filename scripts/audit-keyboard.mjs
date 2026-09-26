// Keyboard/form audit: every screen with text inputs must inherit the shared iOS keyboard behavior
// (src/components/FormScrollView.tsx) and must not stack competing keyboard hacks.
import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk('src').filter((f) => /\.tsx?$/.test(f)).map((f) => f.replace(/\\/g, '/'));
const failures = [];

const shared = read('src/components/FormScrollView.tsx');
if (!/automaticallyAdjustKeyboardInsets:\s*true/.test(shared)) failures.push('FormScrollView must enable automaticallyAdjustKeyboardInsets (iOS native keyboard inset + scroll-to-focused-input).');
if (!/keyboardShouldPersistTaps:\s*'handled'/.test(shared)) failures.push("FormScrollView must use keyboardShouldPersistTaps 'handled' (buttons work; taps on empty space dismiss).");
if (!/keyboardDismissMode/.test(shared)) failures.push('FormScrollView must set a keyboardDismissMode.');

const withInputs = files.filter((f) => f.startsWith('src/app/') && /<TextInput\b/.test(read(f)));
const footerScreens = new Set(['src/app/complete-profile.tsx', 'src/app/onboarding.tsx']); // fixed footer outside the scroll view

for (const f of withInputs) {
  const src = read(f);
  if (/<ScrollView\b/.test(src)) failures.push(`${f}: use <FormScrollView> instead of <ScrollView> on screens with text inputs.`);
  if (/<FlatList\b/.test(src) && !/KEYBOARD_LIST_PROPS/.test(src)) failures.push(`${f}: FlatList with inputs must spread KEYBOARD_LIST_PROPS.`);
  if (!/FormScrollView/.test(src) && !/KEYBOARD_LIST_PROPS/.test(src)) failures.push(`${f}: screen with text inputs has no shared keyboard-aware scroll container.`);
  if (/position:\s*'absolute'[^}]*bottom:\s*0|bottom:\s*0[^}]*position:\s*'absolute'/.test(src.replace(/left:\s*0,\s*bottom:\s*0,\s*backgroundColor/g, '$&'))
      && /left:\s*0[^}]*right:\s*0|right:\s*0[^}]*left:\s*0/.test(src)) {
    const bars = src.match(/\{[^{}]*position:\s*'absolute'[^{}]*(left:\s*0[^{}]*right:\s*0|right:\s*0[^{}]*left:\s*0)[^{}]*bottom:\s*0[^{}]*\}/g);
    if (bars) failures.push(`${f}: a full-width bottom-pinned bar will be covered by the keyboard/nav; keep CTAs in normal flow.`);
  }
}

for (const f of files) {
  const src = read(f);
  if (f !== 'src/components/FormScrollView.tsx' && /KeyboardAvoidingView/.test(src)) failures.push(`${f}: use KeyboardFooterLayout from FormScrollView, not a bespoke KeyboardAvoidingView.`);
  if (f.startsWith('src/app/') && /Keyboard\.addListener|useKeyboard|keyboardHeight/.test(src)) failures.push(`${f}: no manual keyboard-height offsets; the shared FormScrollView handles insets.`);
  if (f.startsWith('src/app/') && /KeyboardFooterLayout/.test(src) && !footerScreens.has(f)) failures.push(`${f}: KeyboardFooterLayout is only for screens with a fixed footer outside the scroll view.`);
}
for (const f of footerScreens) {
  const src = read(f);
  if (!/KeyboardFooterLayout/.test(src) || !/FormScrollView/.test(src)) failures.push(`${f}: fixed-footer screen must wrap its content in KeyboardFooterLayout and use FormScrollView.`);
}

if (failures.length) {
  console.error('Keyboard audit failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log(`Keyboard audit passed: ${withInputs.length} screens with text inputs use the shared keyboard-aware containers; no stacked keyboard hacks.`);
