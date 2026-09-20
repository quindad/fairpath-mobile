import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { deleteSavedHousingSearch, loadSavedHousingSearches, SavedHousingSearch } from '@/core/opportunities/opportunity-service';

export default function SavedHousingSearches(){
 const [rows,setRows]=useState<SavedHousingSearch[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(()=>{setLoading(true);setError('');loadSavedHousingSearches().then(setRows).catch(e=>setError(e?.message==='SIGNED_OUT'?'Sign in to see saved searches.':'Saved searches could not be loaded.')).finally(()=>setLoading(false))},[]);
 useFocusEffect(useCallback(()=>{load()},[load]));
 function open(x:SavedHousingSearch){
  const q=new URLSearchParams();
  if(x.query)q.set('search',x.query);
  if(x.location)q.set('location',x.location);
  Object.entries(x.filters??{}).forEach(([k,v])=>{if(v!==''&&v!==false&&v!=null)q.set(k,String(v))});
  router.push(('/find-housing?'+q.toString()) as never);
 }
 function remove(x:SavedHousingSearch){Alert.alert('Delete saved search?','This removes the saved search from your account.',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive',onPress:async()=>{try{await deleteSavedHousingSearch(x.id);setRows(v=>v.filter(r=>r.id!==x.id))}catch{Alert.alert('Could not delete','Please try again.')}}}])}
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Saved searches" backTo="/find-housing"/>
  <ScrollView contentContainerStyle={s.content}>
   <Text style={s.intro}>Save searches you want to return to. Alert delivery is not turned on until FairPath notification delivery is connected.</Text>
   {loading?<State text="Loading saved searches…"/>:error?<State text={error}/>:rows.length===0?<View style={s.empty}><Text style={s.emptyTitle}>NO SAVED SEARCHES</Text><Text style={s.emptyBody}>Run a housing search and tap Save search to keep the filters.</Text><Pressable style={s.primary} onPress={()=>router.push('/find-housing' as never)}><Text style={s.primaryText}>FIND HOUSING</Text></Pressable></View>:rows.map(x=><View key={x.id} style={s.card}>
    <Pressable style={s.cardMain} onPress={()=>open(x)}><Text style={s.name}>{x.name}</Text><Text style={s.meta}>{[x.query||null,x.location||null].filter(Boolean).join(' · ')||'All housing'}</Text><Text style={s.filters}>{Object.keys(x.filters??{}).length?Object.entries(x.filters).filter(([,v])=>v!==''&&v!==false).slice(0,4).map(([k,v])=>k.toUpperCase()+': '+String(v)).join(' · '):'No extra filters'}</Text><View style={s.open}><Text style={s.openText}>RUN SEARCH</Text><Lucide name="arrow-right" color={C.lime} size={13}/></View></Pressable>
    <Pressable style={s.delete} onPress={()=>remove(x)}><Lucide name="trash-2" color={C.mutedStrong} size={14}/></Pressable>
   </View>)}
  </ScrollView>
 </ScreenFrame>
}
function State({text}:{text:string}){return <View style={s.state}><Text style={s.stateText}>{text}</Text></View>}
const s=StyleSheet.create({content:{paddingHorizontal:L.mobileGutter,paddingBottom:40},intro:{color:C.mutedStrong,fontSize:11,lineHeight:17,paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.border},state:{paddingVertical:40,alignItems:'center'},stateText:{color:C.mutedStrong},empty:{paddingVertical:30},emptyTitle:{color:C.white,fontFamily:F.black,fontSize:18},emptyBody:{color:C.mutedStrong,fontSize:10,lineHeight:16,marginTop:6},primary:{height:46,backgroundColor:C.lime,alignItems:'center',justifyContent:'center',marginTop:18},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},card:{borderBottomWidth:1,borderBottomColor:C.borderStrong,flexDirection:'row',alignItems:'stretch'},cardMain:{flex:1,paddingVertical:17,paddingRight:12},name:{color:C.white,fontFamily:F.extraBold,fontSize:16},meta:{color:C.mutedStrong,fontSize:10,marginTop:5},filters:{color:C.muted,fontSize:8,lineHeight:13,marginTop:6},open:{flexDirection:'row',gap:6,alignItems:'center',marginTop:11},openText:{color:C.lime,fontFamily:F.extraBold,fontSize:7.5,letterSpacing:.8},delete:{width:42,alignItems:'center',justifyContent:'center'}});