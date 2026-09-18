import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FairPathLogo } from '@/components/FairPathLogo';
import { BottomNav } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L, FairPathRadius as R } from '@/constants/fairpath';
import { loadFairPathReadiness } from '@/core/profile/profile-service';
import { SafeAreaView } from 'react-native-safe-area-context';

const quick=[['Jobs','Search all jobs','/find-jobs'],['Housing','Browse rentals','/find-housing'],['Marketplace','Free local items','/marketplace'],['Resources','Reentry support','/resources']] as const;

export default function Home(){
 const pathname=usePathname(); const [readiness,setReadiness]=useState<number|null>(null); const [search,setSearch]=useState('');
 useEffect(()=>{let active=true;loadFairPathReadiness().then(x=>{if(active)setReadiness(x.readiness.overallPercentage)}).catch(()=>{if(active)setReadiness(null)});return()=>{active=false}},[pathname]);
 return <View style={s.screen}><SafeAreaView style={s.safe}>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.top}><FairPathLogo width={112}/><Pressable style={s.profile} onPress={()=>router.push('/me')}><Text style={s.profileText}>ME</Text></Pressable></View>

   <View style={s.hero}><Text style={s.title}>Opportunity has a <Text style={s.titleAccent}>path.</Text></Text><Text style={s.sub}>Jobs. Housing. Resources. A stronger you.</Text><View style={s.search}><Text style={s.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} onSubmitEditing={()=>router.push(('/find-jobs?search='+encodeURIComponent(search)) as never)} style={s.searchInput} placeholder="Search jobs, housing, or resources..." placeholderTextColor={C.muted}/></View><View style={s.quickPills}><Pressable style={[s.pill,s.pillActive]} onPress={()=>router.push('/find-jobs')}><Text style={s.pillActiveText}>Jobs</Text></Pressable><Pressable style={s.pill} onPress={()=>router.push('/find-housing')}><Text style={s.pillText}>Housing</Text></Pressable><Pressable style={s.pill} onPress={()=>router.push('/marketplace')}><Text style={s.pillText}>Marketplace</Text></Pressable><Pressable style={s.pill} onPress={()=>router.push('/resources')}><Text style={s.pillText}>Resources</Text></Pressable></View></View>

   <Pressable style={s.readiness} onPress={()=>router.push('/complete-profile' as never)}>
    <View style={s.readinessTop}><View><Text style={s.label}>FAIRPATH READINESS</Text><Text style={s.readinessTitle}>Complete your profile</Text></View><Text style={s.percent}>{readiness==null?'—':readiness+'%'}</Text></View>
    <View style={s.track}><View style={[s.fill,{width:(readiness??0)+'%'}]}/></View>
    <View style={s.rowBetween}><Text style={s.small}>Better matches · faster applications</Text><Text style={s.action}>CONTINUE →</Text></View>
   </Pressable>

   <View style={s.sectionHead}><Text style={s.section}>EXPLORE</Text><Pressable onPress={()=>router.push('/find')}><Text style={s.sectionAction}>VIEW ALL</Text></Pressable></View>
   <View style={s.grid}>{quick.map(([title,body,route])=><Pressable key={title} style={s.tile} onPress={()=>router.push(route as never)}><Text style={s.tileTitle}>{title}</Text><Text style={s.tileBody}>{body}</Text><Text style={s.tileArrow}>→</Text></Pressable>)}</View>

   <View style={s.ai}>
    <View style={s.aiCopy}><Text style={s.label}>FAIRPATH AI</Text><Text style={s.aiTitle}>Need help with the next move?</Text><Text style={s.aiBody}>Applications, résumés, interview prep, housing questions and your reentry plan.</Text></View>
    <Pressable style={s.aiButton} onPress={()=>router.push('/fairpath-ai')}><Text style={s.aiButtonText}>OPEN AI</Text><Text style={s.aiButtonText}>→</Text></Pressable>
   </View>
  </ScrollView>
  <BottomNav/>
 </SafeAreaView></View>
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:C.black},safe:{flex:1,width:'100%',maxWidth:L.consumerMaxWidth,alignSelf:'center'},content:{paddingHorizontal:L.mobileGutter,paddingTop:12,paddingBottom:28},
 top:{height:56,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.border,marginBottom:24},profile:{height:32,minWidth:42,borderRadius:R.xs,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},profileText:{color:C.white,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 hero:{paddingBottom:20,borderBottomWidth:1,borderBottomColor:C.border},title:{color:C.white,fontFamily:F.extraBold,fontSize:36,lineHeight:39,letterSpacing:-1.1,maxWidth:520},titleAccent:{color:C.lime},sub:{color:C.mutedStrong,fontFamily:F.regular,fontSize:12,lineHeight:18,marginTop:8,maxWidth:500},search:{height:44,marginTop:18,borderRadius:22,borderWidth:1,borderColor:C.borderStrong,backgroundColor:C.surfaceRaised,flexDirection:'row',alignItems:'center',paddingHorizontal:14},searchIcon:{color:C.mutedStrong,fontSize:20,marginRight:8},searchInput:{flex:1,color:C.white,fontFamily:F.regular,fontSize:12},quickPills:{flexDirection:'row',gap:7,marginTop:10,flexWrap:'wrap'},pill:{height:34,borderRadius:17,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:14,alignItems:'center',justifyContent:'center'},pillActive:{backgroundColor:C.lime,borderColor:C.lime},pillText:{color:C.white,fontFamily:F.semiBold,fontSize:10},pillActiveText:{color:C.black,fontFamily:F.bold,fontSize:10},
 readiness:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},readinessTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},label:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2},readinessTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18,marginTop:5},percent:{color:C.white,fontFamily:F.black,fontSize:21},
 track:{height:4,backgroundColor:C.border,marginTop:14},fill:{height:'100%',backgroundColor:C.lime},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:11},small:{color:C.muted,fontSize:10},action:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:22,marginBottom:10},section:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.2},sectionAction:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 grid:{flexDirection:'row',flexWrap:'wrap',marginHorizontal:-4},tile:{width:'50%',minHeight:112,padding:14,borderWidth:1,borderColor:C.border,marginBottom:8},tileTitle:{color:C.white,fontFamily:F.extraBold,fontSize:17},tileBody:{color:C.muted,fontSize:11,marginTop:5},tileArrow:{color:C.lime,fontSize:18,marginTop:'auto',alignSelf:'flex-end'},
 ai:{marginTop:10,paddingTop:18,borderTopWidth:1,borderTopColor:C.border},aiCopy:{paddingRight:8},aiTitle:{color:C.white,fontFamily:F.black,fontSize:22,marginTop:6},aiBody:{color:C.muted,fontSize:12,lineHeight:18,marginTop:6},
 aiButton:{height:44,borderRadius:R.sm,backgroundColor:C.lime,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:14},aiButtonText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:.7}
});
