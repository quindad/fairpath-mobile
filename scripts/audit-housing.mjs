import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const required=[
 'src/app/find-housing.tsx',
 'src/app/housing/[id].tsx',
 'src/app/housing-filters.tsx',
 'src/app/saved-homes.tsx',
 'src/app/saved-housing-searches.tsx',
 'src/app/housing-applications.tsx',
 'src/app/housing-application/[id].tsx',
 'src/app/housing-apply/[id].tsx',
 'src/app/housing-activity.tsx',
 'src/app/housing-tour/[id].tsx',
 'src/app/housing-inquiry/[id].tsx',
 'src/app/housing-report/[id].tsx',
 'src/app/fasttrack-checkout/[id].tsx',
 'src/components/HousingMap.native.tsx',
 'src/components/HousingApplicationDocuments.tsx',
 'src/core/opportunities/opportunity-service.ts',
 'docs/FAIRPATH_HOUSING_CLOSEOUT.md'
];

const failures=[];
for(const file of required)if(!fs.existsSync(path.join(root,file)))failures.push('Missing required Housing file: '+file);

function read(file){return fs.readFileSync(path.join(root,file),'utf8')}
for(const file of required.filter(x=>/\.tsx?$/.test(x))){
 if(!fs.existsSync(path.join(root,file)))continue;
 const src=read(file);
 if(/<<<<<<<|=======|>>>>>>>/.test(src))failures.push(file+' contains merge-conflict markers.');
 const styleCount=(src.match(/const s=StyleSheet\.create/g)||[]).length;
 if(file.endsWith('.tsx')&&styleCount>1)failures.push(file+' contains '+styleCount+' StyleSheet blocks; likely duplicated/corrupted code.');
}
const service=read('src/core/opportunities/opportunity-service.ts');
const detail=read('src/app/housing/[id].tsx');
const browse=read('src/app/find-housing.tsx');
const saved=read('src/app/saved-homes.tsx');
const apply=read('src/app/housing-apply/[id].tsx');
const workflow=read('.github/workflows/app-checks.yml');
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));

for(const name of ['createHousingInquiry','createHousingTourRequest','createHousingReport','submitHousingApplication']){
 const count=(service.match(new RegExp('export async function '+name+'\\b','g'))||[]).length;
 if(count!==1)failures.push(name+' must exist exactly once; found '+count);
}
if(!service.includes("supabase.rpc('submit_housing_application'"))failures.push('Housing submit must use transactional submit_housing_application RPC.');
if(!service.includes("from('housing_application_documents')"))failures.push('Housing documents service is missing.');
if(!service.includes("from('user_notifications')"))failures.push('Live notification service is missing.');
if(!apply.includes('HousingApplicationDocuments'))failures.push('Application review does not expose document manager.');
if(!apply.includes('loadFastTrackQuote'))failures.push('FastTrack pricing contract is not surfaced in application review.');

for(const [name,src] of [['find-housing',browse],['housing-detail',detail],['saved-homes',saved]]){
 if(src.includes('@/core/demo/demo-media')||src.includes('DEMO GALLERY'))failures.push(name+' still contains demo-media fallback.');
}
if(!detail.includes('NO PROPERTY PHOTOS'))failures.push('Housing detail must have an honest no-photo state.');
if(!browse.includes("viewMode==='map'"))failures.push('Housing browse list/map toggle missing.');
if(!pkg.dependencies?.['expo-document-picker'])failures.push('expo-document-picker dependency missing.');
if(lock.packages?.['']?.dependencies?.['expo-document-picker']!==pkg.dependencies?.['expo-document-picker'])failures.push('package-lock is not synced for expo-document-picker.');
if(!pkg.dependencies?.['react-native-maps'])failures.push('react-native-maps dependency missing.');
if(/\bpush\s*:|pull_request\s*:/.test(workflow))failures.push('App checks must remain manual-only until the suite is intentionally re-enabled.');
if(!workflow.includes('workflow_dispatch'))failures.push('Manual workflow dispatch is missing.');

if(failures.length){
 console.error('Housing audit failed:\n- '+failures.join('\n- '));
 process.exit(1);
}
console.log('Housing audit passed: '+required.length+' critical files + service invariants checked.');
