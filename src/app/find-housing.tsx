import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenFrame, PageHeader, FilterStrip, SharpChip, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L, FairPathRadius as R } from '@/constants/fairpath';
import { loadHousing, saveHousing, type HousingListing } from '@/core/opportunities/opportunity-service';
import { loadProfileAnswers } from '@/core/profile/profile-service';
import { openGoogleMaps } from '@/core/location/maps';
import { demoHousingImage } from '@/core/demo/demo-media';

type Lane='all'|'match'|'fast';
export default function Housing(){
 const [query,setQuery]=useState(''); const [location,setLocation]=useState(''); const [rows,setRows]=useState<HousingListing[]>([]);
 const [lane,setLane]=useState<Lane>('all'); const [tourOnly,setTourOnly]=useState(false); const [twoPlus,setTwoPlus]=useState(false); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 async function run(){setLoading(true);setError('');try{setRows(await loadHousing(query,location));}catch{setError('Housing could not load. Try again.')}finally{setLoading(false)}}
 useEffect(()=>{let active=true;loadProfileAnswers().then(a=>{if(!active)return;const v=a['identity.current_location'];if(typeof v==='string')setLocation(v);}).finally(()=>{if(active)loadHousing().then(setRows).catch(()=>setError('Housing could not load.')).finally(()=>setLoading(false));});return()=>{active=false};},[]);
 const visible=useMemo(()=>rows.filter(h=>(lane!=='fast'||h.fasttrack_enabled)&&(!tourOnly||!!h.virtual_tour_url)&&(!twoPlus||(h.bedrooms??0)>=2)),[rows,lane,tourOnly,twoPlus]);
 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Find housing"/>
  <View style={s.searchBlock}>
   <View style={s.searchRow}><Text style={s.fieldLabel}>WHAT</Text><TextInput value={query} onChangeText={setQuery} style={s.input} placeholder="Apartment, townhome, amenity" placeholderTextColor={C.muted}/></View>
   <View style={s.searchRow}><Text style={s.fieldLabel}>WHERE</Text><TextInput value={location} onChangeText={setLocation} style={s.input} placeholder="City, state or ZIP" placeholderTextColor={C.muted}/><Pressable style={s.mapBtn} onPress={()=>openGoogleMaps((location||'Columbus, OH')+' apartments')}><Text style={s.mapBtnText}>MAP</Text></Pressable></View>
   <Pressable style={s.primary} onPress={run}><Text style={s.primaryText}>Search housing</Text><Text style={s.primaryText}>→</Text></Pressable>
  </View>
  <View style={s.lanes}>
   <Pressable style={[s.lane,lane==='all'&&s.laneActive]} onPress={()=>setLane('all')}><Text style={[s.laneText,lane==='all'&&s.laneTextActive]}>ALL HOUSING</Text></Pressable>
   <Pressable style={[s.lane,lane==='match'&&s.laneActive]} onPress={()=>setLane('match')}><Text style={[s.laneText,lane==='match'&&s.laneTextActive]}>FAIRPATH MATCH</Text></Pressable>
   <Pressable style={[s.lane,lane==='fast'&&s.laneActive]} onPress={()=>setLane('fast')}><Text style={[s.laneText,lane==='fast'&&s.laneTextActive]}>FASTTRACK</Text></Pressable>
  </View>
  <FilterStrip><SharpChip label="2+ beds" active={twoPlus} onPress={()=>setTwoPlus(!twoPlus)}/><SharpChip label="3D tour" active={tourOnly} onPress={()=>setTourOnly(!tourOnly)}/><SharpChip label="Rent"/><SharpChip label="Move-in"/><SharpChip label="Pets"/><SharpChip label="Accessibility"/></FilterStrip>
  <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
   <View style={s.resultsTop}><Text style={s.results}>{loading?'SEARCHING':String(visible.length)+' RESULTS'}</Text><Text style={s.sort}>Recommended</Text></View>
   {error?<Text style={s.error}>{error}</Text>:null}
   {!loading&&visible.length===0?<View style={s.empty}><Text style={s.emptyTitle}>No homes match these filters.</Text><Text style={s.emptyBody}>Try a wider area or remove one of the filters.</Text></View>:null}
   {visible.map((h,index)=>{const photo=h.housing_media?.filter(m=>m.media_type==='photo').sort((a,b)=>a.sort_order-b.sort_order)[0]?.url || demoHousingImage(index);return <Pressable key={h.id} style={s.card} onPress={()=>router.push(('/housing/'+h.id) as never)}>
    <View style={s.media}>{photo?<Image source={{uri:photo}} style={s.photo}/>:<View style={s.noPhoto}><Text style={s.noPhotoText}>NO PHOTO</Text></View>}<Pressable style={s.saveBtn} onPress={(e)=>{e.stopPropagation?.();void saveHousing(h.id)}}><Text style={s.saveText}>SAVE</Text></Pressable></View>
    <View style={s.body}><View style={s.priceRow}><Text style={s.price}>{'$'+Number(h.rent_monthly).toLocaleString()}</Text><Text style={s.per}> / month</Text></View><Text style={s.homeTitle}>{h.title}</Text>
    <Text style={s.meta}>{[h.bedrooms!=null?h.bedrooms+' bd':null,h.bathrooms!=null?h.bathrooms+' ba':null,h.square_feet?h.square_feet.toLocaleString()+' sq ft':null].filter(Boolean).join('  ·  ')}</Text>
    <Text style={s.location}>{[h.city,h.state,h.postal_code].filter(Boolean).join(', ')}</Text>
    <View style={s.badges}>{h.fasttrack_enabled?<InlineBadge tone="lime">FASTTRACK</InlineBadge>:null}{h.virtual_tour_url?<InlineBadge>3D TOUR</InlineBadge>:null}{h.floor_plan_url?<InlineBadge>FLOOR PLAN</InlineBadge>:null}</View>
    <View style={s.footer}><Text style={s.source}>{h.source_label||'FairPath'}</Text><Text style={s.viewText}>VIEW HOME  →</Text></View></View>
   </Pressable>})}
  </ScrollView>
 </ScreenFrame>
}
const s=StyleSheet.create({
 searchBlock:{paddingHorizontal:L.mobileGutter,paddingTop:16,paddingBottom:12,borderBottomWidth:1,borderBottomColor:C.border},searchRow:{minHeight:48,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.border,backgroundColor:C.surface,marginBottom:8},
 fieldLabel:{width:58,color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1,paddingLeft:12},input:{flex:1,color:C.white,fontSize:14,paddingHorizontal:8,paddingVertical:13},mapBtn:{height:46,paddingHorizontal:12,justifyContent:'center',borderLeftWidth:1,borderLeftColor:C.border},mapBtnText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 primary:{height:46,borderRadius:R.sm,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:13},
 lanes:{flexDirection:'row',marginHorizontal:L.mobileGutter,marginTop:14,borderWidth:1,borderColor:C.border},lane:{flex:1,minHeight:46,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:C.border,paddingHorizontal:5},laneActive:{backgroundColor:C.white},laneText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.6,textAlign:'center'},laneTextActive:{color:C.black},
 list:{paddingHorizontal:L.mobileGutter,paddingBottom:28},resultsTop:{height:42,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},results:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1},sort:{color:C.mutedStrong,fontSize:11},
 card:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:16},media:{height:168,position:'relative',backgroundColor:C.surface,borderWidth:1,borderColor:C.border,overflow:'hidden'},photo:{width:'100%',height:'100%'},noPhoto:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#111411'},noPhotoText:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.5},
 saveBtn:{position:'absolute',right:8,top:8,height:30,borderRadius:R.xs,backgroundColor:'#090A09DD',borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,justifyContent:'center'},saveText:{color:C.white,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 body:{paddingTop:12},priceRow:{flexDirection:'row',alignItems:'baseline'},price:{color:C.white,fontFamily:F.black,fontSize:23},per:{color:C.muted,fontSize:11},homeTitle:{color:C.white,fontFamily:F.extraBold,fontSize:16,marginTop:4},
 meta:{color:C.mutedStrong,fontSize:12,marginTop:7},location:{color:C.muted,fontSize:12,marginTop:5},badges:{flexDirection:'row',gap:6,flexWrap:'wrap',marginTop:10},
 footer:{marginTop:13,paddingTop:11,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',justifyContent:'space-between'},source:{color:C.muted,fontSize:10},viewText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:.8},
 empty:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:28},emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18},emptyBody:{color:C.muted,fontSize:13,lineHeight:20,marginTop:7},error:{color:C.danger,fontSize:12,paddingVertical:12}
});
