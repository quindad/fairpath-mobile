import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadMyHousingApplications, MyHousingApplication } from '@/core/opportunities/opportunity-service';

const LABEL:Record<string,string>={started:'IN PROGRESS',submitted:'SUBMITTED',reviewing:'UNDER REVIEW',tour:'TOUR / NEXT STEP',approved:'APPROVED',denied:'NOT APPROVED',withdrawn:'WITHDRAWN'};

export default function HousingApplications(){
 const [rows,setRows]=useState<MyHousingApplication[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(()=>{setLoading(true);setError('');loadMyHousingApplications().then(setRows).catch(e=>setError(e?.message==='SIGNED_OUT'?'Sign in to see your housing applications.':'Applications could not be loaded.')).finally(()=>setLoading(false))},[]);
 useFocusEffect(useCallback(()=>{load()},[load]));
 const active=rows.filter(x=>!['denied','withdrawn'].includes(x.status));
 const history=rows.filter(x=>['denied','withdrawn'].includes(x.status));

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Applications" backTo="/me"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.head}><Text style={s.intro}>Draft, submit, and track every FairPath housing application in one place.</Text><Pressable style={s.find} onPress={()=>router.push('/find-housing' as never)}><Text style={s.findText}>FIND HOUSING</Text><Lucide name="arrow-right" color={C.lime} size={13}/></Pressable></View>
   {loading?<State text="Loading applications…"/>:error?<State text={error}/>:rows.length===0?<Empty/>:<>
    <Text style={s.section}>ACTIVE</Text>
    {active.length?active.map(a=><Card key={a.id} item={a}/>):<Text style={s.none}>No active applications.</Text>}
    {history.length?<><Text style={s.section}>HISTORY</Text>{history.map(a=><Card key={a.id} item={a}/>)}</>:null}
   </>}
  </ScrollView>
 </ScreenFrame>;
}
function Card({item:a}:{item:MyHousingApplication}){
 const draft=a.status==='started';
 const progress=draft?Math.max(0,Math.min(100,Math.round((Math.max(1,a.current_step)-1)/4*100))):100;
 return <Pressable style={s.card} onPress={()=>router.push(('/housing-application/'+a.id) as never)}>
  <View style={s.top}><InlineBadge tone={a.application_type==='fasttrack'?'lime':undefined}>{a.application_type==='fasttrack'?'FASTTRACK':'STANDARD'}</InlineBadge><Text style={s.status}>{LABEL[a.status]??a.status.toUpperCase()}</Text></View>
  <Text style={s.title}>{a.listing?.title??'Housing application'}</Text>
  {a.listing?<><Text style={s.price}>{'$'+Number(a.listing.rent_monthly).toLocaleString()+' / month'}</Text><Text style={s.location}>{a.listing.city}, {a.listing.state}</Text></>:null}
  {draft?<><View style={s.progressHead}><Text style={s.progressLabel}>APPLICATION PROGRESS</Text><Text style={s.progressPct}>{progress}%</Text></View><View style={s.track}><View style={[s.fill,{width:(progress+'%') as any}]}/></View></>:null}
  {a.submitted_at?<Text style={s.updated}>SUBMITTED {new Date(a.submitted_at).toLocaleDateString()}</Text>:<Text style={s.updated}>UPDATED {new Date(a.updated_at).toLocaleDateString()}</Text>}
  <View style={s.openRow}><Text style={s.open}>{draft?'CONTINUE APPLICATION':'VIEW STATUS'}</Text><Lucide name="arrow-right" color={C.lime} size={13}/></View>
 </Pressable>;
}
function Empty(){return <View style={s.empty}><Text style={s.emptyTitle}>NO HOUSING APPLICATIONS</Text><Text style={s.emptyBody}>Start an application from a home. Standard and FastTrack drafts both appear here.</Text><Pressable style={s.action} onPress={()=>router.push('/find-housing' as never)}><Text style={s.actionText}>FIND HOUSING</Text></Pressable></View>}
function State({text}:{text:string}){return <View style={s.state}><Text style={s.stateText}>{text}</Text></View>}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingBottom:36},head:{paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.border},intro:{color:C.mutedStrong,fontSize:12,lineHeight:18},find:{flexDirection:'row',gap:7,alignItems:'center',marginTop:12},findText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 state:{paddingVertical:40,alignItems:'center'},stateText:{color:C.mutedStrong,fontSize:12},section:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginTop:20,marginBottom:2},none:{color:C.muted,fontSize:10,paddingVertical:16},
 empty:{paddingVertical:34},emptyTitle:{color:C.white,fontFamily:F.black,fontSize:18},emptyBody:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginTop:7},action:{height:44,backgroundColor:C.lime,alignItems:'center',justifyContent:'center',marginTop:18},actionText:{color:C.black,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},
 card:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},top:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},status:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.7},title:{color:C.white,fontFamily:F.extraBold,fontSize:17,marginTop:10},price:{color:C.mutedStrong,fontSize:11,marginTop:7},location:{color:C.muted,fontSize:10,marginTop:4},
 progressHead:{flexDirection:'row',justifyContent:'space-between',marginTop:13},progressLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:6.5,letterSpacing:.8},progressPct:{color:C.lime,fontFamily:F.extraBold,fontSize:8},track:{height:2,backgroundColor:C.borderStrong,marginTop:5},fill:{height:2,backgroundColor:C.lime},
 updated:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7,marginTop:12},openRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:10},open:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8}
});