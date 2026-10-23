// Screens must scroll inside ScreenFrame's flex body slot (tab bar is a sibling).
import fs from 'node:fs';
import path from 'node:path';

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );
const appFiles = walk('src/app').filter((f) => f.endsWith('.tsx'));
const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const chrome = read('src/components/ProductChrome.tsx');
if (!/bodySlot/.test(chrome) || !/minHeight:\s*0/.test(chrome)) {
  console.error('ProductChrome must wrap ScreenFrame children in flex:1 minHeight:0 bodySlot.');
  process.exit(1);
}
if (!/export function ScreenScroll/.test(chrome)) {
  console.error('ProductChrome must export ScreenScroll.');
  process.exit(1);
}

const flexScroll =
  /ScreenScroll\b|style=\{s\.scroll\}|style=\{\{\s*flex:\s*1\s*\}\}|style=\{s\.listFlex\}|ScreenColumn[\s\S]{0,400}FormScrollView[\s\S]{0,80}flex:\s*1/;

const failures = [];
for (const f of appFiles) {
  const rel = f.replace(/\\/g, '/');
  const src = read(f);
  if (!/ScreenFrame/.test(src)) continue;
  if (!flexScroll.test(src)) failures.push(rel);
}

if (failures.length) {
  console.error(`Scroll audit: ${failures.length} screen(s) missing flex scroll:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`Scroll audit passed: ${appFiles.length} app routes checked.`);
