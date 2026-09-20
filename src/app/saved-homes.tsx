import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { HousingListing, loadSavedHousing, unsaveHousing } from '@/core/opportunities/opportunity-service';
import { demoHousingImage } from '@/core/demo/demo-media';

export default function SavedHomes(){
 const [rows,setRows]=useState<HousingListing[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(()=>{setLoading(true);setError('');loadSavedHousing().then(setRows).catch(e=>setError(e?.message==='SIGNED_OUT'?'Sign in to see your saved homes.':'Saved homes could not be loaded.')).finally(()=>setLoading(false))},[]);
 useFocusEffect(useCallback(()=>{load()},[load]));
 async function remove(id:string){try{await unsaveHousing(id);setRows(v=>v.filter(x=>x.id!==id))}catch{}}
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Saved homes" backTo="/me"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.introRow}><Text style={s.intro}>Homes you bookmarked for another look.</Text><Pressable onPress={()=>router.push('/saved-housing-searches' as never)}><Text style={s.searches}>SAVED SEARCHES →</Text></Pressable></View>
   {loading?<State text="Loading saved homes…"/>:error?<State text={error}/>:rows.length===0?<View style={s.empty}><Text style={s.emptyTitle}>NO SAVED HOMES YET</Text><Text style={s.emptyBody}>Save homes from Housing and they will stay organized here.</Text><Pressable style={s.action} onPress={()=>router.push('/find-housing' as never)}><Text style={s.actionText}>BROWSE HOUSING</Text></Pressable></View>:rows.map((h,index)=>{
    const photo=h.housing_media?.filter(m=>m.media_type==='photo').sort((a,b)=>a.sort_order-b.sort_order)[0]?.url||demoHousingImage(index);
    return <Pressable key={h.id} style={s.card} onPress={()=>router.push(('/housing/'+h.id) as never)}>
     <View style={s.media}><Image source={{uri:photo}} style={s.photo}/><Pressable style={s.remove} accessibilityLabel="Remove saved home" onPress={e=>{e.stopPropagation?.();void remove(h.id)}}><Lucide name="bookmark-x" color={C.white} size={14}/></Pressable></View>
     <View style={s.top}><Text style={s.price}>{'$'+Number(h.rent_monthly).toLocaleString()}<Text style={s.month}> / mo</Text></Text>{h.fasttrack_enabled?<InlineBadge tone="lime">FASTTRACK</InlineBadge>:null}</View>
     <Text style={s.title}>{h.title}</Text>
     <Text style={s.meta}>{[h.bedrooms!=null?h.bedrooms+' bd':null,h.bathrooms!=null?h.bathrooms+' ba':null,h.square_feet?h.square_feet.toLocaleString()+' sq ft':null].filter(Boolean).join(' · ')}</Text>
     <Text style={s.location}>{h.city}, {h.state}</Text>
     <View style={s.openRow}><Text style={s.open}>VIEW HOME</Text><Lucide name="arrow-right" color={C.lime} size={13}/></View>
    </Pressable>
   })}
  </ScrollView>
 </ScreenFrame>
}
function State({text}:{text:string}){return <View style={s.state}><Text style={s.stateText}>{text}</Text></View>}
const s=StyleSheet.create({content:{paddingHorizontal:L.mobileGutter,paddingBottom:36},introRow:{paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.border},intro:{color:C.mutedStrong,fontSize:11,lineHeight:17},searches:{color:C.lime,fontFamily:F.extraBold,fontSize:7.5,letterSpacing:.7,marginTop:8},state:{paddingVertical:40,alignItems:'center'},stateText:{color:C.mutedStrong,fontSize:12},empty:{paddingVertical:34},emptyTitle:{color:C.white,fontFamily:F.black,fontSize:18},emptyBody:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginTop:7},action:{height:44,backgroundColor:C.lime,alignItems:'center',justifyContent:'center',marginTop:18},actionText:{color:C.black,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},card:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},media:{height:150,borderWidth:1,borderColor:C.borderStrong,position:'relative',overflow:'hidden',backgroundColor:'#0A0C0A'},photo:{width:'100%',height:'100%'},remove:{position:'absolute',right:8,top:8,width:34,height:34,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#090A09DD',alignItems:'center',justifyContent:'center'},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:12},price:{color:C.white,fontFamily:F.black,fontSize:22},month:{color:C.mutedStrong,fontFamily:F.regular,fontSize:10},title:{color:C.white,fontFamily:F.extraBold,fontSize:16,marginTop:7},meta:{color:C.mutedStrong,fontSize:10,marginTop:7},location:{color:C.muted,fontSize:10,marginTop:5},openRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:12},open:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8}});
