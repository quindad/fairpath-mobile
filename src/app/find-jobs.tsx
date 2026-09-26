import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { notify } from '@/core/ui/notify';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, SharpChip, InlineBadge } from '@/components/ProductChrome';
import { JobMap } from '@/components/JobMap';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { isZip, JOB_PAGE_SIZE, normalizePlace, loadSavedJobIds, resolveZipCenter, saveJob, searchJobs, unsaveJob, type Job } from '@/core/opportunities/opportunity-service';
import { DEFAULT_SEARCH_RADIUS_MILES, loadLocationSettings } from '@/core/profile/location-service';
import { supabase } from '@/lib/supabase';

type Lane='all'|'second';
type Employment='any'|'full_time'|'part_time';
type JobRow=Job&{distance_miles?:number|null};
const RADIUS_CHOICES=[10,25,50,100];

export default function FindJobs(){
 const params=useLocalSearchParams<{search?:string}>();
 const initialSearch=typeof params.search==='string'?params.search:'';
 // search state (survives LIST <-> MAP because both render from the same state)
 const [query,setQuery]=useState(initialSearch);
 const [where,setWhere]=useState('');
 const [radius,setRadius]=useState(DEFAULT_SEARCH_RADIUS_MILES);
 const [remote,setRemote]=useState(false);
 const [employment,setEmployment]=useState<Employment>('any');
 const [lane,setLane]=useState<Lane>('all');
 const [nonce,setNonce]=useState(0);
 // results
 const [jobs,setJobs]=useState<JobRow[]>([]);
 const [total,setTotal]=useState(0);
 const [secondCount,setSecondCount]=useState(0);
 const [hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true);
 const [loadingMore,setLoadingMore]=useState(false);
 const [error,setError]=useState('');
 const [zipUnplaced,setZipUnplaced]=useState(false);
 // ui
 const [viewMode,setViewMode]=useState<'list'|'map'>('list');
 const [controlsOpen,setControlsOpen]=useState(false);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [draft,setDraft]=useState({remote:false,employment:'any' as Employment,secondChance:false,radius:DEFAULT_SEARCH_RADIUS_MILES});
 const [savedJobs,setSavedJobs]=useState<Record<string,boolean>>({});
 const [savedZip,setSavedZip]=useState<string|null>(null);
 const [locationReady,setLocationReady]=useState(false);
 const whereTouched=useRef(false);
 const whereRef=useRef('');
 const requestId=useRef(0);
 whereRef.current=where;
 const zip=isZip(where)?where.trim():null;

 function criteria(offset:number){
  return {
   query,
   zip,
   radiusMiles:radius,
   location:normalizePlace(where),
   remote,
   employmentType:employment==='any'?null:employment,
   secondChance:lane==='second',
   limit:JOB_PAGE_SIZE,
   offset
  };
 }

 async function run(){
  const mine=++requestId.current;
  setLoading(true);
  setError('');
  try{
   const r=await searchJobs(criteria(0));
   if(mine!==requestId.current)return;
   setJobs(r.jobs);setTotal(r.total);setSecondCount(r.secondChanceCount);setHasMore(r.hasMore);
  }catch{
   if(mine!==requestId.current)return;
   setError('Jobs could not load. Check your connection and try again.');
  }finally{
   if(mine===requestId.current)setLoading(false);
  }
 }

 async function loadMore(){
  if(loading||loadingMore||!hasMore)return;
  const mine=requestId.current;
  setLoadingMore(true);
  try{
   const r=await searchJobs(criteria(jobs.length));
   if(mine!==requestId.current)return;
   setJobs(prev=>{const seen=new Set(prev.map(j=>j.id));return [...prev,...r.jobs.filter(j=>!seen.has(j.id))]});
   setHasMore(r.hasMore);
  }catch{
   if(mine===requestId.current)setError('More jobs could not load. Search again to retry.');
  }finally{
   setLoadingMore(false);
  }
 }

 // Saved ZIP + radius. Runs on every focus so returning from Location Setup picks up changes,
 // but never overwrites a WHERE value the member has typed themselves.
 useFocusEffect(useCallback(()=>{
  let active=true;
  loadLocationSettings()
   .then(s=>{
    if(!active)return;
    setSavedZip(s.zip_code);
    if(!whereTouched.current){
     const next=s.zip_code??'';
     if(next!==whereRef.current){setWhere(next);setNonce(n=>n+1)}
     setRadius(s.search_radius_miles);
    }
   })
   .catch(()=>{})
   .finally(()=>{if(active)setLocationReady(true)});
  loadSavedJobIds()
   .then(ids=>{if(active)setSavedJobs(Object.fromEntries(ids.map(id=>[id,true])))})
   .catch(()=>{});
  return()=>{active=false};
 },[]));

 // Every control re-runs the search through one path; typed text runs when the nonce is bumped (SEARCH / return key).
 useEffect(()=>{
  if(!locationReady)return;
  void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[locationReady,nonce,lane,remote,employment,radius]);

 useEffect(()=>{
  let active=true;
  setZipUnplaced(false);
  if(zip)resolveZipCenter(zip).then(c=>{if(active)setZipUnplaced(!c)}).catch(()=>{});
  return()=>{active=false};
 },[zip]);

 const shownCount=lane==='second'?secondCount:total;
 const activeFilterCount=(remote?1:0)+(employment!=='any'?1:0)+(lane==='second'?1:0)+(zip&&radius!==DEFAULT_SEARCH_RADIUS_MILES?1:0);

 function search(){setNonce(n=>n+1)}
 function changeWhere(v:string){whereTouched.current=true;setWhere(v)}
 function useSavedZip(){if(!savedZip)return;whereTouched.current=true;setWhere(savedZip);setNonce(n=>n+1)}
 function clearWhere(){whereTouched.current=true;setWhere('');setNonce(n=>n+1)}

 function openFilters(){
  setDraft({remote,employment,secondChance:lane==='second',radius});
  setFiltersOpen(true);
 }
 function applyFilters(){
  setRemote(draft.remote);
  setEmployment(draft.employment);
  setLane(draft.secondChance?'second':'all');
  setRadius(draft.radius);
  setFiltersOpen(false);
 }
 function resetDraft(){setDraft({remote:false,employment:'any',secondChance:false,radius:DEFAULT_SEARCH_RADIUS_MILES})}

 function openJob(j:Job){
  router.push(('/job/'+j.id) as never);
 }

 async function openAccountArea(route:string){
  const {data:{user}}=await supabase.auth.getUser();
  if(user){router.push(route as never);return}
  router.push(('/sign-up?returnTo='+encodeURIComponent(route)) as never);
 }

 function matchLabel(j:Job){
  return j.eligibility_rules?.second_chance_evidence==='explicit'
   ?'VERIFIED SECOND-CHANCE'
   :'POLICY REVIEW NEEDED';
 }

 async function handleSave(id:string){
  const currentlySaved=Boolean(savedJobs[id]);
  try{
   if(currentlySaved)await unsaveJob(id);
   else await saveJob(id);
   setSavedJobs(prev=>({...prev,[id]:!currentlySaved}));
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){
    notify('Sign in to save','Create an account or sign in to save jobs.',[
     {text:'Not now',style:'cancel'},
     {text:'Sign in',onPress:()=>router.push('/sign-in?returnTo=/find-jobs' as never)},
     {text:'Create account',onPress:()=>router.push('/sign-up?returnTo=/find-jobs' as never)}
    ]);
    return;
   }
   notify('Could not update saved job','Please try again.');
  }
 }

 const summary=[query.trim()||'All jobs',where.trim()||'Anywhere',zip?radius+' mi':''].filter(Boolean).join(' · ');

 const filtersButton=<Pressable accessibilityRole="button" accessibilityLabel="Open filters" style={s.filtersBtn} onPress={openFilters}>
  <Lucide name="sliders-horizontal" color={C.lime} size={14}/>
  <Text style={s.filtersBtnText}>FILTERS</Text>
  {activeFilterCount>0?<View style={s.filtersCount}><Text style={s.filtersCountText}>{activeFilterCount}</Text></View>:null}
 </Pressable>;

 const viewToggle=<View style={s.viewToggle}>
  <Pressable accessibilityRole="button" accessibilityLabel="List view" style={[s.viewButton,viewMode==='list'&&s.viewButtonActive]} onPress={()=>setViewMode('list')}>
   <Lucide name="list" color={viewMode==='list'?C.lime:C.mutedStrong} size={13}/>
   <Text style={[s.viewButtonText,viewMode==='list'&&s.viewButtonTextActive]}>LIST</Text>
  </Pressable>
  <Pressable accessibilityRole="button" accessibilityLabel="Map view" style={[s.viewButton,viewMode==='map'&&s.viewButtonActive]} onPress={()=>setViewMode('map')}>
   <Lucide name="map" color={viewMode==='map'?C.lime:C.mutedStrong} size={13}/>
   <Text style={[s.viewButtonText,viewMode==='map'&&s.viewButtonTextActive]}>MAP</Text>
  </Pressable>
 </View>;

 const searchControls=<View style={s.searchBlock}>
  <View style={s.searchRow}>
   <View style={s.fieldIcon}><Lucide name="briefcase-business" color={C.lime} size={15}/></View>
   <View style={s.fieldCopy}>
    <Text style={s.fieldLabel}>WHAT</Text>
    <TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search" style={s.input} placeholder="Job title, skill or company" placeholderTextColor={C.muted}/>
   </View>
  </View>

  <View style={s.searchRow}>
   <View style={s.fieldIcon}><Lucide name="map-pin" color={C.lime} size={15}/></View>
   <View style={s.fieldCopy}>
    <Text style={s.fieldLabel}>WHERE</Text>
    <TextInput value={where} onChangeText={changeWhere} onSubmitEditing={search} returnKeyType="search" autoCapitalize="words" autoCorrect={false} style={s.input} placeholder="ZIP code, city, or city and state" placeholderTextColor={C.muted}/>
   </View>
   {where?<Pressable accessibilityRole="button" accessibilityLabel="Clear location" hitSlop={8} style={s.clearBtn} onPress={clearWhere}><Lucide name="x" color={C.mutedStrong} size={14}/></Pressable>:null}
  </View>

  {savedZip&&where.trim()!==savedZip?<Pressable style={s.useSaved} onPress={useSavedZip}>
   <Lucide name="crosshair" color={C.lime} size={12}/><Text style={s.useSavedText}>USE MY SAVED ZIP · {savedZip}</Text>
  </Pressable>:null}

  {zip?<View style={s.radiusRow}>
   <Text style={s.radiusLabel}>WITHIN</Text>
   {RADIUS_CHOICES.map(r=><View key={r} style={s.radiusCell}><SharpChip label={r+' mi'} active={radius===r} onPress={()=>setRadius(r)}/></View>)}
  </View>:null}
  {zip&&zipUnplaced?<Text style={s.zipNote}>We can't place ZIP {zip} on the map yet, so you'll see jobs in that exact ZIP plus remote work.</Text>:null}

  <View style={s.actionRow}>
   {filtersButton}
   <Pressable accessibilityRole="button" style={s.primary} onPress={search}>
    <Text style={s.primaryText}>SEARCH JOBS</Text>
    <Lucide name="arrow-right" color={C.black} size={16}/>
   </Pressable>
  </View>
 </View>;

 const quickChips=<View style={s.filtersStrip}>
  <View style={s.filterCell}><SharpChip label="Remote" active={remote} onPress={()=>setRemote(!remote)}/></View>
  <View style={s.filterCell}><SharpChip label="Full-time" active={employment==='full_time'} onPress={()=>setEmployment(employment==='full_time'?'any':'full_time')}/></View>
  <View style={s.filterCell}><SharpChip label="Part-time" active={employment==='part_time'} onPress={()=>setEmployment(employment==='part_time'?'any':'part_time')}/></View>
 </View>;

 const lanes=<View style={s.lanes}>
  <Pressable style={[s.lane,lane==='all'&&s.laneActive]} onPress={()=>setLane('all')}>
   <Text style={[s.laneText,lane==='all'&&s.laneTextActive]}>ALL JOBS</Text>
   <Text style={[s.laneCount,lane==='all'&&s.laneCountActive]}>{total}</Text>
  </Pressable>
  <Pressable style={[s.lane,lane==='second'&&s.laneActive]} onPress={()=>setLane('second')}>
   <Text style={[s.laneText,lane==='second'&&s.laneTextActive]}>SECOND CHANCE</Text>
   <Text style={[s.laneCount,lane==='second'&&s.laneCountActive]}>{secondCount}</Text>
  </Pressable>
 </View>;

 const resultsLabel=loading?'SEARCHING':String(shownCount)+(shownCount===1?' RESULT':' RESULTS')+(zip?' · WITHIN '+radius+' MI':'');

 function renderJob(j:JobRow){
  const saved=Boolean(savedJobs[j.id]);
  return <Pressable key={j.id} style={s.card} onPress={()=>openJob(j)}>
   <View style={s.cardTop}>
    <View style={s.companyMark}><Text style={s.companyMarkText}>{j.company_name.slice(0,1).toUpperCase()}</Text></View>
    <View style={s.cardTopCopy}>
     <Text style={s.jobTitle}>{j.title}</Text>
     <Text style={s.company}>{j.company_name}</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={saved?'Remove saved job':'Save job'} style={[s.saveBtn,saved&&s.saveBtnActive]} onPress={(e)=>{e.stopPropagation?.();void handleSave(j.id)}}>
     <Lucide name={saved?'bookmark-check':'bookmark'} color={saved?C.black:C.mutedStrong} size={15}/>
    </Pressable>
   </View>

   <View style={s.metaRow}>
    <Lucide name="map-pin" color={C.muted} size={13}/>
    <Text style={s.meta}>{j.location_text||[j.city,j.state].filter(Boolean).join(', ')||'Location not listed'}</Text>
    <View style={s.metaDot}/>
    <Text style={s.meta}>{j.workplace_type.replace('_',' ')}</Text>
    {j.distance_miles!=null?<><View style={s.metaDot}/><Text style={s.meta}>{j.distance_miles<10?j.distance_miles.toFixed(1):Math.round(j.distance_miles)} mi</Text></>:null}
   </View>

   {j.pay_min!=null?<Text style={s.pay}>
    {'$'+Number(j.pay_min).toLocaleString()+(j.pay_max?' – $'+Number(j.pay_max).toLocaleString():'')+' / '+(j.pay_period||'period')}
   </Text>:null}

   <View style={s.badgeRow}>
    <InlineBadge tone={j.eligibility_rules?.second_chance_evidence==='explicit'?'lime':'default'}>{matchLabel(j)}</InlineBadge>
    {j.easy_apply_enabled?<InlineBadge tone="lime">EASY APPLY</InlineBadge>:null}
    <InlineBadge>{j.employment_type.replace('_',' ').toUpperCase()}</InlineBadge>
   </View>

   <Text style={s.desc} numberOfLines={2}>{j.description}</Text>

   <View style={s.cardFooter}>
    <View>
     <Text style={s.sourceLabel}>SOURCE</Text>
     <Text style={s.source}>{j.source_label||'FairPath'}</Text>
    </View>
    <View style={s.viewAction}>
     <Text style={s.viewText}>VIEW JOB</Text>
     <Lucide name="arrow-right" color={C.lime} size={14}/>
    </View>
   </View>
  </Pressable>;
 }

 const statusBlock=<>
  {error?<Text style={s.error}>{error}</Text>:null}
  {!loading&&jobs.length===0&&!error?<View style={s.empty}>
   <Text style={s.emptyTitle}>No jobs match these filters.</Text>
   <Text style={s.emptyBody}>{zip?'Try a larger radius, remove a filter, or switch back to All Jobs.':'Try a wider location, remove a filter, or switch back to All Jobs.'}</Text>
  </View>:null}
 </>;

 const filtersModal=<Modal visible={filtersOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setFiltersOpen(false)}>
  <View style={s.modal}>
   <View style={s.modalHead}>
    <View><Text style={s.modalEyebrow}>FAIRPATH JOBS</Text><Text style={s.modalTitle}>Filters</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Close filters" hitSlop={10} style={s.modalClose} onPress={()=>setFiltersOpen(false)}><Lucide name="x" color={C.white} size={16}/></Pressable>
   </View>
   <ScrollView contentContainerStyle={s.modalBody}>
    <Text style={s.groupLabel}>DISTANCE</Text>
    {zip?<View style={s.radiusRow}>{RADIUS_CHOICES.map(r=><View key={r} style={s.radiusCell}><SharpChip label={r+' mi'} active={draft.radius===r} onPress={()=>setDraft(d=>({...d,radius:r}))}/></View>)}</View>
     :<Text style={s.groupHint}>Enter a ZIP code in WHERE to search within a distance. Currently: {where.trim()?'searching "'+where.trim()+'"':'all locations'}.</Text>}

    <Text style={s.groupLabel}>JOB TYPE</Text>
    <View style={s.radiusRow}>
     {([['any','Any'],['full_time','Full-time'],['part_time','Part-time']] as [Employment,string][]).map(([v,label])=><View key={v} style={s.radiusCell}><SharpChip label={label} active={draft.employment===v} onPress={()=>setDraft(d=>({...d,employment:v}))}/></View>)}
    </View>

    <Text style={s.groupLabel}>WORK SETTING</Text>
    <View style={s.switchRow}>
     <View style={s.switchCopy}><Text style={s.switchTitle}>Remote only</Text><Text style={s.switchBody}>Show only jobs you can do from anywhere.</Text></View>
     <Switch value={draft.remote} onValueChange={v=>setDraft(d=>({...d,remote:v}))} trackColor={{false:C.borderStrong,true:'#526F2B'}} thumbColor={draft.remote?C.lime:C.mutedStrong}/>
    </View>

    <Text style={s.groupLabel}>SECOND CHANCE</Text>
    <View style={s.switchRow}>
     <View style={s.switchCopy}><Text style={s.switchTitle}>Verified second-chance only</Text><Text style={s.switchBody}>Employers with explicit fair-chance hiring evidence.</Text></View>
     <Switch value={draft.secondChance} onValueChange={v=>setDraft(d=>({...d,secondChance:v}))} trackColor={{false:C.borderStrong,true:'#526F2B'}} thumbColor={draft.secondChance?C.lime:C.mutedStrong}/>
    </View>
   </ScrollView>
   <View style={s.modalFooter}>
    <Pressable accessibilityRole="button" style={s.resetBtn} onPress={resetDraft}><Text style={s.resetText}>RESET</Text></Pressable>
    <Pressable accessibilityRole="button" style={[s.primary,s.applyBtn]} onPress={applyFilters}><Text style={s.primaryText}>APPLY FILTERS</Text><Lucide name="check" color={C.black} size={16}/></Pressable>
   </View>
  </View>
 </Modal>;

 if(viewMode==='map')return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH JOBS" title="Jobs map" backTo="/" alwaysBackTo/>
  <View style={s.mapBar}>
   <Pressable accessibilityRole="button" accessibilityLabel="Edit search" style={s.mapSummary} onPress={()=>setControlsOpen(o=>!o)}>
    <Lucide name="search" color={C.lime} size={13}/>
    <Text style={s.mapSummaryText} numberOfLines={1}>{summary}</Text>
    <Lucide name={controlsOpen?'chevron-up':'chevron-down'} color={C.mutedStrong} size={14}/>
   </Pressable>
   {viewToggle}
  </View>
  {controlsOpen?searchControls:<View style={s.mapActions}>{filtersButton}<Text style={s.mapCount}>{resultsLabel}</Text></View>}
  {error?<Text style={[s.error,s.mapError]}>{error}</Text>:null}
  <View style={s.mapArea}>
   {loading&&jobs.length===0?<View style={s.mapState}><Text style={s.mapStateText}>SEARCHING…</Text></View>
    :<JobMap jobs={jobs} onOpenJob={openJob} fill/>}
  </View>
  {hasMore?<Pressable accessibilityRole="button" style={s.mapMore} onPress={()=>void loadMore()}><Text style={s.moreText}>{loadingMore?'LOADING…':'SHOWING '+jobs.length+' · LOAD MORE JOBS'}</Text></Pressable>:null}
  {filtersModal}
 </ScreenFrame>;

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH JOBS" title="Find work" backTo="/" alwaysBackTo/>
  <FlatList
   data={jobs}
   keyExtractor={j=>j.id}
   renderItem={({item})=>renderJob(item)}
   contentContainerStyle={s.list}
   keyboardShouldPersistTaps="handled"
   showsVerticalScrollIndicator={false}
   onEndReached={()=>void loadMore()}
   onEndReachedThreshold={0.6}
   ListHeaderComponent={<View>
    <View style={s.utilityRow}>
     <Pressable style={s.utilityBtn} onPress={()=>router.push('/find-housing' as never)}><Lucide name="house" color={C.lime} size={13}/><Text style={s.utilityText}>HOUSING</Text></Pressable>
     <Pressable style={s.utilityBtn} onPress={()=>void openAccountArea('/saved-jobs')}><Lucide name="bookmark" color={C.lime} size={13}/><Text style={s.utilityText}>SAVED JOBS</Text></Pressable>
     <Pressable style={s.utilityBtn} onPress={()=>void openAccountArea('/job-applications')}><Lucide name="file-check-2" color={C.lime} size={13}/><Text style={s.utilityText}>MY APPLICATIONS</Text></Pressable>
    </View>
    {searchControls}
    {quickChips}
    {lanes}
    <View style={s.resultsTop}>
     <Text style={s.results}>{resultsLabel}</Text>
     {viewToggle}
    </View>
    {statusBlock}
   </View>}
   ListFooterComponent={<View style={s.footer}>
    {loadingMore?<Text style={s.footerText}>LOADING MORE JOBS…</Text>:null}
    {!loadingMore&&hasMore&&!loading?<Pressable accessibilityRole="button" style={s.moreBtn} onPress={()=>void loadMore()}><Text style={s.moreText}>LOAD MORE JOBS</Text></Pressable>:null}
    {!loading&&!hasMore&&jobs.length>0?<Text style={s.footerText}>END OF RESULTS</Text>:null}
   </View>}
  />
  {filtersModal}
 </ScreenFrame>;
}

const s=StyleSheet.create({
 utilityRow:{height:44,flexDirection:'row',borderBottomWidth:1,borderBottomColor:C.borderStrong,marginHorizontal:-L.mobileGutter},utilityBtn:{flex:1,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:C.borderStrong},utilityText:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 searchBlock:{paddingTop:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 searchRow:{minHeight:54,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',marginBottom:8},
 fieldIcon:{width:42,alignItems:'center',justifyContent:'center'},
 fieldCopy:{flex:1,minWidth:0,paddingVertical:8},
 fieldLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1.25,marginBottom:2},
 input:{color:C.white,fontFamily:F.medium,fontSize:14,paddingVertical:2,paddingHorizontal:0},
 clearBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},
 useSaved:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:10},useSavedText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},
 actionRow:{flexDirection:'row',gap:8,marginTop:2},
 filtersBtn:{height:44,paddingHorizontal:14,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0C100B'},
 filtersBtnText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 filtersCount:{minWidth:16,height:16,paddingHorizontal:4,backgroundColor:C.lime,alignItems:'center',justifyContent:'center'},filtersCountText:{color:C.black,fontFamily:F.extraBold,fontSize:9},
 primary:{flex:1,height:44,borderRadius:2,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:1},
 lanes:{flexDirection:'row',marginTop:2,borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong},
 lane:{flex:1,minHeight:52,paddingHorizontal:10,alignItems:'flex-start',justifyContent:'center',borderRightWidth:1,borderRightColor:C.borderStrong,backgroundColor:'#090B09'},
 laneActive:{backgroundColor:'#10150C',borderBottomWidth:2,borderBottomColor:C.lime},
 laneText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8,textAlign:'left'},
 laneTextActive:{color:C.lime},
 laneCount:{color:C.muted,fontFamily:F.semiBold,fontSize:8,marginTop:4},
 laneCountActive:{color:C.white},
 filtersStrip:{height:52,paddingVertical:9,flexDirection:'row',gap:7},
 filterCell:{flex:1},
 list:{paddingHorizontal:L.mobileGutter,paddingBottom:28},
 resultsTop:{height:46,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 results:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1,flexShrink:1},
 viewToggle:{flexDirection:'row',borderWidth:1,borderColor:C.borderStrong},
 viewButton:{height:32,paddingHorizontal:10,flexDirection:'row',gap:5,alignItems:'center',justifyContent:'center',backgroundColor:'#090B09'},
 viewButtonActive:{backgroundColor:'#10150C'},
 viewButtonText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 viewButtonTextActive:{color:C.lime},
 card:{borderTopWidth:1,borderTopColor:C.borderStrong,paddingVertical:18},
 cardTop:{flexDirection:'row',alignItems:'flex-start'},
 companyMark:{width:36,height:36,borderRadius:2,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',alignItems:'center',justifyContent:'center',marginRight:10},
 companyMarkText:{color:C.white,fontFamily:F.extraBold,fontSize:13},
 cardTopCopy:{flex:1,minWidth:0,paddingRight:10},
 saveBtn:{width:34,height:34,borderRadius:2,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',backgroundColor:'#0A0C0A'},saveBtnActive:{backgroundColor:C.lime,borderColor:C.lime},
 jobTitle:{color:C.white,fontFamily:F.extraBold,fontSize:20,lineHeight:22,letterSpacing:-.4},
 company:{color:C.mutedStrong,fontFamily:F.bold,fontSize:12,marginTop:3},
 metaRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6,marginTop:12},
 meta:{color:C.muted,fontSize:11,textTransform:'capitalize'},
 metaDot:{width:3,height:3,borderRadius:2,backgroundColor:C.borderStrong},
 pay:{color:C.white,fontFamily:F.extraBold,fontSize:14,marginTop:11},
 badgeRow:{flexDirection:'row',gap:6,flexWrap:'wrap',marginTop:11},
 desc:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginTop:13},
 cardFooter:{marginTop:15,paddingTop:12,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 sourceLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},
 source:{color:C.mutedStrong,fontSize:9,marginTop:3},
 viewAction:{flexDirection:'row',alignItems:'center',gap:6},
 viewText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},
 empty:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:28},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18},
 emptyBody:{color:C.muted,fontSize:13,lineHeight:20,marginTop:7},
 error:{color:C.danger,fontSize:12,paddingVertical:12},
 radiusRow:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:10},radiusLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1.2,width:46},radiusCell:{flex:1},
 zipNote:{color:C.muted,fontSize:10,lineHeight:15,marginBottom:10},
 footer:{paddingTop:18,alignItems:'stretch'},footerText:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,textAlign:'center',paddingVertical:10},
 moreBtn:{height:42,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',backgroundColor:'#0A0C0A'},moreText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 mapBar:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:L.mobileGutter,paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.border},
 mapSummary:{flex:1,minWidth:0,height:34,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:10,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A'},
 mapSummaryText:{flex:1,color:C.white,fontFamily:F.semiBold,fontSize:11},
 mapActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:L.mobileGutter,paddingVertical:8},mapCount:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,flexShrink:1,textAlign:'right',marginLeft:10},
 mapError:{paddingHorizontal:L.mobileGutter},
 mapArea:{flex:1},mapState:{flex:1,alignItems:'center',justifyContent:'center'},mapStateText:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.2},
 mapMore:{height:40,marginHorizontal:L.mobileGutter,marginVertical:8,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',backgroundColor:'#0A0C0A'},
 modal:{flex:1,backgroundColor:C.black},
 modalHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:L.mobileGutter,paddingTop:22,paddingBottom:16,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 modalEyebrow:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.5},modalTitle:{color:C.white,fontFamily:F.black,fontSize:24,marginTop:3},
 modalClose:{width:36,height:36,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},
 modalBody:{paddingHorizontal:L.mobileGutter,paddingBottom:24},
 groupLabel:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2,marginTop:22,marginBottom:10},groupHint:{color:C.muted,fontSize:12,lineHeight:18},
 switchRow:{flexDirection:'row',alignItems:'center',gap:12,borderTopWidth:1,borderBottomWidth:1,borderColor:C.border,paddingVertical:12},switchCopy:{flex:1},switchTitle:{color:C.white,fontFamily:F.bold,fontSize:13},switchBody:{color:C.muted,fontSize:11,lineHeight:16,marginTop:2},
 modalFooter:{flexDirection:'row',gap:8,paddingHorizontal:L.mobileGutter,paddingTop:12,paddingBottom:28,borderTopWidth:1,borderTopColor:C.borderStrong},
 resetBtn:{height:44,paddingHorizontal:18,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},resetText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 applyBtn:{flex:1}
});
