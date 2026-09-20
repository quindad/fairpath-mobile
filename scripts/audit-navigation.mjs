import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('src/app');
function walk(d){return fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]).filter(f=>/\.(tsx|ts)$/.test(f)&&!f.endsWith('_layout.tsx'))}
const files=walk(root);const routes=new Set(files.map(f=>{let r='/'+path.relative(root,f).replace(/\\/g,'/').replace(/\.(tsx|ts)$/,'');return r==='/index'?'/':r}));
const refs=[];const re=/(?:router\.(?:push|replace)|backTo=)\s*\(?\s*["']([^"']+)["']/g;
for(const f of files){const src=fs.readFileSync(f,'utf8');let m;while((m=re.exec(src))){const raw=m[1];if(!raw.startsWith('/')||raw.includes('+'))continue;const clean=raw.split('?')[0];const ok=routes.has(clean)||[...routes].some(r=>r.includes('[')&&new RegExp('^'+r.replace(/\[[^\\/]+\]/g,'[^/]+')+'$').test(clean));if(!ok)refs.push(path.relative(process.cwd(),f)+': '+raw)}}
if(refs.length){console.error('Broken static route references:\n'+refs.join('\n'));process.exit(1)}console.log('Navigation audit passed: '+files.length+' route files checked.');
