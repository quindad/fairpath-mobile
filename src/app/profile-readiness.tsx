import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadFairPathReadiness } from '@/core/profile/profile-service';
import type { FairPathReadiness } from '@/core/models/readiness';
const copy={identity:['Identity','Contact and basic information'],employment:['Employment','Skills, education and work preferences'],housing:['Housing','Household, income and target areas'],reentry:['Reentry','Release and supervision information'],documents:['Documents','IDs, résumé and document readiness'],eligibility:['Eligibility','Information used for compatibility screening']} as const;
export default function ProfileReadiness(){
 const [r,setR]=useState<FairPathReadiness|null>(null);useEffect(()=>{let a=true;loadFairPathReadiness().then(x=>{if(a)setR(x.readiness)}).catch(()=>{});return()=>{a=false}},[]);
 const areas=useMemo(()=>r?.areas.map(x=>[x.area,copy[x.area][0],copy[x.area][1],x.percentage] as const)??[],[r]);const overall=r?.overallPercentage??0;
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH READINESS" title="Your profile" backTo="/me"/>
 <ScrollView contentContainerStyle={s.content}>
  <View style={s.score}><View><Text style={s.scoreLabel}>OVERALL READINESS</Text><Text style={s.scoreSub}>Complete information once. Reuse it across FairPath.</Text></View><Text style={s.scoreNumber}>{overall}%</Text></View>
  <View style={s.track}><View style={[s.fill,{width:(overall+'%') as any}]}/></View>
  <Text style={s.section}>PROFILE SECTIONS</Text>
  {areas.map(([area,title,body,pct])=><Pressable key={area} style={s.row} onPress={()=>router.push({pathname:'/complete-profile',params:{area}} as never)}><View style={s.copy}><View style={s.titleLine}><Text style={s.title}>{title}</Text><Text style={s.pct}>{pct}%</Text></View><Text style={s.body}>{body}</Text><View style={s.miniTrack}><View style={[s.miniFill,{width:(pct+'%') as any}]}/></View></View><Text style={s.arrow}>→</Text></Pressable>)}
  <View style={s.privacy}><Text style={s.privacyTitle}>PRIVATE BY DESIGN</Text><Text style={s.privacyBody}>Sensitive justice-history information supports permitted screening and matching. It is not automatically displayed as a general partner-visible profile field.</Text></View>
 </ScrollView></ScreenFrame>
}
const s=StyleSheet.create({content:{paddingHorizontal:L.mobileGutter,paddingBottom:30},score:{paddingVertical:20,flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},scoreLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2},scoreSub:{color:C.muted,fontSize:11,marginTop:5,maxWidth:260},scoreNumber:{color:C.white,fontFamily:F.black,fontSize:28},track:{height:4,backgroundColor:C.border},fill:{height:'100%',backgroundColor:C.lime},section:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.2,marginTop:24,marginBottom:4},row:{minHeight:96,borderBottomWidth:1,borderBottomColor:C.border,flexDirection:'row',alignItems:'center'},copy:{flex:1,paddingRight:15},titleLine:{flexDirection:'row',justifyContent:'space-between'},title:{color:C.white,fontFamily:F.extraBold,fontSize:17},pct:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:10},body:{color:C.muted,fontSize:11,marginTop:4},miniTrack:{height:2,backgroundColor:C.border,marginTop:10},miniFill:{height:'100%',backgroundColor:C.lime},arrow:{color:C.lime,fontSize:18},privacy:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},privacyTitle:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},privacyBody:{color:C.muted,fontSize:11,lineHeight:17,marginTop:6}});
