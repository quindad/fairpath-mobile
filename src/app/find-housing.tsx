import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, SharpChip, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadHousing, loadSavedHousingIds, saveHousing, unsaveHousing, type HousingListing } from '@/core/opportunities/opportunity-service';
import { loadProfileAnswers } from '@/core/profile/profile-service';
import { demoHousingImage } from '@/core/demo/demo-media';

export default function Housing(){
 const [query,setQuery]=useState('');
 const [location,setLocation]=useState('');
 const [rows,setRows]=useState<HousingListing[]>([]);
 const [fastTrack,setFastTrack]=useState(false);
 const [twoPlus,setTwoPlus]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [saved,setSaved]=useState<Record<string,boolean>>({});

 async function run(){
  setLoading(true);setError('');
  try{setRows(await loadHousing(query,location))}
  catch{setError('Housing could not load. Check your connection and try again.')}
  finally{setLoading(false)}
 }

 useEffect(()=>{
  let active=true;
  loadProfileAnswers()
   .then(a=>{if(active&&typeof a['identity.current_location']==='string')setLocation(a['identity.current_location'] as string)})
   .finally(()=>{if(active)loadHousing().then(setRows).catch(()=>setError('Housing could not load.')).finally(()=>setLoading(false))});
  return()=>{active=false};
 },[]);

 useFocusEffect(useCallback(()=>{
  let active=true;
  loadSavedHousingIds().then(ids=>{if(active)setSaved(Object.fromEntries(ids.map(id=>[id,true])))}).catch(()=>{});
  return()=>{active=false};
 },[]));

 const visible=useMemo(()=>rows.filter(h=>(!fastTrack||h.fasttrack_enabled)&&(!twoPlus||(h.bedrooms??0)>=2)),[rows,fastTrack,twoPlus]);

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

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Find housing" backTo="/" alwaysBackTo/>

  <View style={s.utilityRow}>
   <Pressable style={s.utilityBtn} onPress={()=>router.replace('/find-jobs' as never)}>
    <Lucide name="briefcase-business" color={C.lime} size={13}/><Text style={s.utilityText}>JOBS</Text>
   </Pressable>
   <View style={s.utilityInfo}><Lucide name="house" color={C.lime} size={13}/><Text style={s.utilityText}>BROWSE WITHOUT AN ACCOUNT</Text></View>
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

  <View style={s.filtersHead}><Text style={s.filtersLabel}>FILTERS</Text><Text style={s.filtersHint}>Only working filters are shown</Text></View>
  <View style={s.filtersStrip}>
   <View style={s.filterCell}><SharpChip label="2+ beds" active={twoPlus} onPress={()=>setTwoPlus(v=>!v)}/></View>
   <View style={s.filterCell}><SharpChip label="FastTrack" active={fastTrack} onPress={()=>setFastTrack(v=>!v)}/></View>
  </View>

  <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
   <View style={s.resultsTop}><Text style={s.results}>{loading?'SEARCHING':String(visible.length)+' RESULTS'}</Text><Text style={s.sort}>FEATURED FIRST</Text></View>
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
 utilityRow:{height:44,flexDirection:'row',borderBottomWidth:1,borderBottomColor:C.borderStrong},utilityBtn:{width:100,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:C.borderStrong},utilityInfo:{flex:1,flexDirection:'row',gap:7,alignItems:'center',justifyContent:'center'},utilityText:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 searchBlock:{paddingHorizontal:L.mobileGutter,paddingTop:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 searchRow:{minHeight:58,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',marginBottom:8},fieldIcon:{width:42,alignItems:'center',justifyContent:'center'},fieldCopy:{flex:1,minWidth:0,paddingVertical:9},fieldLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1.25,marginBottom:2},input:{color:C.white,fontFamily:F.medium,fontSize:13,paddingVertical:2,paddingHorizontal:0},
 primary:{height:44,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:2},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:1},
 filtersHead:{paddingHorizontal:L.mobileGutter,paddingTop:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},filtersLabel:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1},filtersHint:{color:C.muted,fontFamily:F.medium,fontSize:9},
 filtersStrip:{height:52,paddingHorizontal:L.mobileGutter,paddingVertical:9,flexDirection:'row',gap:7},filterCell:{flex:1},
 list:{paddingHorizontal:L.mobileGutter,paddingBottom:30},resultsTop:{height:46,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},results:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1},sort:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 card:{borderTopWidth:1,borderTopColor:C.borderStrong,paddingVertical:18},media:{height:180,position:'relative',backgroundColor:'#0A0C0A',borderWidth:1,borderColor:C.borderStrong,overflow:'hidden'},photo:{width:'100%',height:'100%'},noPhoto:{flex:1,alignItems:'center',justifyContent:'center'},noPhotoText:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2},
 saveBtn:{position:'absolute',right:8,top:8,width:34,height:34,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#090A09DD',alignItems:'center',justifyContent:'center'},saveBtnActive:{backgroundColor:C.lime,borderColor:C.lime},
 body:{paddingTop:13},priceRow:{flexDirection:'row',alignItems:'baseline'},price:{color:C.white,fontFamily:F.black,fontSize:25},per:{color:C.muted,fontSize:11},homeTitle:{color:C.white,fontFamily:F.extraBold,fontSize:19,lineHeight:22,marginTop:4},meta:{color:C.mutedStrong,fontSize:12,marginTop:7},locationRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:7},location:{color:C.muted,fontSize:11},badges:{flexDirection:'row',gap:6,flexWrap:'wrap',marginTop:11},
 footer:{marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sourceLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},source:{color:C.mutedStrong,fontSize:9,marginTop:3},viewRow:{flexDirection:'row',alignItems:'center',gap:6},viewText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 empty:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:28},emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18},emptyBody:{color:C.muted,fontSize:13,lineHeight:20,marginTop:7},error:{color:C.danger,fontSize:12,paddingVertical:12}
});