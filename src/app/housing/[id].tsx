import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { isHousingSaved, loadHousingListing, loadMyHousingApplication, saveHousing, startHousingApplication, unsaveHousing, type HousingApplicationStatus, type HousingListing } from '@/core/opportunities/opportunity-service';
import { demoHousingGallery } from '@/core/demo/demo-media';
import { supabase } from '@/lib/supabase';

const STATUS_LABEL:Record<HousingApplicationStatus,string>={
 started:'APPLICATION STARTED',submitted:'SUBMITTED',reviewing:'UNDER REVIEW',tour:'TOUR',approved:'APPROVED',denied:'NOT APPROVED',withdrawn:'WITHDRAWN'
};

export default function HousingDetail(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [item,setItem]=useState<HousingListing|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [saved,setSaved]=useState(false);
 const [applicationStatus,setApplicationStatus]=useState<HousingApplicationStatus|null>(null);
 const [starting,setStarting]=useState(false);
 const [galleryIndex,setGalleryIndex]=useState(0);
 const [galleryWidth,setGalleryWidth]=useState(0);
 const galleryRef=useRef<ScrollView|null>(null);

 useEffect(()=>{
  if(!id)return;
  loadHousingListing(id).then(setItem).catch(()=>setError('This home could not be loaded.')).finally(()=>setLoading(false));
 },[id]);

 useFocusEffect(useCallback(()=>{
  if(!id)return;
  let active=true;
  isHousingSaved(id).then(v=>{if(active)setSaved(v)}).catch(()=>{});
  loadMyHousingApplication(id).then(v=>{if(active)setApplicationStatus(v?.status??null)}).catch(()=>{});
  return()=>{active=false};
 },[id]));

 async function toggleSave(){
  if(!item)return;
  try{
   if(saved){await unsaveHousing(item.id);setSaved(false)}
   else{await saveHousing(item.id);setSaved(true)}
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){router.push(('/sign-up?returnTo='+encodeURIComponent('/housing/'+item.id)) as never);return}
   Alert.alert('Could not update saved home','Please try again.');
  }
 }

 async function startApplication(){
  if(!item||starting)return;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){router.push(('/sign-up?returnTo='+encodeURIComponent('/housing/'+item.id)) as never);return}
  if(applicationStatus){Alert.alert('Application already started','This home is already in your housing application history.');return}
  setStarting(true);
  try{
   const application=await startHousingApplication(item.id,item.fasttrack_enabled);
   setApplicationStatus(application.status);
   Alert.alert('Application started',item.fasttrack_enabled?'Your FastTrack application workspace is started. Nothing has been submitted or charged yet.':'Your housing application workspace is started. Nothing has been submitted yet.');
  }catch{Alert.alert('Could not start application','Please try again.')}
  finally{setStarting(false)}
 }

 async function openUrl(url:string|null){
  if(!url)return;
  try{await Linking.openURL(url)}catch{Alert.alert('Link unavailable','We could not open this link.')}
 }

 if(loading)return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Home details" backTo="/find-housing"/><View style={s.state}><Text style={s.muted}>Loading home…</Text></View></ScreenFrame>;
 if(error||!item)return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Home details" backTo="/find-housing"/><View style={s.state}><Text style={s.error}>{error||'Home not found.'}</Text></View></ScreenFrame>;

 const realPhotos=item.housing_media?.filter(m=>m.media_type==='photo').sort((a,b)=>a.sort_order-b.sort_order).map(m=>m.url).filter(Boolean)??[];
 const demoIndex=[...item.id].reduce((sum,ch)=>sum+ch.charCodeAt(0),0)%3;
 const photos=realPhotos.length?realPhotos:demoHousingGallery(demoIndex);
 const usingDemoPhotos=realPhotos.length===0;
 const location=[item.address_line1,item.city,item.state,item.postal_code].filter(Boolean).join(', ');
 const availability=item.available_date?new Date(item.available_date+'T00:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):null;

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Home details" backTo="/find-housing" trailing={
   <Pressable style={[s.save,saved&&s.saveActive]} onPress={()=>void toggleSave()}>
    <Lucide name={saved?'bookmark-check':'bookmark'} color={saved?C.black:C.white} size={14}/><Text style={[s.saveText,saved&&s.saveTextActive]}>{saved?'SAVED':'SAVE'}</Text>
   </Pressable>
  }/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.gallery} onLayout={e=>setGalleryWidth(e.nativeEvent.layout.width)}>
    {galleryWidth>0?<ScrollView
     ref={galleryRef}
     horizontal pagingEnabled showsHorizontalScrollIndicator={false}
     onMomentumScrollEnd={e=>setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x/galleryWidth))}
    >
     {photos.map((url,index)=><Image key={url+index} source={{uri:url}} style={[s.hero,{width:galleryWidth}]}/>)}
    </ScrollView>:null}
    <View style={s.photoCount}><Lucide name="images" color={C.white} size={12}/><Text style={s.photoCountText}>{galleryIndex+1} / {photos.length}</Text></View>
    {usingDemoPhotos?<View style={s.demoFlag}><Text style={s.demoFlagText}>DEMO GALLERY</Text></View>:null}
   </View>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>
    {photos.map((url,index)=><Pressable key={'thumb-'+url+index} onPress={()=>{setGalleryIndex(index);galleryRef.current?.scrollTo({x:index*galleryWidth,animated:true})}} style={[s.thumbWrap,galleryIndex===index&&s.thumbActive]}><Image source={{uri:url}} style={s.thumb}/></Pressable>)}
   </ScrollView>

   <View style={s.intro}>
    <Text style={s.price}>{'$'+Number(item.rent_monthly).toLocaleString()} <Text style={s.month}>/ month</Text></Text>
    <Text style={s.title}>{item.title}</Text>
    <Text style={s.meta}>{[item.bedrooms!=null?item.bedrooms+' bd':null,item.bathrooms!=null?item.bathrooms+' ba':null,item.square_feet?item.square_feet.toLocaleString()+' sq ft':null].filter(Boolean).join(' · ')}</Text>
    <View style={s.locationRow}><Lucide name="map-pin" color={C.muted} size={13}/><Text style={s.location}>{location}</Text></View>
    <View style={s.badges}>
     {item.fasttrack_enabled?<InlineBadge tone="lime">FASTTRACK AVAILABLE</InlineBadge>:null}
     {applicationStatus?<InlineBadge tone="lime">{STATUS_LABEL[applicationStatus]}</InlineBadge>:null}
     <InlineBadge>{item.property_type.toUpperCase()}</InlineBadge>
    </View>
   </View>

   <View style={s.facts}>
    {item.deposit_amount!=null?<Fact label="DEPOSIT" value={'$'+Number(item.deposit_amount).toLocaleString()}/>:null}
    {item.application_fee!=null?<Fact label="APPLICATION FEE" value={'$'+Number(item.application_fee).toLocaleString()}/>:null}
    {availability?<Fact label="AVAILABLE" value={availability}/>:null}
   </View>

   <Section label="ABOUT THIS HOME"><Text style={s.body}>{item.description}</Text></Section>
   {item.screening_summary?<Section label="SCREENING"><Text style={s.body}>{item.screening_summary}</Text></Section>:null}
   {item.lease_terms?.length?<Section label="LEASE TERMS"><Text style={s.body}>{item.lease_terms.join(' · ')}</Text></Section>:null}
   {item.amenities?.length?<Section label="AMENITIES"><Text style={s.body}>{item.amenities.join(' · ')}</Text></Section>:null}
   {item.utilities_included?.length?<Section label="UTILITIES INCLUDED"><Text style={s.body}>{item.utilities_included.join(' · ')}</Text></Section>:null}
   {item.pet_policy?<Section label="PET POLICY"><Text style={s.body}>{item.pet_policy}</Text></Section>:null}
   {item.parking?<Section label="PARKING"><Text style={s.body}>{item.parking}</Text></Section>:null}
   {item.accessibility_features?.length?<Section label="ACCESSIBILITY"><Text style={s.body}>{item.accessibility_features.join(' · ')}</Text></Section>:null}
   {(item.garage_spaces||item.parking_types?.length||item.furnished||item.has_basement||item.has_yard||item.has_balcony_patio||item.laundry_type||item.has_central_air)?<Section label="HOME DETAILS"><Text style={s.body}>{[
    item.garage_spaces?item.garage_spaces+'-car garage':null,
    item.parking_types?.length?item.parking_types.join(', '):null,
    item.furnished?'Furnished':null,item.has_basement?'Basement':null,item.has_yard?'Yard / outdoor space':null,item.has_balcony_patio?'Balcony / patio':null,
    item.laundry_type?'Laundry: '+item.laundry_type:null,item.has_central_air?'Central air':null
   ].filter(Boolean).join(' · ')}</Text></Section>:null}
   {(item.walk_score!=null||item.transit_score!=null||item.bike_score!=null)?<Section label="AROUND THIS HOME">
    <View style={s.scoreRow}>
     {item.walk_score!=null?<Score label="WALK" value={item.walk_score}/>:null}
     {item.transit_score!=null?<Score label="TRANSIT" value={item.transit_score}/>:null}
     {item.bike_score!=null?<Score label="BIKE" value={item.bike_score}/>:null}
    </View>
    <Text style={s.sourceNote}>Mobility scores are shown only when verified provider data is available.</Text>
   </Section>:null}

   {item.virtual_tour_url||item.floor_plan_url||item.video_url?<View style={s.links}>
    <Text style={s.sectionLabel}>PROPERTY MEDIA</Text>
    {item.virtual_tour_url?<LinkRow label="VIRTUAL TOUR" onPress={()=>void openUrl(item.virtual_tour_url)}/>:null}
    {item.floor_plan_url?<LinkRow label="FLOOR PLAN" onPress={()=>void openUrl(item.floor_plan_url)}/>:null}
    {item.video_url?<LinkRow label="VIDEO" onPress={()=>void openUrl(item.video_url)}/>:null}
   </View>:null}

   <View style={s.source}><Text style={s.sourceLabel}>SOURCE</Text><Text style={s.sourceText}>{item.source_label||'FairPath'}</Text>{item.source_url?<Pressable onPress={()=>void openUrl(item.source_url)}><Text style={s.sourceLink}>VIEW ORIGINAL LISTING ↗</Text></Pressable>:null}</View>

   <View style={s.notice}>
    <Lucide name="shield-check" color={C.lime} size={16}/>
    <Text style={s.noticeText}>{item.fasttrack_enabled?'Starting FastTrack creates your application workspace only. Payment and final submission require a separate confirmation step.':'Starting an application does not submit anything to a property owner until you complete and confirm it.'}</Text>
   </View>

   <Pressable style={[s.primary,(starting||Boolean(applicationStatus))&&s.primaryMuted]} onPress={()=>void startApplication()} disabled={starting}>
    <Text style={[s.primaryText,applicationStatus&&s.primaryTextMuted]}>{starting?'STARTING…':applicationStatus?STATUS_LABEL[applicationStatus]:item.fasttrack_enabled?'START FASTTRACK APPLICATION':'START APPLICATION'}</Text>
    <Lucide name={applicationStatus?'check':'arrow-right'} color={applicationStatus?C.mutedStrong:C.black} size={16}/>
   </Pressable>
  </ScrollView>
 </ScreenFrame>;
}

function Fact({label,value}:{label:string;value:string}){return <View style={s.fact}><Text style={s.factLabel}>{label}</Text><Text style={s.factValue}>{value}</Text></View>}
function Section({label,children}:{label:string;children:React.ReactNode}){return <View style={s.section}><Text style={s.sectionLabel}>{label}</Text>{children}</View>}
function Score({label,value}:{label:string;value:number}){return <View style={s.score}><Text style={s.scoreValue}>{value}</Text><Text style={s.scoreLabel}>{label}</Text></View>}
function LinkRow({label,onPress}:{label:string;onPress:()=>void}){return <Pressable style={s.linkRow} onPress={onPress}><Text style={s.linkText}>{label}</Text><Lucide name="external-link" color={C.lime} size={14}/></Pressable>}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:16,paddingBottom:36},state:{padding:L.mobileGutter},muted:{color:C.muted},error:{color:C.danger},
 save:{height:34,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:9,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center'},saveActive:{backgroundColor:C.lime,borderColor:C.lime},saveText:{color:C.white,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},saveTextActive:{color:C.black},
 scoreRow:{flexDirection:'row',gap:8},score:{flex:1,borderWidth:1,borderColor:C.borderStrong,paddingVertical:12,alignItems:'center'},scoreValue:{color:C.white,fontFamily:F.black,fontSize:23},scoreLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1,marginTop:2},sourceNote:{color:C.muted,fontSize:9,lineHeight:14,marginTop:8},gallery:{height:230,width:'100%',backgroundColor:'#0A0C0A',borderWidth:1,borderColor:C.borderStrong,position:'relative',overflow:'hidden'},hero:{height:228,backgroundColor:'#0A0C0A'},photoCount:{position:'absolute',right:9,bottom:9,height:27,paddingHorizontal:9,backgroundColor:'#090A09DD',borderWidth:1,borderColor:C.borderStrong,flexDirection:'row',gap:6,alignItems:'center'},photoCountText:{color:C.white,fontFamily:F.extraBold,fontSize:8,letterSpacing:.5},demoFlag:{position:'absolute',left:9,top:9,height:25,paddingHorizontal:8,backgroundColor:'#090A09DD',borderWidth:1,borderColor:'#526F2B',justifyContent:'center'},demoFlagText:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},thumbs:{gap:7,paddingVertical:9},thumbWrap:{width:64,height:48,borderWidth:1,borderColor:C.borderStrong,opacity:.65},thumbActive:{borderColor:C.lime,opacity:1},thumb:{width:'100%',height:'100%'},intro:{paddingVertical:17,borderBottomWidth:1,borderBottomColor:C.borderStrong},price:{color:C.white,fontFamily:F.black,fontSize:29},month:{color:C.mutedStrong,fontFamily:F.regular,fontSize:12},title:{color:C.white,fontFamily:F.extraBold,fontSize:23,lineHeight:26,marginTop:5},meta:{color:C.mutedStrong,fontSize:12,marginTop:8},locationRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:8},location:{color:C.muted,fontSize:11,flex:1},badges:{flexDirection:'row',gap:6,flexWrap:'wrap',marginTop:12},
 facts:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:C.borderStrong},fact:{flex:1,paddingVertical:15,paddingRight:8},factLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},factValue:{color:C.white,fontFamily:F.extraBold,fontSize:12,marginTop:5},
 section:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},sectionLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginBottom:8},body:{color:C.mutedStrong,fontSize:13,lineHeight:20},
 links:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},linkRow:{height:42,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},linkText:{color:C.white,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 source:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},sourceLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},sourceText:{color:C.mutedStrong,fontSize:11,marginTop:4},sourceLink:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8,marginTop:9},
 notice:{flexDirection:'row',gap:9,paddingVertical:16},noticeText:{flex:1,color:C.mutedStrong,fontSize:9,lineHeight:14},
 primary:{height:50,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},primaryMuted:{backgroundColor:'#1A2114',borderWidth:1,borderColor:'#2C3823'},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},primaryTextMuted:{color:C.mutedStrong}
});