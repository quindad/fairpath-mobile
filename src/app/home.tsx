import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FairPathLogo } from '@/components/FairPathLogo';
import { BottomNav } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L, FairPathRadius as R } from '@/constants/fairpath';
import { loadFairPathReadiness } from '@/core/profile/profile-service';
import { loadJobs, type Job } from '@/core/opportunities/opportunity-service';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Home(){
 const pathname=usePathname(); const [readiness,setReadiness]=useState<number|null>(null); const [search,setSearch]=useState(''); const [featured,setFeatured]=useState<Job[]>([]);
 useEffect(()=>{let active=true;loadFairPathReadiness().then(x=>{if(active)setReadiness(x.readiness.overallPercentage)}).catch(()=>{if(active)setReadiness(null)});loadJobs().then(x=>{if(active)setFeatured(x.slice(0,2))}).catch(()=>{});return()=>{active=false}},[pathname]);
 return <View style={s.screen}><SafeAreaView style={s.safe}>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.top}><View style={s.brand}><FairPathLogo width={78}/><Text style={s.brandName}>FairPath</Text></View><Pressable style={s.bell} onPress={()=>router.push('/me')}><Text style={s.bellText}>♢</Text></Pressable></View>

   <View style={s.hero}><Text style={s.title}>Opportunity has a <Text style={s.titleAccent}>path.</Text></Text><Text style={s.sub}>Jobs. Housing. Resources. A stronger you.</Text><View style={s.search}><Text style={s.searchIcon}>⌕</Text><TextInput value={search} onChangeText={setSearch} onSubmitEditing={()=>router.push(('/find-jobs?search='+encodeURIComponent(search)) as never)} style={s.searchInput} placeholder="Search jobs, housing, or resources..." placeholderTextColor={C.muted}/></View><View style={s.quickPills}><Pressable style={[s.pill,s.pillActive]} onPress={()=>router.push('/find-jobs')}><Text style={s.pillActiveText}>Jobs</Text></Pressable><Pressable style={s.pill} onPress={()=>router.push('/find-housing')}><Text style={s.pillText}>Housing</Text></Pressable><Pressable style={s.pill} onPress={()=>router.push('/marketplace')}><Text style={s.pillText}>Marketplace</Text></Pressable><Pressable style={s.pill} onPress={()=>router.push('/resources')}><Text style={s.pillText}>Resources</Text></Pressable></View></View>

   <View style={s.sectionHead}><Text style={s.featuredTitle}>Featured Opportunities</Text><Pressable onPress={()=>router.push('/find-jobs')}><Text style={s.seeAll}>See all</Text></Pressable></View>
   <View style={s.featuredList}>{featured.map(j=><Pressable key={j.id} style={s.jobCard} onPress={()=>router.push(('/job/'+j.id) as never)}>
    <View style={s.jobThumb}><Text style={s.jobThumbText}>{j.company_name.slice(0,1).toUpperCase()}</Text></View>
    <View style={s.jobCopy}><Text style={s.jobTitle} numberOfLines={1}>{j.title}</Text><Text style={s.jobCompany}>{j.company_name}</Text><Text style={s.jobMeta}>{j.location_text||[j.city,j.state].filter(Boolean).join(', ')}</Text>{j.pay_min!=null?<Text style={s.jobPay}>{'$'+Number(j.pay_min).toLocaleString()+(j.pay_max?' – $'+Number(j.pay_max).toLocaleString():'')+' / '+(j.pay_period||'period')}</Text>:null}<View style={s.jobBadges}><Text style={s.jobBadge}>{j.employment_type.replace('_',' ')}</Text>{j.eligibility_rules?.second_chance_evidence==='explicit'?<Text style={s.jobBadge}>Second Chance</Text>:null}</View></View>
    <Text style={s.bookmark}>♡</Text>
   </Pressable>)}</View>

   <Pressable style={s.readinessCompact} onPress={()=>router.push('/complete-profile' as never)}><View><Text style={s.label}>FAIRPATH READINESS</Text><Text style={s.readinessCompactTitle}>Complete your profile</Text></View><View style={s.readinessRight}><Text style={s.readinessCompactPct}>{readiness==null?'—':readiness+'%'}</Text><Text style={s.action}>CONTINUE →</Text></View></Pressable>

   <View style={s.ai}>
    <View style={s.aiCopy}><Text style={s.label}>FAIRPATH AI</Text><Text style={s.aiTitle}>Need help with the next move?</Text><Text style={s.aiBody}>Applications, résumés, interview prep, housing questions and your reentry plan.</Text></View>
    <Pressable style={s.aiButton} onPress={()=>router.push('/fairpath-ai')}><Text style={s.aiButtonText}>OPEN AI</Text><Text style={s.aiButtonText}>→</Text></Pressable>
   </View>
  </ScrollView>
  <BottomNav/>
 </SafeAreaView></View>
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:C.black},safe:{flex:1,width:'100%',maxWidth:L.consumerMaxWidth,alignSelf:'center'},content:{paddingHorizontal:L.mobileGutter,paddingTop:8,paddingBottom:88},
 top:{height:58,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},brand:{flexDirection:'row',alignItems:'center'},brandName:{color:C.white,fontFamily:F.bold,fontSize:17,marginLeft:-7},bell:{width:34,height:34,alignItems:'center',justifyContent:'center'},bellText:{color:C.white,fontSize:22},
 hero:{paddingBottom:12},title:{color:C.white,fontFamily:F.extraBold,fontSize:34,lineHeight:36,letterSpacing:-1.1,maxWidth:520},titleAccent:{color:C.lime},sub:{color:C.mutedStrong,fontFamily:F.regular,fontSize:12,lineHeight:18,marginTop:8,maxWidth:500},search:{height:44,marginTop:18,borderRadius:22,borderWidth:1,borderColor:C.borderStrong,backgroundColor:C.surfaceRaised,flexDirection:'row',alignItems:'center',paddingHorizontal:14},searchIcon:{color:C.mutedStrong,fontSize:20,marginRight:8},searchInput:{flex:1,color:C.white,fontFamily:F.regular,fontSize:12},quickPills:{flexDirection:'row',gap:7,marginTop:10,flexWrap:'wrap'},pill:{height:34,borderRadius:17,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:14,alignItems:'center',justifyContent:'center'},pillActive:{backgroundColor:C.lime,borderColor:C.lime},pillText:{color:C.white,fontFamily:F.semiBold,fontSize:10},pillActiveText:{color:C.black,fontFamily:F.bold,fontSize:10},
 readiness:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},readinessTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},label:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2},readinessTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18,marginTop:5},percent:{color:C.white,fontFamily:F.black,fontSize:21},
 track:{height:4,backgroundColor:C.border,marginTop:14},fill:{height:'100%',backgroundColor:C.lime},rowBetween:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:11},small:{color:C.muted,fontSize:10},action:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 sectionHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:18,marginBottom:10},featuredTitle:{color:C.white,fontFamily:F.bold,fontSize:16},seeAll:{color:C.lime,fontFamily:F.bold,fontSize:10},featuredList:{gap:9},jobCard:{minHeight:112,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.card,flexDirection:'row',padding:10,alignItems:'flex-start'},jobThumb:{width:72,height:72,borderRadius:10,backgroundColor:C.surfaceRaised,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},jobThumbText:{color:C.lime,fontFamily:F.extraBold,fontSize:24},jobCopy:{flex:1,minWidth:0,paddingHorizontal:11},jobTitle:{color:C.white,fontFamily:F.bold,fontSize:13},jobCompany:{color:C.mutedStrong,fontFamily:F.medium,fontSize:11,marginTop:2},jobMeta:{color:C.muted,fontFamily:F.regular,fontSize:10,marginTop:2},jobPay:{color:C.white,fontFamily:F.semiBold,fontSize:10,marginTop:2},jobBadges:{flexDirection:'row',gap:5,marginTop:6,flexWrap:'wrap'},jobBadge:{color:C.mutedStrong,fontFamily:F.semiBold,fontSize:8,backgroundColor:C.surfaceRaised,borderRadius:10,paddingHorizontal:7,paddingVertical:3},bookmark:{color:C.white,fontSize:20},readinessCompact:{marginTop:14,borderRadius:12,borderWidth:1,borderColor:C.border,backgroundColor:C.card,padding:13,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},readinessCompactTitle:{color:C.white,fontFamily:F.bold,fontSize:13,marginTop:3},readinessRight:{alignItems:'flex-end'},readinessCompactPct:{color:C.lime,fontFamily:F.extraBold,fontSize:14,marginBottom:4},
 ai:{marginTop:12,paddingTop:16,borderTopWidth:1,borderTopColor:C.border,paddingBottom:18},aiCopy:{paddingRight:8},aiTitle:{color:C.white,fontFamily:F.black,fontSize:22,marginTop:6},aiBody:{color:C.muted,fontSize:12,lineHeight:18,marginTop:6},
 aiButton:{height:44,borderRadius:R.sm,backgroundColor:C.lime,paddingHorizontal:13,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:14},aiButtonText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:.7}
});
