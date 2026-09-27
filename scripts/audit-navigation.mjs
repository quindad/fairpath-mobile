import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('src/app');
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]).filter(f=>/\.(tsx|ts)$/.test(f)&&!f.endsWith('_layout.tsx'))}
const files=walk(root);const routes=new Set(files.map(f=>{let r='/'+path.relative(root,f).replace(/\\/g,'/').replace(/\.(tsx|ts)$/,'');r=r.replace(/\/index$/,'');return r===''||r==='/index'?'/':r}));
const refs=[];const re=/(?:router\.(?:push|replace)|backTo=)\s*\(?\s*["']([^"']+)["']/g;
for(const f of files){const src=fs.readFileSync(f,'utf8');let m;while((m=re.exec(src))){const raw=m[1];if(!raw.startsWith('/')||raw.includes('+'))continue;const clean=raw.split('?')[0];const ok=routes.has(clean)||[...routes].some(r=>r.includes('[')&&new RegExp('^'+r.replace(/\[[^\\/]+\]/g,'[^/]+')+'$').test(clean));if(!ok)refs.push(path.relative(process.cwd(),f)+': '+raw)}}
if(refs.length){console.error('Broken static route references:\n'+refs.join('\n'));process.exit(1)}
const doubleNav=files.filter(f=>{const src=fs.readFileSync(f,'utf8');return /<ScreenFrame(?![^>]*showNav=\{false\})/.test(src)&&/<BottomNav\s*\/>/.test(src)}).map(f=>path.relative(process.cwd(),f));
if(doubleNav.length){console.error('Screens render <BottomNav/> inside <ScreenFrame> (ScreenFrame already renders it -> two navs):\n'+doubleNav.join('\n'));process.exit(1)}

// ---- Single global bottom nav -------------------------------------------------------------------
// ScreenFrame (src/components/ProductChrome.tsx) is the ONLY place the nav may be mounted.
const failures=[];
const chrome=fs.readFileSync('src/components/ProductChrome.tsx','utf8').replace(/\r\n/g,'\n');
if(!/const NavProvided=createContext/.test(chrome)||!/useContext\(NavProvided\)/.test(chrome))failures.push('ProductChrome must keep the NavProvided guard so a nested <BottomNav/> renders nothing.');
if((chrome.match(/<BottomNavBar\/>/g)||[]).length!==2)failures.push('ProductChrome must mount <BottomNavBar/> in exactly two places: ScreenFrame and the guarded BottomNav export.');
const usesNav=files.filter(f=>/<BottomNav\b/.test(fs.readFileSync(f,'utf8'))).map(f=>path.relative(process.cwd(),f));
if(usesNav.length)failures.push('Screens must not render <BottomNav/> themselves (ScreenFrame does): '+usesNav.join(', '));
const otherFrames=files.filter(f=>{const src=fs.readFileSync(f,'utf8');return /<ScreenFrame/.test(src)&&/SafeAreaView/.test(src)}).map(f=>path.relative(process.cwd(),f));
if(otherFrames.length)failures.push('Screens using ScreenFrame must not add their own SafeAreaView frame: '+otherFrames.join(', '));
// Pinned bars: a full-width position:absolute bottom:0 bar inside ScreenFrame lands BEHIND the nav.
const pinned=files.filter(f=>{const src=fs.readFileSync(f,'utf8');return /<ScreenFrame/.test(src)&&/\{[^{}]*position:\s*'absolute'[^{}]*left:\s*0[^{}]*right:\s*0[^{}]*bottom:\s*0[^{}]*\}|\{[^{}]*position:\s*'absolute'[^{}]*bottom:\s*0[^{}]*left:\s*0[^{}]*right:\s*0[^{}]*\}/.test(src)}).map(f=>path.relative(process.cwd(),f));
if(pinned.length)failures.push('Full-width position:absolute bottom:0 bars sit behind the global nav; keep CTAs in normal flow above it: '+pinned.join(', '));
// A literal space between two JSX elements on ONE line is a text node. Inside a <View> that throws
// "Unexpected text node" (web) / "Text strings must be rendered within a <Text>" (native). Put the next element on its own line.
const strayText=[];
for(const f of walk('src').filter(x=>/\.tsx$/.test(x))){const src=fs.readFileSync(f,'utf8');src.split(/\r?\n/).forEach((line,i)=>{if(/(<\/[A-Za-z.]+>|\/>) +\{[^{}]*(\?|&&)\s*</.test(line))strayText.push(path.relative(process.cwd(),f)+':'+(i+1))})}
if(strayText.length)failures.push('Stray space between JSX elements (creates a text node inside a View); move the second element to its own line: '+strayText.join(', '));
if(failures.length){console.error('Navigation audit failed:\n- '+failures.join('\n- '));process.exit(1)}
console.log('Navigation audit passed: '+files.length+' route files checked.');
