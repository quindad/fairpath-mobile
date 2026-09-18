import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { loadFairPathReadiness } from '@/core/profile/profile-service';
import type { FairPathReadiness } from '@/core/models/readiness';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FairPathColors } from '@/constants/fairpath';

const areaCopy={
 identity:['Identity','Basic information used for autofill and nearby opportunities.'],
 employment:['Employment','Skills, education, work goals and transportation.'],
 housing:['Housing','Household, income and where you want to live.'],
 reentry:['Reentry','Release and supervision information for your FairPath Forward plan.'],
 documents:['Documents','Know what you have and what you still need.'],
 eligibility:['Eligibility','Information used to improve compatibility and program screening.'],
} as const;

export default function ProfileReadiness(){
 const [readiness,setReadiness]=useState<FairPathReadiness|null>(null);
 useEffect(()=>{let active=true;loadFairPathReadiness().then(x=>{if(active)setReadiness(x.readiness);}).catch(()=>{if(active)setReadiness(null);});return()=>{active=false;};},[]);
 const overall=readiness?.overallPercentage ?? 0;
 const areas=useMemo(()=>readiness?.areas.map(a=>[areaCopy[a.area][0],areaCopy[a.area][1],a.percentage]) ?? [],[readiness]);
 return <View style={s.screen}><StatusBar style="light"/><SafeAreaView style={s.safe}>
  <ScrollView contentContainerStyle={s.content}>
   <Pressable style={s.back} onPress={()=>router.back()}><Text style={s.backText}>←</Text></Pressable>
   <Text style={s.kicker}>FAIRPATH READINESS</Text><Text style={s.title}>YOUR PROFILE{String.fromCharCode(10)}<Text style={s.lime}>UNLOCKS MORE.</Text></Text>
   <Text style={s.body}>Complete your FairPath so we can improve matching, reuse confirmed information in applications and screen for relevant programs.</Text>
   <View style={s.overall}><View style={s.overallTop}><Text style={s.overallTitle}>Overall readiness</Text><Text style={s.percent}>{overall}%</Text></View><View style={s.track}><View style={[s.fill,{width:`${overall}%`}]}/></View><Text style={s.note}>We’ll only ask follow-up questions that apply to you.</Text></View>
   <Text style={s.section}>COMPLETE YOUR FAIRPATH</Text>
   {areas.map(([title,body,pct])=><Pressable key={String(title)} style={s.card} onPress={()=>router.push('/onboarding' as never)}><View style={s.cardTop}><Text style={s.cardTitle}>{title}</Text><Text style={s.cardPct}>{pct}%</Text></View><Text style={s.cardBody}>{body}</Text><View style={s.cardBottom}><Text style={s.continue}>Continue section</Text><Text style={s.arrow}>→</Text></View></Pressable>)}
   <View style={s.privacy}><Text style={s.privacyTitle}>YOUR INFORMATION, USED WITH PURPOSE.</Text><Text style={s.privacyBody}>Sensitive justice-history information is used for permitted FairPath screening and is not automatically displayed as a general partner-visible profile field.</Text></View>
  </ScrollView>
 </SafeAreaView></View>
}
const LIME=FairPathColors.lime,BLACK=FairPathColors.black,CARD=FairPathColors.card,MUTED=FairPathColors.muted;
const s=StyleSheet.create({screen:{flex:1,backgroundColor:BLACK},safe:{flex:1},content:{width:'100%',maxWidth:700,alignSelf:'center',padding:24,paddingBottom:70},back:{width:44,height:44,borderRadius:14,borderWidth:1,borderColor:'#303330',backgroundColor:CARD,alignItems:'center',justifyContent:'center',marginBottom:52},backText:{color:'#fff',fontSize:22},kicker:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:10,letterSpacing:2},title:{color:'#fff',fontFamily:'LeagueSpartan_900Black',fontSize:45,lineHeight:42,letterSpacing:-1.8,marginTop:14},lime:{color:LIME},body:{color:MUTED,fontSize:15,lineHeight:23,marginTop:18,maxWidth:590},overall:{backgroundColor:'#111611',borderWidth:1,borderColor:'#3B4B2E',borderRadius:22,padding:20,marginTop:26},overallTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},overallTitle:{color:'#fff',fontFamily:'LeagueSpartan_800ExtraBold',fontSize:18},percent:{color:LIME,fontFamily:'LeagueSpartan_900Black',fontSize:25},track:{height:8,backgroundColor:'#293028',borderRadius:8,overflow:'hidden',marginTop:15},fill:{height:'100%',backgroundColor:LIME},note:{color:MUTED,fontSize:12,marginTop:12},section:{color:'#777D77',fontFamily:'LeagueSpartan_800ExtraBold',fontSize:10,letterSpacing:2,marginTop:32,marginBottom:12},card:{backgroundColor:CARD,borderWidth:1,borderColor:'#2C302C',borderRadius:20,padding:19,marginBottom:10},cardTop:{flexDirection:'row',justifyContent:'space-between'},cardTitle:{color:'#fff',fontFamily:'LeagueSpartan_800ExtraBold',fontSize:19},cardPct:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:14},cardBody:{color:MUTED,fontSize:13,lineHeight:19,marginTop:7,paddingRight:20},cardBottom:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:15},continue:{color:'#DDE2DA',fontFamily:'LeagueSpartan_700Bold',fontSize:12},arrow:{color:LIME,fontSize:20},privacy:{borderRadius:20,backgroundColor:'#0E100E',borderWidth:1,borderColor:'#292D29',padding:18,marginTop:12},privacyTitle:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:9,letterSpacing:1.4},privacyBody:{color:MUTED,fontSize:12,lineHeight:18,marginTop:8}});
