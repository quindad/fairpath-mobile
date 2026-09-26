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
 'src/core/housing/housing-service.ts',
 'src/core/notifications/notifications-service.ts',
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
// Housing's real implementation lives in core/housing/housing-service.ts
// (split out of the old opportunity-service.ts god-file during Step 0
// Foundation; opportunity-service.ts is now a re-export barrel kept for
// backward-compatible imports). Notifications moved to their own module too.
const service=read('src/core/housing/housing-service.ts');
const notifications=read('src/core/notifications/notifications-service.ts');
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
if(!notifications.includes("from('user_notifications')"))failures.push('Live notification service is missing.');
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

// ---- Housing search / filters / map production pass ----
const mig=read('supabase/migrations/20260927120000_housing_search.sql').replace(/--.*$/gm,'');
const searchFn=(mig.match(/create or replace function public\.search_housing\([\s\S]*?\n\$\$;/)||[''])[0];
if(!searchFn)failures.push('search_housing is not defined.');
if(!/security invoker/.test(searchFn))failures.push('search_housing must be SECURITY INVOKER so housing RLS still applies.');
if(!/least\(greatest\(coalesce\(p_limit/.test(searchFn)||!/count\(\*\) over \(\)/.test(searchFn))failures.push('search_housing must clamp page size and return total counts.');
if(!/grant execute on function public\.search_housing[\s\S]*?to anon, authenticated/.test(mig))failures.push('search_housing must be executable by anon (guest browsing).');
if(/owner_id/.test(searchFn))failures.push('search_housing must not return owner_id.');
if(/walk_score|transit_score|bike_score/.test(searchFn))failures.push('search_housing must not filter on provider-less neighborhood scores.');
const FILTER_KEYS=['minRent','maxRent','beds','baths','types','fastTrack','pets','accessible','garage','parking','furnished','basement','yard','balcony','laundry','centralAir','moveInReady','minSqft'];
for(const k of FILTER_KEYS)if(!searchFn.includes("'"+k+"'"))failures.push('Filter "'+k+'" is offered in the UI but not applied by search_housing.');
const findSrc=browse;
if(!/searchHousing\(/.test(findSrc)||!/onEndReached/.test(findSrc)||!/FlatList/.test(findSrc))failures.push('find-housing must page through searchHousing with an infinite FlatList.');
if(/loadHousing\(/.test(findSrc)||/rows\.filter|\.limit\(100\)/.test(findSrc+service))failures.push('Housing must not load a capped list and filter it on the phone.');
if(/loadHousing\b/.test(service))failures.push('Legacy client-side loadHousing must be removed.');
if(/minWalk|walk_score|WALK SCORE/i.test(findSrc)||/minWalk/.test(read('src/app/housing-filters.tsx')))failures.push('A Walk Score filter is shown but no provider populates scores.');
if(!/<Modal visible=\{filtersOpen\}/.test(findSrc)||!/openFilters/.test(findSrc))failures.push('find-housing needs an in-screen FILTERS sheet.');
if(!/RADIUS_CHOICES=\[10,25,50,100\]/.test(findSrc))failures.push('Housing radius choices 10/25/50/100 are missing.');
if(!/loadLocationSettings\(\)[\s\S]*?setWhere\(next\)/.test(findSrc)||!/setRadius\(s\.search_radius_miles\)/.test(findSrc))failures.push('Housing WHERE/radius must prefill from the saved location.');
if(!/whereTouched\.current=true/.test(findSrc)||!/if\(!whereTouched\.current\)/.test(findSrc))failures.push('A location the member typed must never be overwritten.');
if(!/USE MY SAVED ZIP/.test(findSrc))failures.push('Housing needs a way back to the saved ZIP.');
if(/mapBtn/.test(findSrc)||(findSrc.match(/accessibilityLabel="Map view"/g)||[]).length!==1)failures.push('Housing must have exactly one MAP control (the LIST/MAP toggle).');
if(!/if\(viewMode==='map'\)return/.test(findSrc)||!/<HousingMap /.test(findSrc))failures.push('Housing map mode must render the full-height map.');
const nativeMap=read('src/components/HousingMap.native.tsx');
if(!/onPress=\{e=>\{e\.stopPropagation/.test(nativeMap)||!/HousingMapCard/.test(nativeMap)||!/fitToCoordinates/.test(nativeMap)||!/onOpen=\{onOpen\}/.test(nativeMap))failures.push('Native housing map needs selectable pins, a preview card, fit-to-pins and an open action.');
if(!/onOpen=\{onOpen\}/.test(read('src/components/HousingMap.web.tsx')))failures.push('Web housing map must open the selected home.');
if(!/nonce/.test(findSrc)||/setHomes\(\[\]\)/.test(findSrc))failures.push('LIST/MAP switching must keep search state and results.');
{
 const { EMPTY_HOUSING_FILTERS, countHousingFilters, housingFiltersFromRecord } = await import('../src/core/housing/housing-filters.ts');
 const { normalizePlace } = await import('../src/core/jobs/location-utils.ts');
 const some=housingFiltersFromRecord({minRent:'1,200',beds:'2+',types:'house,condo',fastTrack:'1',garage:true,pets:false});
 if(countHousingFilters(EMPTY_HOUSING_FILTERS)!==0)failures.push('Empty housing filters must count as 0.');
 if(countHousingFilters(some)!==5||some.minRent!=='1200'||some.types.join()!=='house,condo'||!some.fastTrack||!some.garage||some.pets)failures.push('housingFiltersFromRecord/countHousingFilters misbehave.');
 if(normalizePlace('columbus, ohio')!=='columbus, OH'||normalizePlace('Ohio')!=='OH'||normalizePlace('West Virginia')!=='WV'||normalizePlace('Kansas City')!=='Kansas City'||normalizePlace('New York')!=='New York'||normalizePlace('Cleveland OH')!=='Cleveland, OH')failures.push('normalizePlace state-name handling is wrong.');
}

if(failures.length){
 console.error('Housing audit failed:\n- '+failures.join('\n- '));
 process.exit(1);
}
console.log('Housing audit passed: '+required.length+' critical files + service invariants checked.');
