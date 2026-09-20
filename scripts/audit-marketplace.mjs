import fs from 'node:fs';import path from 'node:path';
const root=process.cwd();
const required=[
 'src/app/marketplace.tsx','src/app/market-item/[id].tsx','src/app/marketplace-list-item.tsx','src/app/marketplace-claims.tsx',
 'src/app/marketplace-claim/[id].tsx','src/app/marketplace-my-listings.tsx','src/app/marketplace-manage/[id].tsx',
 'src/app/marketplace-edit/[id].tsx','src/app/marketplace-report/[id].tsx','src/app/saved-marketplace.tsx',
 'src/core/marketplace/marketplace-service.ts','docs/FAIRPATH_MARKETPLACE_BUILD_STATUS.md'
];
const failures=[];
for(const file of required)if(!fs.existsSync(path.join(root,file)))failures.push('Missing Marketplace file: '+file);
function read(file){return fs.readFileSync(path.join(root,file),'utf8')}
for(const file of required.filter(x=>/\.(ts|tsx)$/.test(x))){
 if(!fs.existsSync(path.join(root,file)))continue;
 const src=read(file);
 if(/<<<<<<<|=======|>>>>>>>/.test(src))failures.push(file+' contains merge-conflict markers.');
 const styles=(src.match(/const s=StyleSheet\.create/g)||[]).length;
 if(file.endsWith('.tsx')&&styles>1)failures.push(file+' contains '+styles+' StyleSheet blocks; likely duplicated/corrupted code.');
 if(src.includes('@/core/demo/demo-media')||src.includes('demoMarketplaceImage'))failures.push(file+' still uses demo Marketplace images.');
}
const service=read('src/core/marketplace/marketplace-service.ts');
for(const fn of ['requestMarketplaceClaim','loadMarketplaceQuota','approveMarketplaceClaim','verifyMarketplacePickup','createMarketplaceItem','uploadMarketplacePhoto']){
 if(!service.includes('function '+fn)&&!service.includes('function '+fn+'('))failures.push('Missing service function: '+fn);
}
const browse=read('src/app/marketplace.tsx');
const detail=read('src/app/market-item/[id].tsx');
const manage=read('src/app/marketplace-manage/[id].tsx');
if(!browse.includes('Free members get 1 claim/month')&&!browse.includes('Free members get 1 claim'))failures.push('Marketplace free claim limit copy missing.');
if(!browse.includes('FairPath+ gets 7'))failures.push('Marketplace FairPath+ claim limit copy missing.');
if(!detail.includes('48-HOUR PICKUP'))failures.push('48-hour pickup education missing.');
if(!detail.includes('ANONYMOUS SELECTION'))failures.push('Anonymous claim selection explanation missing.');
if(!manage.includes('ANONYMOUS CLAIM SELECTION'))failures.push('Donor anonymous selection UI missing.');
if(!service.includes("request_marketplace_claim"))failures.push('Claim request is not server-RPC backed.');
if(!service.includes("verify_marketplace_pickup"))failures.push('Pickup verification is not server-RPC backed.');
if(failures.length){console.error('Marketplace audit failed:\n- '+failures.join('\n- '));process.exit(1)}
console.log('Marketplace audit passed: '+required.length+' critical files + Marketplace invariants checked.');
