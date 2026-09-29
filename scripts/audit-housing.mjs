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
{
 const viewToggleLine=(findSrc.match(/onPress=\{\(\)=>setViewMode\('list'\)\}/)||[''])[0];
 if(!/nonce/.test(findSrc)||!viewToggleLine||/setHomes/.test(viewToggleLine))failures.push('LIST/MAP switching must keep search state and results.');
}
{
 const { EMPTY_HOUSING_FILTERS, countHousingFilters, housingFiltersFromRecord } = await import('../src/core/housing/housing-filters.ts');
 const { normalizePlace } = await import('../src/core/jobs/location-utils.ts');
 const some=housingFiltersFromRecord({minRent:'1,200',beds:'2+',types:'house,condo',fastTrack:'1',garage:true,pets:false});
 if(countHousingFilters(EMPTY_HOUSING_FILTERS)!==0)failures.push('Empty housing filters must count as 0.');
 if(countHousingFilters(some)!==5||some.minRent!=='1200'||some.types.join()!=='house,condo'||!some.fastTrack||!some.garage||some.pets)failures.push('housingFiltersFromRecord/countHousingFilters misbehave.');
 if(normalizePlace('columbus, ohio')!=='columbus, OH'||normalizePlace('Ohio')!=='OH'||normalizePlace('West Virginia')!=='WV'||normalizePlace('Kansas City')!=='Kansas City'||normalizePlace('New York')!=='New York'||normalizePlace('Cleveland OH')!=='Cleveland, OH')failures.push('normalizePlace state-name handling is wrong.');
}

// ---- Housing applications: server-controlled status, drafts, FastTrack, inquiries, history ----
{
 const sec=read('supabase/migrations/20260928120000_housing_applications_secure.sql').replace(/--.*$/gm,'');
 const fn=name=>(sec.match(new RegExp('create or replace function public\\.'+name+'\\([\\s\\S]*?\\n\\$\\$;'))||[''])[0];
 // direct write paths are closed
 if(!/drop policy if exists "Applicants update own housing applications"/.test(sec)||!/revoke insert, update on table public\.housing_applications from authenticated/.test(sec))failures.push('Applicants must not be able to UPDATE/INSERT housing_applications directly (self-approval).');
 if(!/drop policy if exists "Applicants create own housing application events"/.test(sec)||!/revoke insert, update, delete on table public\.housing_application_events from authenticated/.test(sec))failures.push('Applicants must not be able to forge application events.');
 if(!/drop policy if exists "Users create own FastTrack orders"/.test(sec)||!/revoke insert, update, delete on table public\.housing_fasttrack_orders from authenticated/.test(sec))failures.push('Members must not be able to create/alter FastTrack orders (fake payment).');
 if(!/drop policy if exists "Renters create own housing inquiries"/.test(sec)||!/revoke insert, update, delete on table public\.housing_inquiries from authenticated/.test(sec))failures.push('Inquiries must be created through send_housing_inquiry only.');
 if(!/status = 'uploaded'/.test(sec)||!/revoke update on table public\.housing_application_documents from authenticated/.test(sec))failures.push('Document rows must be insert-only and forced to status uploaded.');
 // server functions
 for(const name of ['save_housing_application_draft','submit_housing_application','withdraw_housing_application','quote_housing_fasttrack','send_housing_inquiry']){
  const body=fn(name);
  if(!body)failures.push(name+' is not defined in the secure housing migration.');
  else{
   if(!/security definer/.test(body)||!/set search_path = public/.test(body))failures.push(name+' must be SECURITY DEFINER with a fixed search_path.');
   if(!/auth\.uid\(\)/.test(body))failures.push(name+' must derive the user from auth.uid().');
   if(!new RegExp('revoke all on function public\\.'+name+'[\\s\\S]*?from public, anon').test(sec))failures.push(name+' must not be executable by anon.');
  }
 }
 if(!/step < 2/.test(fn('save_housing_application_draft'))||!/NO_MEANINGFUL_INPUT/.test(fn('save_housing_application_draft')))failures.push('A draft must not be created before meaningful input (step >= 2).');
 if(!/status <> 'started'/.test(fn('save_housing_application_draft'))||!/APPLICATION_NOT_EDITABLE/.test(fn('save_housing_application_draft')))failures.push('Only started drafts may be edited.');
 if(!/status = 'submitted'/.test(fn('submit_housing_application'))||!/a\.status = 'started'/.test(fn('submit_housing_application')))failures.push('submit must move started -> submitted only.');
 if(!/storage\.objects/.test(fn('submit_housing_application'))||!/REQUIRED_DOCUMENTS_MISSING/.test(fn('submit_housing_application')))failures.push('Required documents must exist as real uploaded files, not just rows.');
 if(!/PAYMENT_REQUIRED/.test(fn('submit_housing_application'))||!/fasttrack_payment_enforced/.test(fn('submit_housing_application')))failures.push('FastTrack payment enforcement must remain server-side.');
 if(/statuss*=s*'(approved|denied|reviewing|tour|submitted)'/.test(fn('withdraw_housing_application')+fn('save_housing_application_draft')+fn('send_housing_inquiry')+fn('quote_housing_fasttrack')))failures.push('Applicant-callable functions must never be able to set approved/denied/reviewing/tour.');
 if(!/in \('submitted', 'reviewing', 'tour'\)/.test(fn('withdraw_housing_application'))||!/CANNOT_WITHDRAW/.test(fn('withdraw_housing_application')))failures.push('withdraw must be limited to submitted/reviewing/tour.');
 if(/conviction|supervision|registration|offense/i.test(sec))failures.push('The housing application functions must not touch justice-history data.');
 if(!/interval '10 minutes'/.test(fn('send_housing_inquiry'))||!/RATE_LIMITED/.test(fn('send_housing_inquiry')))failures.push('Inquiries must be de-duplicated and rate limited server-side.');
 if(!/log_housing_application_started/.test(sec)||!/after insert on public\.housing_applications/.test(sec))failures.push('Application history needs a started event written by trigger.');

 // client: no direct writes, RPCs used
 const svc=read('src/core/housing/housing-service.ts');
 const allSrc=['src/core/housing/housing-service.ts','src/app/housing/[id].tsx','src/app/housing-apply/[id].tsx','src/app/housing-application/[id].tsx','src/app/housing-inquiry/[id].tsx','src/app/housing-applications.tsx'].map(read).join('\n');
 if(/from\('housing_applications'\)\s*\.(insert|update|upsert)/.test(allSrc))failures.push('The client must not insert/update housing_applications directly.');
 if(/from\('housing_inquiries'\)\s*\.insert|from\('housing_application_events'\)\s*\.insert|from\('housing_fasttrack_orders'\)\s*\.(insert|upsert|update)/.test(allSrc))failures.push('The client must not write inquiries, events or FastTrack orders directly.');
 if(/startHousingApplication/.test(allSrc))failures.push('Legacy startHousingApplication (created a draft on view) must stay removed.');
 for(const r of ["rpc('save_housing_application_draft'","rpc('submit_housing_application'","rpc('withdraw_housing_application'","rpc('quote_housing_fasttrack'","rpc('send_housing_inquiry'"])if(!svc.includes(r))failures.push('housing-service must call '+r);
 // opening a property / form must not create an application
 const detailSrc=read('src/app/housing/[id].tsx');
 if(!/housing-apply\/new\?listing=/.test(detailSrc))failures.push('Starting an application must open the form without writing (housing-apply/new).');
 if(/saveHousingApplicationDraft|submitHousingApplication/.test(detailSrc))failures.push('The property screen must never save or submit an application.');
 const applySrc=read('src/app/housing-apply/[id].tsx');
 if(!/isNew/.test(applySrc)||!/setAppId\(draft\.id\)/.test(applySrc))failures.push('The apply screen must create the draft only from SAVE & CONTINUE.');
 const loadEffect=applySrc.slice(applySrc.indexOf('useEffect(()=>{'),applySrc.indexOf('const errors=useMemo'));
 if(/saveHousingApplicationDraft|submitHousingApplication|loadFastTrackQuote\(id/.test(loadEffect))failures.push('Loading the apply screen must not write or quote.');
 if(!/submitLock/.test(applySrc)||!/REQUIRED_DOCUMENTS_MISSING/.test(applySrc))failures.push('Submit must be double-tap safe and surface missing documents.');
 if(!/optional\?'OPTIONAL':'REQUIRED'/.test(applySrc)||!/FairPathDatePicker/.test(applySrc)||!/formatUsPhone/.test(applySrc))failures.push('Required fields must be clearly marked, with date pickers and phone formatting.');
 if(!/appId&&listingId/.test(applySrc)&&!/router\.replace\(\('\/housing-application\/'\+appId\+'\?submitted=1'\)/.test(applySrc))failures.push('A successful submit must replace to the application workspace with a success state.');
 // FastTrack: honest about payment
 if(!/not collecting FastTrack payment/.test(applySrc)||!/PAYMENTS ARE NOT CONNECTED/.test(read('src/app/fasttrack-checkout/[id].tsx')))failures.push('FastTrack must state honestly that payment is not connected/collected.');
 if(/provider_payment_id|stripe|paymentIntent/i.test(allSrc))failures.push('Housing must not pretend to process payments.');
 // workspace
 const ws=read('src/app/housing-application/[id].tsx');
 if(!/WITHDRAW APPLICATION/.test(ws)||/WITHDRAW SUBMITTED|from workspace/i.test(ws)||!/Keep application/.test(ws))failures.push('Withdraw needs user-facing wording and a confirmation.');
 if(!/loadHousingApplicationEvents/.test(ws)||!/SUBMITTED INFORMATION/.test(ws)||!/HousingApplicationDocuments/.test(ws)||!/ALL MY APPLICATIONS/.test(ws))failures.push('Workspace must show history, submitted information, documents and a route to My Applications.');
 // sensitive data
 if(/user_convictions|convictions|supervision_records|registration_records|justice/i.test(svc))failures.push('housing-service must not read justice-history data.');
 if(!/\.in\('question_id',\['identity\.phone','identity\.date_of_birth','identity\.address','identity\.current_location','housing\.household_size'\]\)/.test(svc))failures.push('FastTrack prefill must read only the identity/household answers the form asks for.');
 if(!/mode!=='fasttrack'\)return/.test(svc))failures.push('Standard applications must not prefill from the profile.');
 // inquiry + saved
 const inq=read('src/app/housing-inquiry/[id].tsx');
 if(!/sending\.current/.test(inq)||!/setError\(/.test(inq)||!/not a chat|not a full messaging/i.test(inq))failures.push('Inquiry must be double-tap safe, show errors, and state it is one-shot (not messaging).');
 if(!/notify\('Could not remove saved home'/.test(saved))failures.push('Saved-home removal must surface failures.');
 if(!/saveHousingSearch/.test(browse)||!/housingFiltersFromRecord\(params\)/.test(browse)||!/deleteSavedHousingSearch/.test(read('src/app/saved-housing-searches.tsx')))failures.push('Saved searches must be saved, restored and removable.');
 if(!/ABOUT THIS HOME/.test(detailSrc)||!/NO PROPERTY PHOTOS/.test(detailSrc))failures.push('Property details must show the description and an honest no-photo state.');
 // fake data / overlap
 for(const f of ['src/app/housing/[id].tsx','src/app/housing-apply/[id].tsx','src/app/housing-application/[id].tsx','src/app/find-housing.tsx'])if(/DEMO_|demo-media|mockListings|sampleHomes/i.test(read(f)))failures.push(f+' contains fake fallback data.');
 for(const f of ['src/app/housing/[id].tsx','src/app/housing-apply/[id].tsx','src/app/housing-application/[id].tsx'])if(/position:\s*'absolute'[^}]*bottom:\s*0/.test(read(f)))failures.push(f+' has a bottom-pinned bar that would sit behind the global nav.');

 // Regression: same fix/finding as Jobs — a failed fresh search must clear homes/total/etc, never leave a prior
 // successful search's results rendered under a fresh error banner.
 const findHousing=read('src/app/find-housing.tsx');
 const runCatch=(findHousing.match(/async function run\(\)\{[\s\S]*?\n \}/)||[''])[0];
 if(!/catch\{[\s\S]*?setHomes\(\[\]\)[\s\S]*?setError\(/.test(runCatch))failures.push('a failed fresh housing search must clear homes/total/etc before setting the error, not leave stale results visible under it');
}

if(failures.length){
 console.error('Housing audit failed:\n- '+failures.join('\n- '));
 process.exit(1);
}
console.log('Housing audit passed: '+required.length+' critical files + service invariants checked.');
