import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView, KEYBOARD_LIST_PROPS } from '@/components/FormScrollView';
import { notify } from '@/core/ui/notify';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, SharpChip, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import {
 countHousingFilters, EMPTY_HOUSING_FILTERS, housingFiltersFromRecord, HOUSING_PAGE_SIZE, loadSavedHousingIds, saveHousing, saveHousingSearch, searchHousing,
 trackProductEvent, unsaveHousing, type HousingCard, type HousingFilters, type HousingSort
} from '@/core/opportunities/opportunity-service';
import { isZip, normalizePlace, resolveZipCenter } from '@/core/opportunities/opportunity-service';
import { DEFAULT_SEARCH_RADIUS_MILES, loadLocationSettings } from '@/core/profile/location-service';
import { supabase } from '@/lib/supabase';
import { HousingMap } from '@/components/HousingMap';
import { getMarketCoverage, isLowCoverage, type MarketCoverage } from '@/core/coverage/coverage-service';

const RADIUS_CHOICES=[10,25,50,100];
const TYPES=['apartment','townhome','house','duplex','condo','room'];
const BED_OPTIONS=['ANY','STUDIO','1+','2+','3+','4+'];
const BATH_OPTIONS=['ANY','1+','1.5+','2+','3+'];
const SORTS:[HousingSort,string][]=[['featured','Recommended'],['nearest','Nearest'],['price_low','Price: low'],['price_high','Price: high'],['newest','Newest']];
const FEATURE_TOGGLES:[keyof HousingFilters,string][]=[['garage','Garage'],['parking','Parking'],['furnished','Furnished'],['basement','Basement'],['yard','Yard'],['balcony','Balcony / patio'],['laundry','Laundry'],['centralAir','Central air'],['moveInReady','Move-in ready']];

export default function Housing(){
 const params=useLocalSearchParams<Record<string,string>>();
 // search state (survives LIST <-> MAP <-> PROPERTY <-> BACK: one screen, one state)
 const [query,setQuery]=useState(params.search??'');
 const [where,setWhere]=useState(params.location??'');
 const [radius,setRadius]=useState(Number(params.radius)||DEFAULT_SEARCH_RADIUS_MILES);
 const [filters,setFilters]=useState<HousingFilters>(()=>housingFiltersFromRecord(params));
 const [sort,setSort]=useState<HousingSort>((['featured','nearest','price_low','price_high','newest'].includes(params.sort??'')?params.sort:'featured') as HousingSort);
 const [nonce,setNonce]=useState(0);
 // results
 const [homes,setHomes]=useState<HousingCard[]>([]);
 const [total,setTotal]=useState(0);
 const [hasMore,setHasMore]=useState(false);
 const [loading,setLoading]=useState(true);
 const [loadingMore,setLoadingMore]=useState(false);
 const [error,setError]=useState('');
 const [zipUnplaced,setZipUnplaced]=useState(false);
 const [coverage,setCoverage]=useState<MarketCoverage|null>(null);
 // ui
 const [viewMode,setViewMode]=useState<'list'|'map'>('list');
 const [controlsOpen,setControlsOpen]=useState(false);
 const [filtersOpen,setFiltersOpen]=useState(false);
 const [draft,setDraft]=useState<{filters:HousingFilters;sort:HousingSort;radius:number}>({filters:EMPTY_HOUSING_FILTERS,sort:'featured',radius:DEFAULT_SEARCH_RADIUS_MILES});
 const [saved,setSaved]=useState<Record<string,boolean>>({});
 const [signedIn,setSignedIn]=useState(false);
 const [savedZip,setSavedZip]=useState<string|null>(null);
 const [locationReady,setLocationReady]=useState(false);
 const whereTouched=useRef(Boolean(params.location));
 const whereRef=useRef('');
 const requestId=useRef(0);
 whereRef.current=where;
 const zip=isZip(where)?where.trim():null;
 const filterCount=countHousingFilters(filters)+(zip&&radius!==DEFAULT_SEARCH_RADIUS_MILES?1:0)+(sort!=='featured'?1:0);

 function criteria(offset:number){
  return {query,zip,radiusMiles:radius,location:normalizePlace(where),filters,sort,limit:HOUSING_PAGE_SIZE,offset};
 }

 async function run(){
  const mine=++requestId.current;
  setLoading(true);setError('');
  try{
   const r=await searchHousing(criteria(0));
   if(mine!==requestId.current)return;
   setHomes(r.homes);setTotal(r.total);setHasMore(r.hasMore);
   void trackProductEvent('housing_search','housing',null,{query:query.trim(),location:where.trim(),radius:zip?radius:null,result_count:r.total}).catch(()=>{});
  }catch{
   if(mine!==requestId.current)return;
   setError('Housing could not load. Check your connection and try again.');
  }finally{
   if(mine===requestId.current)setLoading(false);
  }
 }

 async function loadMore(){
  if(loading||loadingMore||!hasMore)return;
  const mine=requestId.current;
  setLoadingMore(true);
  try{
   const r=await searchHousing(criteria(homes.length));
   if(mine!==requestId.current)return;
   setHomes(prev=>{const seen=new Set(prev.map(h=>h.id));return [...prev,...r.homes.filter(h=>!seen.has(h.id))]});
   setHasMore(r.hasMore);
  }catch{
   if(mine===requestId.current)setError('More homes could not load. Search again to retry.');
  }finally{
   setLoadingMore(false);
  }
 }

 // Saved ZIP + radius. Runs on every focus so returning from Location Setup picks up changes,
 // but never overwrites a WHERE value the member typed (or arrived with from a saved search).
 useFocusEffect(useCallback(()=>{
  let active=true;
  supabase.auth.getUser().then(({data})=>{if(active)setSignedIn(Boolean(data.user))});
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
  loadSavedHousingIds().then(ids=>{if(active)setSaved(Object.fromEntries(ids.map(id=>[id,true])))}).catch(()=>{});
  return()=>{active=false};
 },[]));

 // Opening a saved search (or a deep link) while this screen is already mounted re-applies its params.
 const paramKey=JSON.stringify(params);
 const firstParams=useRef(true);
 useEffect(()=>{
  if(firstParams.current){firstParams.current=false;return}
  setQuery(params.search??'');
  if(params.location!==undefined){whereTouched.current=true;setWhere(params.location)}
  setRadius(Number(params.radius)||DEFAULT_SEARCH_RADIUS_MILES);
  setFilters(housingFiltersFromRecord(params));
  setSort((['featured','nearest','price_low','price_high','newest'].includes(params.sort??'')?params.sort:'featured') as HousingSort);
  setNonce(n=>n+1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[paramKey]);

 // Every control re-runs the search through one path; typed text runs when the nonce is bumped (SEARCH / return key).
 useEffect(()=>{
  if(!locationReady)return;
  void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[locationReady,nonce,filters,sort,radius]);

 useEffect(()=>{
  let active=true;
  setZipUnplaced(false);
  if(zip)resolveZipCenter(zip).then(c=>{if(active)setZipUnplaced(!c)}).catch(()=>{});
  return()=>{active=false};
 },[zip]);

 // Distinguishes "this search matched nothing" from "FairPath does not have enough coverage here yet".
 useEffect(()=>{
  let active=true;
  if(!loading&&zip&&total===0){
   getMarketCoverage(zip).then(c=>{if(active)setCoverage(c)}).catch(()=>{});
  }else{
   setCoverage(null);
  }
  return()=>{active=false};
 },[loading,zip,total]);

 function search(){setNonce(n=>n+1)}
 function changeWhere(v:string){whereTouched.current=true;setWhere(v)}
 function useSavedZip(){if(!savedZip)return;whereTouched.current=true;setWhere(savedZip);setNonce(n=>n+1)}
 function clearWhere(){whereTouched.current=true;setWhere('');setNonce(n=>n+1)}
 function patchFilters(p:Partial<HousingFilters>){setFilters(f=>({...f,...p}))}

 function openFilters(){setDraft({filters,sort,radius});setFiltersOpen(true)}
 function applyFilters(){
  setFilters(draft.filters);setSort(draft.sort);setRadius(draft.radius);
  setFiltersOpen(false);
 }
 function patchDraft(p:Partial<HousingFilters>){setDraft(d=>({...d,filters:{...d.filters,...p}}))}
 function toggleDraftType(type:string){setDraft(d=>({...d,filters:{...d.filters,types:d.filters.types.includes(type)?d.filters.types.filter(x=>x!==type):[...d.filters.types,type]}}))}
 function resetDraft(){setDraft({filters:EMPTY_HOUSING_FILTERS,sort:'featured',radius:DEFAULT_SEARCH_RADIUS_MILES})}

 function openHome(h:{id:string}){router.push(('/housing/'+h.id) as never)}

 async function toggleSave(id:string){
  const current=Boolean(saved[id]);
  try{
   if(current)await unsaveHousing(id);else await saveHousing(id);
   setSaved(v=>({...v,[id]:!current}));void trackProductEvent(current?'housing_unsaved':'housing_saved','housing',id).catch(()=>{});
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){
    router.push(('/sign-up?returnTo='+encodeURIComponent('/find-housing')) as never);
    return;
   }
   notify('Could not update saved home','Please try again.');
  }
 }

 async function saveCurrentSearch(){
  if(!signedIn){router.push('/sign-up?returnTo=/find-housing' as never);return}
  const record:Record<string,string|boolean|number>={
   minRent:filters.minRent,maxRent:filters.maxRent,beds:filters.beds,baths:filters.baths,types:filters.types.join(','),minSqft:filters.minSqft,
   fastTrack:filters.fastTrack,pets:filters.pets,accessible:filters.accessible,garage:filters.garage,parking:filters.parking,furnished:filters.furnished,
   basement:filters.basement,yard:filters.yard,balcony:filters.balcony,laundry:filters.laundry,centralAir:filters.centralAir,moveInReady:filters.moveInReady,
   sort,radius
  };
  try{
   await saveHousingSearch({name:[query.trim()||'Housing',where.trim()].filter(Boolean).join(' · ')||'Housing search',query,location:where,filters:record});
   void trackProductEvent('housing_search_saved','housing',null,{query:query.trim(),location:where.trim(),filters:record}).catch(()=>{});
   notify('Search saved','You can reopen this search from Saved searches.');
  }catch{notify('Could not save search','Please try again.')}
 }

 const summary=[query.trim()||'All homes',where.trim()||'Anywhere',zip?radius+' mi':''].filter(Boolean).join(' · ');
 const resultsLabel=loading?'SEARCHING':String(total)+(total===1?' HOME':' HOMES')+(zip?' · WITHIN '+radius+' MI':'');

 const filtersButton=<Pressable accessibilityRole="button" accessibilityLabel="Open filters" style={s.filtersBtn} onPress={openFilters}>
  <Lucide name="sliders-horizontal" color={C.lime} size={14}/>
  <Text style={s.filtersBtnText}>FILTERS</Text>
  {filterCount>0?<View style={s.filtersCount}><Text style={s.filtersCountText}>{filterCount}</Text></View>:null}
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
   <View style={s.fieldIcon}><Lucide name="house" color={C.lime} size={15}/></View>
   <View style={s.fieldCopy}>
    <Text style={s.fieldLabel}>WHAT</Text>
    <TextInput value={query} onChangeText={setQuery} onSubmitEditing={search} returnKeyType="search" style={s.input} placeholder="Keyword or property type" placeholderTextColor={C.muted}/>
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
  {zip&&zipUnplaced?<Text style={s.zipNote}>We can't place ZIP {zip} on the map yet, so you'll see homes in that exact ZIP.</Text>:null}

  <View style={s.actionRow}>
   {filtersButton}
   <Pressable accessibilityRole="button" style={s.primary} onPress={search}>
    <Text style={s.primaryText}>SEARCH HOUSING</Text>
    <Lucide name="arrow-right" color={C.black} size={16}/>
   </Pressable>
  </View>
 </View>;

 const quickChips=<View style={s.filtersStrip}>
  <View style={s.filterCell}><SharpChip label="2+ beds" active={filters.beds==='2+'} onPress={()=>patchFilters({beds:filters.beds==='2+'?'ANY':'2+'})}/></View>
  <View style={s.filterCell}><SharpChip label="FastTrack" active={filters.fastTrack} onPress={()=>patchFilters({fastTrack:!filters.fastTrack})}/></View>
  <View style={s.filterCell}><SharpChip label="Pets OK" active={filters.pets} onPress={()=>patchFilters({pets:!filters.pets})}/></View>
 </View>;

 const searchActions=<View style={s.searchActions}>
  <Pressable style={s.searchAction} onPress={()=>void saveCurrentSearch()}><Lucide name="bookmark-plus" color={C.lime} size={13}/><Text style={s.searchActionText}>SAVE SEARCH</Text></Pressable>
  {signedIn?<Pressable style={s.searchAction} onPress={()=>router.push('/saved-housing-searches' as never)}><Lucide name="history" color={C.lime} size={13}/><Text style={s.searchActionText}>SAVED SEARCHES</Text></Pressable>:null}
 </View>;

 function renderHome(h:HousingCard){
  const photo=h.housing_media?.filter(m=>m.media_type==='photo').sort((a,b)=>a.sort_order-b.sort_order)[0]?.url??'';
  const isSaved=Boolean(saved[h.id]);
  return <Pressable key={h.id} style={s.card} onPress={()=>openHome(h)}>
   <View style={s.media}>
    {photo?<Image source={{uri:photo}} style={s.photo}/>:<View style={s.noPhoto}><Text style={s.noPhotoText}>NO PHOTO AVAILABLE</Text></View>}
    <Pressable accessibilityRole="button" accessibilityLabel={isSaved?'Remove saved home':'Save home'} style={[s.saveBtn,isSaved&&s.saveBtnActive]} onPress={e=>{e.stopPropagation?.();void toggleSave(h.id)}}>
     <Lucide name={isSaved?'bookmark-check':'bookmark'} color={isSaved?C.black:C.white} size={15}/>
    </Pressable>
   </View>

   <View style={s.body}>
    <View style={s.priceRow}><Text style={s.price}>{'$'+Number(h.rent_monthly).toLocaleString()}</Text><Text style={s.per}> / month</Text></View>
    <Text style={s.homeTitle}>{h.title}</Text>
    <Text style={s.meta}>{[h.bedrooms!=null?(Number(h.bedrooms)===0?'Studio':h.bedrooms+' bd'):null,h.bathrooms!=null?h.bathrooms+' ba':null,h.square_feet?h.square_feet.toLocaleString()+' sq ft':null].filter(Boolean).join(' · ')}</Text>
    <View style={s.locationRow}><Lucide name="map-pin" color={C.muted} size={12}/><Text style={s.location}>{[h.city,h.state,h.postal_code].filter(Boolean).join(', ')}{h.distance_miles!=null?' · '+(h.distance_miles<10?h.distance_miles.toFixed(1):Math.round(h.distance_miles))+' mi':''}</Text></View>
    <View style={s.badges}>{h.fasttrack_enabled?<InlineBadge tone="lime">FASTTRACK AVAILABLE</InlineBadge>:null}<InlineBadge>{h.property_type.toUpperCase()}</InlineBadge></View>
    <View style={s.footer}><View><Text style={s.sourceLabel}>SOURCE</Text><Text style={s.source}>{h.source_label||'FairPath'}</Text></View><View style={s.viewRow}><Text style={s.viewText}>VIEW HOME</Text><Lucide name="arrow-right" color={C.lime} size={13}/></View></View>
   </View>
  </Pressable>;
 }

 const lowCoverage=zip&&coverage&&isLowCoverage(coverage.status);
 const statusBlock=<>
  {error?<Text style={s.error}>{error}</Text>:null}
  {!loading&&homes.length===0&&!error&&lowCoverage?<View style={s.empty}>
   <Text style={s.emptyTitle}>FairPath does not have enough verified housing near {zip} yet.</Text>
   <Text style={s.emptyBody}>That's different from this search finding nothing — the market itself is still building. FairPath can notify you when it's ready.</Text>
   <Pressable style={s.earlyAccessBtn} onPress={()=>router.push(('/early-access?zip='+zip) as never)}>
    <Text style={s.earlyAccessBtnText}>JOIN EARLY ACCESS</Text>
    <Lucide name="arrow-right" color={C.black} size={14}/>
   </Pressable>
  </View>:null}
  {!loading&&homes.length===0&&!error&&!lowCoverage?<View style={s.empty}>
   <Text style={s.emptyTitle}>No homes match this search.</Text>
   <Text style={s.emptyBody}>{zip?'Try a larger radius, a different keyword, or remove a filter.':'Try a wider location, a different keyword, or remove a filter.'}</Text>
  </View>:null}
 </>;

 const filtersModal=<Modal visible={filtersOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setFiltersOpen(false)}>
  <View style={s.modal}>
   <View style={s.modalHead}>
    <View><Text style={s.modalEyebrow}>FAIRPATH HOUSING</Text><Text style={s.modalTitle}>Filters</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Close filters" hitSlop={10} style={s.modalClose} onPress={()=>setFiltersOpen(false)}><Lucide name="x" color={C.white} size={16}/></Pressable>
   </View>
   <FormScrollView contentContainerStyle={s.modalBody} keyboardShouldPersistTaps="handled">
    <Text style={s.groupLabel}>SORT BY</Text>
    <View style={s.wrapRow}>{SORTS.filter(([k])=>k!=='nearest'||zip).map(([k,label])=><SharpChip key={k} label={label} active={draft.sort===k} onPress={()=>setDraft(d=>({...d,sort:k}))}/>)}</View>

    <Text style={s.groupLabel}>DISTANCE</Text>
    {zip?<View style={s.radiusRow}>{RADIUS_CHOICES.map(r=><View key={r} style={s.radiusCell}><SharpChip label={r+' mi'} active={draft.radius===r} onPress={()=>setDraft(d=>({...d,radius:r}))}/></View>)}</View>
     :<Text style={s.groupHint}>Enter a ZIP code in WHERE to search within a distance. Currently: {where.trim()?'searching "'+where.trim()+'"':'all locations'}.</Text>}

    <Text style={s.groupLabel}>MONTHLY RENT</Text>
    <View style={s.moneyRow}>
     <View style={s.inputBox}><Text style={s.inputLabel}>MIN</Text><TextInput value={draft.filters.minRent} onChangeText={v=>patchDraft({minRent:v.replace(/[^0-9]/g,'')})} keyboardType="number-pad" style={s.boxInput} placeholder="$0" placeholderTextColor={C.muted}/></View>
     <Text style={s.to}>TO</Text>
     <View style={s.inputBox}><Text style={s.inputLabel}>MAX</Text><TextInput value={draft.filters.maxRent} onChangeText={v=>patchDraft({maxRent:v.replace(/[^0-9]/g,'')})} keyboardType="number-pad" style={s.boxInput} placeholder="No max" placeholderTextColor={C.muted}/></View>
    </View>

    <Text style={s.groupLabel}>BEDROOMS</Text>
    <View style={s.wrapRow}>{BED_OPTIONS.map(o=><SharpChip key={o} label={o==='ANY'?'Any':o==='STUDIO'?'Studio':o} active={draft.filters.beds===o} onPress={()=>patchDraft({beds:o})}/>)}</View>

    <Text style={s.groupLabel}>BATHROOMS</Text>
    <View style={s.wrapRow}>{BATH_OPTIONS.map(o=><SharpChip key={o} label={o==='ANY'?'Any':o} active={draft.filters.baths===o} onPress={()=>patchDraft({baths:o})}/>)}</View>

    <Text style={s.groupLabel}>PROPERTY TYPE</Text>
    <View style={s.wrapRow}>{TYPES.map(t=><SharpChip key={t} label={t.charAt(0).toUpperCase()+t.slice(1)} active={draft.filters.types.includes(t)} onPress={()=>toggleDraftType(t)}/>)}</View>

    <Text style={s.groupLabel}>SIZE</Text>
    <View style={s.moneyRow}>
     <View style={s.inputBox}><Text style={s.inputLabel}>MIN SQ FT</Text><TextInput value={draft.filters.minSqft} onChangeText={v=>patchDraft({minSqft:v.replace(/[^0-9]/g,'')})} keyboardType="number-pad" style={s.boxInput} placeholder="Any" placeholderTextColor={C.muted}/></View>
    </View>

    <Text style={s.groupLabel}>FAIRPATH & ACCESS</Text>
    <View style={s.wrapRow}>
     <SharpChip label="FastTrack" active={draft.filters.fastTrack} onPress={()=>patchDraft({fastTrack:!draft.filters.fastTrack})}/>
     <SharpChip label="Pets allowed" active={draft.filters.pets} onPress={()=>patchDraft({pets:!draft.filters.pets})}/>
     <SharpChip label="Accessible" active={draft.filters.accessible} onPress={()=>patchDraft({accessible:!draft.filters.accessible})}/>
    </View>

    <Text style={s.groupLabel}>HOME FEATURES</Text>
    <View style={s.wrapRow}>{FEATURE_TOGGLES.map(([k,label])=><SharpChip key={k} label={label} active={Boolean(draft.filters[k])} onPress={()=>patchDraft({[k]:!draft.filters[k]} as Partial<HousingFilters>)}/>)}</View>
    <Text style={s.groupHint}>Neighborhood, transit and school filters will appear when verified provider data is connected.</Text>
   </FormScrollView>
   <View style={s.modalFooter}>
    <Pressable accessibilityRole="button" style={s.resetBtn} onPress={resetDraft}><Text style={s.resetText}>RESET</Text></Pressable>
    <Pressable accessibilityRole="button" style={[s.primary,s.applyBtn]} onPress={applyFilters}><Text style={s.primaryText}>SHOW HOMES</Text><Lucide name="check" color={C.black} size={16}/></Pressable>
   </View>
  </View>
 </Modal>;

 if(viewMode==='map')return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Housing map" backTo="/" alwaysBackTo/>
  <View style={s.mapBar}>
   <Pressable accessibilityRole="button" accessibilityLabel="Edit search" style={s.mapSummary} onPress={()=>setControlsOpen(o=>!o)}>
    <Lucide name="search" color={C.lime} size={13}/>
    <Text style={s.mapSummaryText} numberOfLines={1}>{summary}</Text>
    <Lucide name={controlsOpen?'chevron-up':'chevron-down'} color={C.mutedStrong} size={14}/>
   </Pressable>
   {viewToggle}
  </View>
  {controlsOpen?<View style={s.mapControls}>{searchControls}</View>:<View style={s.mapActions}>{filtersButton}<Text style={s.mapCount}>{resultsLabel}</Text></View>}
  {error?<Text style={[s.error,s.mapError]}>{error}</Text>:null}
  <View style={s.mapArea}>
   {loading&&homes.length===0?<View style={s.mapState}><Text style={s.mapStateText}>SEARCHING…</Text></View>
    :<HousingMap homes={homes} onOpen={openHome}/>}
  </View>
  {hasMore?<Pressable accessibilityRole="button" style={s.mapMore} onPress={()=>void loadMore()}><Text style={s.moreText}>{loadingMore?'LOADING…':'SHOWING '+homes.length+' · LOAD MORE HOMES'}</Text></Pressable>:null}
  {filtersModal}
 </ScreenFrame>;

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Find housing" backTo="/" alwaysBackTo/>
  <FlatList
   {...KEYBOARD_LIST_PROPS}
   data={homes}
   keyExtractor={h=>h.id}
   renderItem={({item})=>renderHome(item)}
   contentContainerStyle={s.list}
   keyboardShouldPersistTaps="handled"
   showsVerticalScrollIndicator={false}
   onEndReached={()=>void loadMore()}
   onEndReachedThreshold={0.6}
   ListHeaderComponent={<View>
    <View style={s.utilityRow}>
     <Pressable style={s.utilityBtn} onPress={()=>router.replace('/find-jobs' as never)}><Lucide name="briefcase-business" color={C.lime} size={13}/><Text style={s.utilityText}>JOBS</Text></Pressable>
     {signedIn?<><Pressable style={s.utilityBtn} onPress={()=>router.push('/saved-homes' as never)}><Lucide name="bookmark" color={C.lime} size={13}/><Text style={s.utilityText}>SAVED HOMES</Text></Pressable><Pressable style={s.utilityBtn} onPress={()=>router.push('/housing-applications' as never)}><Lucide name="file-check-2" color={C.lime} size={13}/><Text style={s.utilityText}>APPLICATIONS</Text></Pressable></>:<View style={s.utilityInfo}><Lucide name="house" color={C.lime} size={13}/><Text style={s.utilityText}>BROWSE WITHOUT AN ACCOUNT</Text></View>}
    </View>
    {searchControls}
    {quickChips}
    {searchActions}
    <View style={s.resultsTop}>
     <Text style={s.results}>{resultsLabel}</Text>
     {viewToggle}
    </View>
    {statusBlock}
   </View>}
   ListFooterComponent={<View style={s.footerBlock}>
    {loadingMore?<Text style={s.footerText}>LOADING MORE HOMES…</Text>:null}
    {!loadingMore&&hasMore&&!loading?<Pressable accessibilityRole="button" style={s.moreBtn} onPress={()=>void loadMore()}><Text style={s.moreText}>LOAD MORE HOMES</Text></Pressable>:null}
    {!loading&&!hasMore&&homes.length>0?<Text style={s.footerText}>END OF RESULTS</Text>:null}
   </View>}
  />
  {filtersModal}
 </ScreenFrame>;
}

const s=StyleSheet.create({
 utilityRow:{height:44,flexDirection:'row',borderBottomWidth:1,borderBottomColor:C.borderStrong,marginHorizontal:-L.mobileGutter},utilityBtn:{flex:1,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:C.borderStrong},utilityInfo:{flex:1,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'},utilityText:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 searchBlock:{paddingTop:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 searchRow:{minHeight:54,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',marginBottom:8},fieldIcon:{width:42,alignItems:'center',justifyContent:'center'},fieldCopy:{flex:1,minWidth:0,paddingVertical:8},fieldLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1.25,marginBottom:2},input:{color:C.white,fontFamily:F.medium,fontSize:14,paddingVertical:2,paddingHorizontal:0},
 clearBtn:{width:40,height:40,alignItems:'center',justifyContent:'center'},
 useSaved:{flexDirection:'row',alignItems:'center',gap:6,marginBottom:10},useSavedText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},
 radiusRow:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:10},radiusLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1.2,width:46},radiusCell:{flex:1},
 zipNote:{color:C.muted,fontSize:10,lineHeight:15,marginBottom:10},
 actionRow:{flexDirection:'row',gap:8,marginTop:2},
 filtersBtn:{height:44,paddingHorizontal:14,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0C100B'},filtersBtnText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 filtersCount:{minWidth:16,height:16,paddingHorizontal:4,backgroundColor:C.lime,alignItems:'center',justifyContent:'center'},filtersCountText:{color:C.black,fontFamily:F.extraBold,fontSize:9},
 primary:{flex:1,height:44,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:1},
 filtersStrip:{height:52,paddingVertical:9,flexDirection:'row',gap:7},filterCell:{flex:1},
 searchActions:{paddingVertical:8,borderTopWidth:1,borderBottomWidth:1,borderColor:C.border,flexDirection:'row',gap:8},searchAction:{flex:1,minHeight:36,borderWidth:1,borderColor:C.borderStrong,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'},searchActionText:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7},
 list:{paddingHorizontal:L.mobileGutter,paddingBottom:30},resultsTop:{height:46,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},results:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1,flexShrink:1},
 viewToggle:{flexDirection:'row',borderWidth:1,borderColor:C.borderStrong},viewButton:{height:32,paddingHorizontal:10,flexDirection:'row',gap:5,alignItems:'center',justifyContent:'center',backgroundColor:'#090B09'},viewButtonActive:{backgroundColor:'#10150C'},viewButtonText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},viewButtonTextActive:{color:C.lime},
 card:{borderTopWidth:1,borderTopColor:C.borderStrong,paddingVertical:18},media:{height:180,position:'relative',backgroundColor:'#0A0C0A',borderWidth:1,borderColor:C.borderStrong,overflow:'hidden'},photo:{width:'100%',height:'100%'},noPhoto:{flex:1,alignItems:'center',justifyContent:'center'},noPhotoText:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2},
 saveBtn:{position:'absolute',right:8,top:8,width:34,height:34,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#090A09DD',alignItems:'center',justifyContent:'center'},saveBtnActive:{backgroundColor:C.lime,borderColor:C.lime},
 body:{paddingTop:13},priceRow:{flexDirection:'row',alignItems:'baseline'},price:{color:C.white,fontFamily:F.black,fontSize:25},per:{color:C.muted,fontSize:11},homeTitle:{color:C.white,fontFamily:F.extraBold,fontSize:19,lineHeight:22,marginTop:4},meta:{color:C.mutedStrong,fontSize:12,marginTop:7},locationRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:7},location:{color:C.muted,fontSize:11},badges:{flexDirection:'row',gap:6,flexWrap:'wrap',marginTop:11},
 footer:{marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sourceLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},source:{color:C.mutedStrong,fontSize:9,marginTop:3},viewRow:{flexDirection:'row',alignItems:'center',gap:6},viewText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 empty:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:28},emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18},emptyBody:{color:C.muted,fontSize:13,lineHeight:20,marginTop:7},error:{color:C.danger,fontSize:12,paddingVertical:12},
 earlyAccessBtn:{height:46,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:16,paddingHorizontal:16,alignSelf:'flex-start'},
 earlyAccessBtnText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.8},
 footerBlock:{paddingTop:18,alignItems:'stretch'},footerText:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,textAlign:'center',paddingVertical:10},
 moreBtn:{height:42,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',backgroundColor:'#0A0C0A'},moreText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 mapBar:{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:L.mobileGutter,paddingVertical:10,borderBottomWidth:1,borderBottomColor:C.border},
 mapSummary:{flex:1,minWidth:0,height:34,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:10,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A'},mapSummaryText:{flex:1,color:C.white,fontFamily:F.semiBold,fontSize:11},
 mapControls:{paddingHorizontal:L.mobileGutter},
 mapActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:L.mobileGutter,paddingVertical:8},mapCount:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,flexShrink:1,textAlign:'right',marginLeft:10},
 mapError:{paddingHorizontal:L.mobileGutter},
 mapArea:{flex:1},mapState:{flex:1,alignItems:'center',justifyContent:'center'},mapStateText:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.2},
 mapMore:{height:40,marginHorizontal:L.mobileGutter,marginVertical:8,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',backgroundColor:'#0A0C0A'},
 modal:{flex:1,backgroundColor:C.black},
 modalHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:L.mobileGutter,paddingTop:22,paddingBottom:16,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 modalEyebrow:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.5},modalTitle:{color:C.white,fontFamily:F.black,fontSize:24,marginTop:3},
 modalClose:{width:36,height:36,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},
 modalBody:{paddingHorizontal:L.mobileGutter,paddingBottom:24},
 groupLabel:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2,marginTop:22,marginBottom:10},groupHint:{color:C.muted,fontSize:12,lineHeight:18,marginTop:12},
 wrapRow:{flexDirection:'row',flexWrap:'wrap',gap:7},
 moneyRow:{flexDirection:'row',alignItems:'center',gap:9},to:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},
 inputBox:{flex:1,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:12,paddingVertical:8},inputLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},boxInput:{color:C.white,fontFamily:F.medium,fontSize:14,paddingVertical:4,paddingHorizontal:0},
 modalFooter:{flexDirection:'row',gap:8,paddingHorizontal:L.mobileGutter,paddingTop:12,paddingBottom:28,borderTopWidth:1,borderTopColor:C.borderStrong},
 resetBtn:{height:44,paddingHorizontal:18,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},resetText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 applyBtn:{flex:1}
});
