import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, SharpChip, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadHousing, loadSavedHousingIds, saveHousing, saveHousingSearch, unsaveHousing, type HousingListing } from '@/core/opportunities/opportunity-service';
import { loadProfileAnswers } from '@/core/profile/profile-service';
import { demoHousingImage } from '@/core/demo/demo-media';
import { supabase } from '@/lib/supabase';

export default function Housing(){
 const params=useLocalSearchParams<{search?:string;location?:string;sort?:string;minRent?:string;maxRent?:string;beds?:string;baths?:string;types?:string;fastTrack?:string;pets?:string;accessible?:string;garage?:string;parking?:string;furnished?:string;basement?:string;yard?:string;balcony?:string;laundry?:string;centralAir?:string;moveInReady?:string;minSqft?:string;minWalk?:string}>();
 const [query,setQuery]=useState(params.search??'');
 const [location,setLocation]=useState(params.location??'');
 const [sort,setSort]=useState<'featured'|'price_low'|'price_high'|'newest'>((['featured','price_low','price_high','newest'].includes(params.sort??'')?params.sort:'featured') as any);
 const [rows,setRows]=useState<HousingListing[]>([]);
 const [fastTrack,setFastTrack]=useState(params.fastTrack==='1');
 const [twoPlus,setTwoPlus]=useState(params.beds==='2+');
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [saved,setSaved]=useState<Record<string,boolean>>({});
 const [signedIn,setSignedIn]=useState(false);

 async function run(){
  setLoading(true);setError('');
  try{setRows(await loadHousing(query,location))}
  catch{setError('Housing could not load. Check your connection and try again.')}
  finally{setLoading(false)}
 }

 useEffect(()=>{
  let active=true;
  supabase.auth.getUser().then(({data})=>{if(active)setSignedIn(Boolean(data.user))});
  const requestedQuery=params.search??'';
  const requestedLocation=params.location??'';
  if(requestedQuery||requestedLocation){
   setQuery(requestedQuery);setLocation(requestedLocation);
   loadHousing(requestedQuery,requestedLocation).then(x=>{if(active)setRows(x)}).catch(()=>{if(active)setError('Housing could not load.')}).finally(()=>{if(active)setLoading(false)});
  }else{
   loadProfileAnswers()
    .then(a=>{if(active&&typeof a['identity.current_location']==='string')setLocation(a['identity.current_location'] as string)})
    .finally(()=>{if(active)loadHousing().then(setRows).catch(()=>setError('Housing could not load.')).finally(()=>setLoading(false))});
  }
  return()=>{active=false};
 },[params.search,params.location]);

 useFocusEffect(useCallback(()=>{
  let active=true;
  loadSavedHousingIds().then(ids=>{if(active)setSaved(Object.fromEntries(ids.map(id=>[id,true])))}).catch(()=>{});
  return()=>{active=false};
 },[]));

 const activeFilters=useMemo(()=>{
  const typeList=(params.types??'').split(',').filter(Boolean);
  return {
   minRent:Number(params.minRent||0),
   maxRent:Number(params.maxRent||0),
   beds:params.beds??'ANY',
   baths:params.baths??'ANY',
   types:typeList,
   pets:params.pets==='1',
   accessible:params.accessible==='1',garage:params.garage==='1',parking:params.parking==='1',furnished:params.furnished==='1',basement:params.basement==='1',yard:params.yard==='1',balcony:params.balcony==='1',laundry:params.laundry==='1',centralAir:params.centralAir==='1',moveInReady:params.moveInReady==='1',minSqft:Number(params.minSqft||0),minWalk:Number(params.minWalk||0)
  };
 },[params.minRent,params.maxRent,params.beds,params.baths,params.types,params.pets,params.accessible,params.garage,params.parking,params.furnished,params.basement,params.yard,params.balcony,params.laundry,params.centralAir,params.moveInReady,params.minSqft,params.minWalk]);

 const filterCount=useMemo(()=>[
  activeFilters.minRent>0,activeFilters.maxRent>0,activeFilters.beds!=='ANY',activeFilters.baths!=='ANY',
  activeFilters.types.length>0,fastTrack,activeFilters.pets,activeFilters.accessible,activeFilters.garage,activeFilters.parking,activeFilters.furnished,activeFilters.basement,activeFilters.yard,activeFilters.balcony,activeFilters.laundry,activeFilters.centralAir,activeFilters.moveInReady,activeFilters.minSqft>0,activeFilters.minWalk>0
 ].filter(Boolean).length,[activeFilters,fastTrack]);

 const visible=useMemo(()=>rows.filter(h=>{
  const rent=Number(h.rent_monthly||0);
  const beds=Number(h.bedrooms||0);
  const baths=Number(h.bathrooms||0);
  const petText=(h.pet_policy||'').toLowerCase();
  if(fastTrack&&!h.fasttrack_enabled)return false;
  if(twoPlus&&beds<2)return false;
  if(activeFilters.minRent>0&&rent<activeFilters.minRent)return false;
  if(activeFilters.maxRent>0&&rent>activeFilters.maxRent)return false;
  if(activeFilters.beds==='STUDIO'&&beds!==0)return false;
  if(activeFilters.beds!=='ANY'&&activeFilters.beds!=='STUDIO'&&beds<Number(activeFilters.beds.replace('+','')))return false;
  if(activeFilters.baths!=='ANY'&&baths<Number(activeFilters.baths.replace('+','')))return false;
  if(activeFilters.types.length&&!activeFilters.types.includes(h.property_type.toLowerCase()))return false;
  if(activeFilters.pets&&(!petText||petText.includes('no pets')||petText.includes('not allowed')))return false;
  if(activeFilters.accessible&&!(h.accessibility_features?.length))return false;
  if(activeFilters.garage&&!(Number(h.garage_spaces||0)>0))return false;
  if(activeFilters.parking&&!(h.parking_types?.length||(h.parking||'').trim()))return false;
  if(activeFilters.furnished&&!h.furnished)return false;
  if(activeFilters.basement&&!h.has_basement)return false;
  if(activeFilters.yard&&!h.has_yard)return false;
  if(activeFilters.balcony&&!h.has_balcony_patio)return false;
  if(activeFilters.laundry&&!h.laundry_type)return false;
  if(activeFilters.centralAir&&!h.has_central_air)return false;
  if(activeFilters.moveInReady&&!h.move_in_ready)return false;
  if(activeFilters.minSqft>0&&Number(h.square_feet||0)<activeFilters.minSqft)return false;
  if(activeFilters.minWalk>0&&Number(h.walk_score||0)<activeFilters.minWalk)return false;
  return true;
 }).sort((a,b)=>{
  if(sort==='price_low')return Number(a.rent_monthly)-Number(b.rent_monthly);
  if(sort==='price_high')return Number(b.rent_monthly)-Number(a.rent_monthly);
  if(sort==='newest')return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
  if(a.featured!==b.featured)return a.featured?-1:1;
  return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
 }),[rows,fastTrack,twoPlus,activeFilters,sort]);

 async function toggleSave(id:string){
  const current=Boolean(saved[id]);
  try{
   if(current)await unsaveHousing(id);else await saveHousing(id);
   setSaved(v=>({...v,[id]:!current}));
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){
    router.push(('/sign-up?returnTo='+encodeURIComponent('/find-housing')) as never);
   }
  }
 }

 async function saveCurrentSearch(){
  if(!signedIn){router.push('/sign-up?returnTo=/find-housing' as never);return}
  const filters:Record<string,string|boolean|number>={
   minRent:params.minRent??'',maxRent:params.maxRent??'',beds:twoPlus?'2+':params.beds??'ANY',baths:params.baths??'ANY',types:params.types??'',
   fastTrack,pets:params.pets==='1',accessible:params.accessible==='1',garage:params.garage==='1',parking:params.parking==='1',furnished:params.furnished==='1',
   basement:params.basement==='1',yard:params.yard==='1',balcony:params.balcony==='1',laundry:params.laundry==='1',centralAir:params.centralAir==='1',
   moveInReady:params.moveInReady==='1',minSqft:params.minSqft??'',minWalk:params.minWalk??'',sort
  };
  try{
   await saveHousingSearch({name:[query.trim()||'Housing',location.trim()].filter(Boolean).join(' · ')||'Housing search',query,location,filters});
   Alert.alert('Search saved','You can reopen this search from Saved searches.');
  }catch{Alert.alert('Could not save search','Please try again.')}
 }
 function cycleSort(){setSort(v=>v==='featured'?'price_low':v==='price_low'?'price_high':v==='price_high'?'newest':'featured')}
 const sortLabel=sort==='featured'?'FEATURED':sort==='price_low'?'PRICE: LOW':sort==='price_high'?'PRICE: HIGH':'NEWEST';

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Find housing" backTo="/" alwaysBackTo/>

  <View style={s.utilityRow}>
   <Pressable style={s.utilityBtn} onPress={()=>router.replace('/find-jobs' as never)}><Lucide name="briefcase-business" color={C.lime} size={13}/><Text style={s.utilityText}>JOBS</Text></Pressable>
   {signedIn?<><Pressable style={s.utilityBtn} onPress={()=>router.push('/saved-homes' as never)}><Lucide name="bookmark" color={C.lime} size={13}/><Text style={s.utilityText}>SAVED HOMES</Text></Pressable><Pressable style={s.utilityBtn} onPress={()=>router.push('/housing-applications' as never)}><Lucide name="file-check-2" color={C.lime} size={13}/><Text style={s.utilityText}>APPLICATIONS</Text></Pressable></>:<View style={s.utilityInfo}><Lucide name="house" color={C.lime} size={13}/><Text style={s.utilityText}>BROWSE WITHOUT AN ACCOUNT</Text></View>}
  </View>

  <View style={s.searchBlock}>
   <View style={s.searchRow}>
    <View style={s.fieldIcon}><Lucide name="home" color={C.lime} size={15}/></View>
    <View style={s.fieldCopy}><Text style={s.fieldLabel}>WHAT</Text><TextInput value={query} onChangeText={setQuery} style={s.input} placeholder="Apartment, townhome, amenity" placeholderTextColor={C.muted}/></View>
   </View>
   <View style={s.searchRow}>
    <View style={s.fieldIcon}><Lucide name="map-pin" color={C.lime} size={15}/></View>
    <View style={s.fieldCopy}><Text style={s.fieldLabel}>WHERE</Text><TextInput value={location} onChangeText={setLocation} style={s.input} placeholder="City, state or ZIP" placeholderTextColor={C.muted}/></View>
   </View>
   <Pressable style={s.primary} onPress={()=>void run()}><Text style={s.primaryText}>SEARCH HOUSING</Text><Lucide name="arrow-right" color={C.black} size={16}/></Pressable>
  </View>

  <View style={s.filtersHead}><Text style={s.filtersLabel}>QUICK FILTERS</Text><Text style={s.filtersHint}>{filterCount?filterCount+' ACTIVE':'Refine your search'}</Text></View>
  <View style={s.filtersStrip}>
   <View style={s.filterCell}><SharpChip label="2+ beds" active={twoPlus} onPress={()=>setTwoPlus(v=>!v)}/></View>
   <View style={s.filterCell}><SharpChip label="FastTrack" active={fastTrack} onPress={()=>setFastTrack(v=>!v)}/></View>
   <Pressable style={s.allFilters} onPress={()=>router.push(('/housing-filters?'+[
    params.minRent?'minRent='+encodeURIComponent(params.minRent):'',
    params.maxRent?'maxRent='+encodeURIComponent(params.maxRent):'',
    (twoPlus?'beds=2+':params.beds)?'beds='+encodeURIComponent(twoPlus?'2+':params.beds!):'',
    params.baths?'baths='+encodeURIComponent(params.baths):'',
    params.types?'types='+encodeURIComponent(params.types):'',
    fastTrack?'fastTrack=1':'',
    params.pets==='1'?'pets=1':'',
    params.accessible==='1'?'accessible=1':'',
    params.garage==='1'?'garage=1':'',params.parking==='1'?'parking=1':'',params.furnished==='1'?'furnished=1':'',params.basement==='1'?'basement=1':'',
    params.yard==='1'?'yard=1':'',params.balcony==='1'?'balcony=1':'',params.laundry==='1'?'laundry=1':'',params.centralAir==='1'?'centralAir=1':'',
    params.moveInReady==='1'?'moveInReady=1':'',params.minSqft?'minSqft='+encodeURIComponent(params.minSqft):'',params.minWalk?'minWalk='+encodeURIComponent(params.minWalk):''
   ].filter(Boolean).join('&')) as never)}>
    <Lucide name="sliders-horizontal" color={C.lime} size={13}/>
    <Text style={s.allFiltersText}>FILTERS{filterCount?' · '+filterCount:''}</Text>
   </Pressable>
  </View>

  <View style={s.searchActions}>
   <Pressable style={s.searchAction} onPress={()=>void saveCurrentSearch()}><Lucide name="bookmark-plus" color={C.lime} size={13}/><Text style={s.searchActionText}>SAVE SEARCH</Text></Pressable>
   {signedIn?<Pressable style={s.searchAction} onPress={()=>router.push('/saved-housing-searches' as never)}><Lucide name="history" color={C.lime} size={13}/><Text style={s.searchActionText}>SAVED SEARCHES</Text></Pressable>:null}
  </View>
  <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
   <View style={s.resultsTop}><Text style={s.results}>{loading?'SEARCHING':String(visible.length)+' RESULTS'}</Text><Pressable style={s.sortButton} onPress={cycleSort}><Lucide name="arrow-up-down" color={C.lime} size={11}/><Text style={s.sort}>{sortLabel}</Text></Pressable></View>
   {error?<Text style={s.error}>{error}</Text>:null}
   {!loading&&visible.length===0?<View style={s.empty}><Text style={s.emptyTitle}>No homes match this search.</Text><Text style={s.emptyBody}>Try a wider location, a different keyword, or remove a filter.</Text></View>:null}

   {!loading?visible.map((h,index)=>{
    const photo=h.housing_media?.filter(m=>m.media_type==='photo').sort((a,b)=>a.sort_order-b.sort_order)[0]?.url||demoHousingImage(index);
    const isSaved=Boolean(saved[h.id]);
    return <Pressable key={h.id} style={s.card} onPress={()=>router.push(('/housing/'+h.id) as never)}>
     <View style={s.media}>
      {photo?<Image source={{uri:photo}} style={s.photo}/>:<View style={s.noPhoto}><Text style={s.noPhotoText}>NO PHOTO AVAILABLE</Text></View>}
      <Pressable accessibilityRole="button" accessibilityLabel={isSaved?'Remove saved home':'Save home'} style={[s.saveBtn,isSaved&&s.saveBtnActive]} onPress={e=>{e.stopPropagation?.();void toggleSave(h.id)}}>
       <Lucide name={isSaved?'bookmark-check':'bookmark'} color={isSaved?C.black:C.white} size={15}/>
      </Pressable>
     </View>

     <View style={s.body}>
      <View style={s.priceRow}><Text style={s.price}>{'$'+Number(h.rent_monthly).toLocaleString()}</Text><Text style={s.per}> / month</Text></View>
      <Text style={s.homeTitle}>{h.title}</Text>
      <Text style={s.meta}>{[h.bedrooms!=null?h.bedrooms+' bd':null,h.bathrooms!=null?h.bathrooms+' ba':null,h.square_feet?h.square_feet.toLocaleString()+' sq ft':null].filter(Boolean).join(' · ')}</Text>
      <View style={s.locationRow}><Lucide name="map-pin" color={C.muted} size={12}/><Text style={s.location}>{[h.city,h.state,h.postal_code].filter(Boolean).join(', ')}</Text></View>
      <View style={s.badges}>{h.fasttrack_enabled?<InlineBadge tone="lime">FASTTRACK AVAILABLE</InlineBadge>:null}<InlineBadge>{h.property_type.toUpperCase()}</InlineBadge></View>
      <View style={s.footer}><View><Text style={s.sourceLabel}>SOURCE</Text><Text style={s.source}>{h.source_label||'FairPath'}</Text></View><View style={s.viewRow}><Text style={s.viewText}>VIEW HOME</Text><Lucide name="arrow-right" color={C.lime} size={13}/></View></View>
     </View>
    </Pressable>
   }):null}
  </ScrollView>
 </ScreenFrame>;
}

const s=StyleSheet.create({
 utilityRow:{height:44,flexDirection:'row',borderBottomWidth:1,borderBottomColor:C.borderStrong},utilityBtn:{flex:1,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:C.borderStrong},utilityInfo:{flex:1,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'},utilityText:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 searchBlock:{paddingHorizontal:L.mobileGutter,paddingTop:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 searchRow:{minHeight:58,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',marginBottom:8},fieldIcon:{width:42,alignItems:'center',justifyContent:'center'},fieldCopy:{flex:1,minWidth:0,paddingVertical:9},fieldLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1.25,marginBottom:2},input:{color:C.white,fontFamily:F.medium,fontSize:13,paddingVertical:2,paddingHorizontal:0},
 primary:{height:44,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:2},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:1},
 filtersHead:{paddingHorizontal:L.mobileGutter,paddingTop:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},filtersLabel:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1},filtersHint:{color:C.muted,fontFamily:F.medium,fontSize:9},
 filtersStrip:{height:52,paddingHorizontal:L.mobileGutter,paddingVertical:9,flexDirection:'row',gap:7},filterCell:{flex:1},allFilters:{flex:1.15,height:34,borderWidth:1,borderColor:'#526F2B',backgroundColor:'#10150C',flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'},allFiltersText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.7},
 searchActions:{paddingHorizontal:L.mobileGutter,paddingVertical:8,borderTopWidth:1,borderBottomWidth:1,borderColor:C.border,flexDirection:'row',gap:8},searchAction:{flex:1,minHeight:36,borderWidth:1,borderColor:C.borderStrong,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'},searchActionText:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7},
 list:{paddingHorizontal:L.mobileGutter,paddingBottom:30},resultsTop:{height:46,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},results:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1},sortButton:{flexDirection:'row',gap:5,alignItems:'center'},sort:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 card:{borderTopWidth:1,borderTopColor:C.borderStrong,paddingVertical:18},media:{height:180,position:'relative',backgroundColor:'#0A0C0A',borderWidth:1,borderColor:C.borderStrong,overflow:'hidden'},photo:{width:'100%',height:'100%'},noPhoto:{flex:1,alignItems:'center',justifyContent:'center'},noPhotoText:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2},
 saveBtn:{position:'absolute',right:8,top:8,width:34,height:34,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#090A09DD',alignItems:'center',justifyContent:'center'},saveBtnActive:{backgroundColor:C.lime,borderColor:C.lime},
 body:{paddingTop:13},priceRow:{flexDirection:'row',alignItems:'baseline'},price:{color:C.white,fontFamily:F.black,fontSize:25},per:{color:C.muted,fontSize:11},homeTitle:{color:C.white,fontFamily:F.extraBold,fontSize:19,lineHeight:22,marginTop:4},meta:{color:C.mutedStrong,fontSize:12,marginTop:7},locationRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:7},location:{color:C.muted,fontSize:11},badges:{flexDirection:'row',gap:6,flexWrap:'wrap',marginTop:11},
 footer:{marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sourceLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},source:{color:C.mutedStrong,fontSize:9,marginTop:3},viewRow:{flexDirection:'row',alignItems:'center',gap:6},viewText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 empty:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:28},emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18},emptyBody:{color:C.muted,fontSize:13,lineHeight:20,marginTop:7},error:{color:C.danger,fontSize:12,paddingVertical:12}
});