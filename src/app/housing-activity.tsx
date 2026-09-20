import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { cancelHousingTourRequest, HousingInquiry, HousingTourRequest, loadMyHousingInquiries, loadMyHousingTours } from '@/core/opportunities/opportunity-service';

export default function HousingActivity(){
 const [tours,setTours]=useState<HousingTourRequest[]>([]);const [inquiries,setInquiries]=useState<HousingInquiry[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=useCallback(()=>{setLoading(true);setError('');Promise.all([loadMyHousingTours(),loadMyHousingInquiries()]).then(([a,b])=>{setTours(a);setInquiries(b)}).catch(e=>setError(e?.message==='SIGNED_OUT'?'Sign in to see your housing activity.':'Housing activity could not be loaded.')).finally(()=>setLoading(false))},[]);
 useFocusEffect(useCallback(()=>{load()},[load]));
 async function cancel(id:string){Alert.alert('Cancel tour request?','This changes your pending request to cancelled.',[{text:'Keep request',style:'cancel'},{text:'Cancel request',style:'destructive',onPress:async()=>{try{await cancelHousingTourRequest(id);await load()}catch{Alert.alert('Could not cancel','Please try again.')}}}])}
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Housing activity" backTo="/me"/><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
  {loading?<State text="Loading housing activity…"/>:error?<State text={error}/>:<>
   <Text style={s.section}>TOUR REQUESTS</Text>{tours.length?tours.map(t=><View key={t.id} style={s.card}><View style={s.top}><InlineBadge tone={t.status==='confirmed'?'lime':undefined}>{t.status.toUpperCase()}</InlineBadge><Text style={s.date}>{new Date(t.preferred_date+'T00:00:00').toLocaleDateString()}</Text></View><Text style={s.title}>{t.preferred_window.toUpperCase()}</Text>{t.note?<Text style={s.body}>{t.note}</Text>:null}{t.status==='requested'?<Pressable style={s.link} onPress={()=>void cancel(t.id)}><Text style={s.linkText}>CANCEL REQUEST</Text></Pressable>:null}</View>):<Text style={s.none}>No tour requests yet.</Text>}
   <Text style={s.section}>PROPERTY QUESTIONS</Text>{inquiries.length?inquiries.map(q=><Pressable key={q.id} style={s.card} onPress={()=>q.listing&&router.push(('/housing/'+q.listing.id) as never)}><View style={s.top}><InlineBadge tone={q.status==='responded'?'lime':undefined}>{q.status.toUpperCase()}</InlineBadge><Text style={s.date}>{new Date(q.updated_at).toLocaleDateString()}</Text></View><Text style={s.title}>{q.subject}</Text><Text style={s.body} numberOfLines={3}>{q.message}</Text>{q.listing?<Text style={s.home}>{q.listing.title} · {q.listing.city}, {q.listing.state}</Text>:null}</Pressable>):<Text style={s.none}>No property questions yet.</Text>}
  </>}
 </ScrollView></ScreenFrame>
}
function State({text}:{text:string}){return <View style={s.state}><Text style={s.stateText}>{text}</Text></View>}
const s=StyleSheet.create({content:{padding:L.mobileGutter,paddingBottom:40},state:{paddingVertical:40,alignItems:'center'},stateText:{color:C.mutedStrong},section:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginTop:16,marginBottom:4},none:{color:C.muted,fontSize:10,paddingVertical:16},card:{paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.borderStrong},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},date:{color:C.muted,fontSize:8},title:{color:C.white,fontFamily:F.extraBold,fontSize:15,marginTop:9},body:{color:C.mutedStrong,fontSize:10,lineHeight:16,marginTop:6},home:{color:C.lime,fontFamily:F.extraBold,fontSize:7.5,letterSpacing:.5,marginTop:9},link:{marginTop:10},linkText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7}});
