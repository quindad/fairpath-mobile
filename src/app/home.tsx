import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { loadFairPathReadiness } from '@/core/profile/profile-service';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FairPathLogo } from '@/components/FairPathLogo';
import { FairPathColors } from '@/constants/fairpath';

const LIME=FairPathColors.lime, BLACK=FairPathColors.black, CARD=FairPathColors.card, MUTED=FairPathColors.muted;

const items=[
 {title:'Find work',body:'Jobs matched to your goals and preferences.',route:'/find-jobs'},
 {title:'Find housing',body:'Housing paths and rental opportunities.',route:'/find-housing'},
 {title:'FairPath AI',body:'Get help with matches, applications and next steps.',route:'/fairpath-ai'},
 {title:'Marketplace',body:'Claim free items and manage pickups.',route:'/marketplace'},
];

export default function AppHome(){
 const pathname=usePathname();
 const [readiness,setReadiness]=useState<number|null>(null);
 const [readinessError,setReadinessError]=useState(false);
 useEffect(()=>{
  let active=true;
  loadFairPathReadiness().then(({readiness:next})=>{if(active){setReadiness(next.overallPercentage);setReadinessError(false);}}).catch(()=>{if(active)setReadinessError(true);});
  return()=>{active=false;};
 },[pathname]);
 return <View style={s.screen}><StatusBar style="light"/><SafeAreaView style={s.safe}>
  <View pointerEvents="none" style={s.glow}/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.top}><FairPathLogo width={132}/><Pressable onPress={()=>router.push('/me')} style={s.avatar}><Text style={s.avatarText}>FP</Text></Pressable></View>
   <Text style={s.kicker}>YOUR FAIRPATH</Text><Text style={s.title}>WHAT COMES{String.fromCharCode(10)}<Text style={s.lime}>NEXT.</Text></Text>
   <Text style={s.sub}>Your personalized starting point for opportunity, support and forward motion.</Text>

   <Pressable style={s.readiness} onPress={()=>router.push('/complete-profile' as never)}>
    <View style={s.readinessTop}><View><Text style={s.readinessKicker}>FAIRPATH READINESS</Text><Text style={s.readinessTitle}>Complete your profile</Text></View><Text style={s.readinessPercent}>{readinessError || readiness===null ? '—' : `${readiness}%`}</Text></View>
    <View style={s.track}><View style={[s.fill,{width:`${readiness ?? 0}%`}]}/></View>
    <Text style={s.readinessBody}>The more FairPath knows, the better we can screen jobs, housing and available programs for you.</Text>
    <View style={s.unlockRow}><Text style={s.unlock}>BETTER MATCHES</Text><Text style={s.unlock}>FASTER AUTOFILL</Text><Text style={s.unlock}>PROGRAM SCREENING</Text></View>
    <View style={s.continueRow}><Text style={s.continueText}>Continue my profile</Text><Text style={s.continueArrow}>→</Text></View>
   </Pressable>

   <View style={s.hero}><Text style={s.heroKicker}>FAIRPATH AI</Text><Text style={s.heroTitle}>Start with what you need.</Text><Text style={s.heroBody}>Tell FairPath what you’re trying to accomplish and we’ll help you find the next move.</Text><Pressable style={s.heroBtn} onPress={()=>router.push('/fairpath-ai')}><Text style={s.heroBtnText}>Ask FairPath AI</Text><Text style={s.arrow}>→</Text></Pressable></View>
   <Text style={s.section}>EXPLORE</Text><View style={s.grid}>{items.map(x=><Pressable key={x.title} style={s.card} onPress={()=>router.push(x.route as never)}><Text style={s.cardTitle}>{x.title}</Text><Text style={s.cardBody}>{x.body}</Text><Text style={s.cardArrow}>→</Text></Pressable>)}</View>
   <Pressable style={s.resource} onPress={()=>router.push('/resources')}><View><Text style={s.resourceK}>REENTRY + RESOURCES</Text><Text style={s.resourceT}>Benefits, rights & local support</Text></View><Text style={s.resourceArrow}>→</Text></Pressable>
  </ScrollView>
  <View style={s.nav}>{[['Home','/home'],['Find','/find'],['AI','/fairpath-ai'],['Market','/marketplace'],['Me','/me']].map(([label,route])=><Pressable key={label} style={s.navItem} onPress={()=>router.replace(route as never)}><Text style={[s.navText,label==='Home'&&s.navActive]}>{label}</Text></Pressable>)}</View>
 </SafeAreaView></View>
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:BLACK},safe:{flex:1},glow:{position:'absolute',width:420,height:420,borderRadius:210,backgroundColor:'#234806',opacity:.34,right:-270,top:-230},
 content:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:24,paddingTop:24,paddingBottom:120},
 top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:70},avatar:{width:44,height:44,borderRadius:14,backgroundColor:LIME,alignItems:'center',justifyContent:'center'},avatarText:{fontFamily:'LeagueSpartan_900Black',color:BLACK},
 kicker:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:11,letterSpacing:2,marginBottom:14},title:{color:'#F8F8F7',fontFamily:'LeagueSpartan_900Black',fontSize:55,lineHeight:48,letterSpacing:-2.4},lime:{color:LIME},sub:{color:MUTED,fontSize:16,lineHeight:24,maxWidth:540,marginTop:20,marginBottom:28},
 readiness:{backgroundColor:'#111611',borderWidth:1,borderColor:'#3B4B2E',borderRadius:24,padding:22,marginBottom:18},readinessTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},readinessKicker:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:9,letterSpacing:1.7},readinessTitle:{color:'#fff',fontFamily:'LeagueSpartan_900Black',fontSize:24,marginTop:7},readinessPercent:{color:LIME,fontFamily:'LeagueSpartan_900Black',fontSize:26},track:{height:8,borderRadius:8,backgroundColor:'#293028',overflow:'hidden',marginTop:18},fill:{height:'100%',backgroundColor:LIME,borderRadius:8},readinessBody:{color:MUTED,fontSize:13,lineHeight:20,marginTop:15,maxWidth:590},unlockRow:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:14},unlock:{color:'#C7D1C1',fontFamily:'LeagueSpartan_700Bold',fontSize:8,letterSpacing:.8,borderWidth:1,borderColor:'#34402F',borderRadius:20,paddingHorizontal:9,paddingVertical:6},continueRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:18,paddingTop:15,borderTopWidth:1,borderTopColor:'#293128'},continueText:{color:'#fff',fontFamily:'LeagueSpartan_800ExtraBold',fontSize:14},continueArrow:{color:LIME,fontSize:22},
 hero:{backgroundColor:'#151A11',borderWidth:1,borderColor:'#334125',borderRadius:24,padding:24,marginBottom:34},heroKicker:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:10,letterSpacing:1.8},heroTitle:{color:'#fff',fontFamily:'LeagueSpartan_900Black',fontSize:29,letterSpacing:-1,marginTop:12},heroBody:{color:MUTED,fontSize:14,lineHeight:21,marginTop:9,maxWidth:560},heroBtn:{height:56,borderRadius:15,backgroundColor:LIME,marginTop:22,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},heroBtnText:{color:BLACK,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:15},arrow:{fontSize:24,color:BLACK},
 section:{color:'#777D77',fontFamily:'LeagueSpartan_800ExtraBold',fontSize:10,letterSpacing:2,marginBottom:12},grid:{flexDirection:'row',flexWrap:'wrap',gap:12},card:{backgroundColor:CARD,borderWidth:1,borderColor:'#2C302C',borderRadius:20,padding:20,minHeight:155,flexGrow:1,flexBasis:'45%',position:'relative'},cardTitle:{color:'#fff',fontFamily:'LeagueSpartan_800ExtraBold',fontSize:20},cardBody:{color:MUTED,fontSize:13,lineHeight:19,marginTop:8,paddingRight:18},cardArrow:{position:'absolute',right:18,bottom:15,color:LIME,fontSize:22},
 resource:{minHeight:78,borderRadius:20,borderWidth:1,borderColor:'#303530',backgroundColor:CARD,marginTop:12,paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},resourceK:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:9,letterSpacing:1.4},resourceT:{color:'#fff',fontFamily:'LeagueSpartan_700Bold',fontSize:16,marginTop:5},resourceArrow:{color:LIME,fontSize:24},
 nav:{position:'absolute',bottom:0,left:0,right:0,height:78,backgroundColor:'#0D0F0D',borderTopWidth:1,borderTopColor:'#262A26',flexDirection:'row',justifyContent:'center'},navItem:{flex:1,maxWidth:150,alignItems:'center',justifyContent:'center'},navText:{color:'#777D77',fontFamily:'LeagueSpartan_700Bold',fontSize:12},navActive:{color:LIME}
});