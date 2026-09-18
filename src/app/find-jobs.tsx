import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenFrame, PageHeader, FilterStrip, SharpChip, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L, FairPathRadius as R } from '@/constants/fairpath';
import { loadJobs, saveJob, type Job } from '@/core/opportunities/opportunity-service';
import { loadProfileAnswers } from '@/core/profile/profile-service';
import { openGoogleMaps } from '@/core/location/maps';

type Lane='all'|'match'|'second';
export default function FindJobs(){
 const [query,setQuery]=useState(''); const [location,setLocation]=useState(''); const [jobs,setJobs]=useState<Job[]>([]);
 const [lane,setLane]=useState<Lane>('all'); const [remote,setRemote]=useState(false); const [fullTime,setFullTime]=useState(false); const [partTime,setPartTime]=useState(false);
 const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 async function run(next={remote,fullTime,partTime,lane}){
  setLoading(true);setError('');
  try{setJobs(await loadJobs(query,location,{remote:next.remote,fullTime:next.fullTime,partTime:next.partTime,secondChance:next.lane==='second'}));}
  catch{setError('Jobs could not load. Check your connection and try again.');}
  finally{setLoading(false);}
 }
 useEffect(()=>{let active=true;loadProfileAnswers().then(a=>{if(!active)return;const v=a['identity.current_location'];if(typeof v==='string')setLocation(v);}).finally(()=>{if(active)loadJobs().then(setJobs).catch(()=>setError('Jobs could not load.')).finally(()=>setLoading(false));});return()=>{active=false};},[]);
 const counts=useMemo(()=>({all:jobs.length,second:jobs.filter(j=>j.eligibility_rules?.second_chance_evidence==='explicit').length}),[jobs]);
 function openJob(j:Job){router.push(('/job/'+j.id) as never)}
 function matchLabel(j:Job){return j.eligibility_rules?.second_chance_evidence==='explicit'?'VERIFIED SECOND-CHANCE':'POLICY REVIEW NEEDED'}
 async function handleSave(id:string){try{await saveJob(id);Alert.alert('Saved','Job saved to your FairPath.')}catch(e){if(e instanceof Error&&e.message==='SIGNED_OUT'){Alert.alert('Sign in to save','Create an account or sign in to save jobs.',[{text:'Not now',style:'cancel'},{text:'Sign in',onPress:()=>router.push('/sign-in' as never)}]);return}Alert.alert('Could not save','Please try again.')}}
 function chooseLane(next:Lane){setLane(next);void run({remote,fullTime,partTime,lane:next})}
 function chooseRemote(){const next=!remote;setRemote(next);void run({remote:next,fullTime,partTime,lane})}
 function chooseFull(){const next=!fullTime;setFullTime(next);setPartTime(false);void run({remote,fullTime:next,partTime:false,lane})}
 function choosePart(){const next=!partTime;setPartTime(next);setFullTime(false);void run({remote,fullTime:false,partTime:next,lane})}
 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH JOBS" title="Find work"/>
  <View style={s.searchBlock}>
   <View style={s.searchRow}><Text style={s.fieldLabel}>WHAT</Text><TextInput value={query} onChangeText={setQuery} style={s.input} placeholder="Job title, skill or company" placeholderTextColor={C.muted}/></View>
   <View style={s.searchRow}><Text style={s.fieldLabel}>WHERE</Text><TextInput value={location} onChangeText={setLocation} style={s.input} placeholder="City, state or ZIP" placeholderTextColor={C.muted}/><Pressable style={s.mapBtn} onPress={()=>openGoogleMaps((location||'Columbus, OH')+' jobs')}><Text style={s.mapBtnText}>MAP</Text></Pressable></View>
   <Pressable style={s.primary} onPress={run}><Text style={s.primaryText}>Search jobs</Text><Text style={s.primaryText}>→</Text></Pressable>
  </View>
  <View style={s.lanes}>
   <Pressable style={[s.lane,lane==='all'&&s.laneActive]} onPress={()=>chooseLane('all')}><Text style={[s.laneText,lane==='all'&&s.laneTextActive]}>ALL JOBS</Text><Text style={[s.laneCount,lane==='all'&&s.laneTextActive]}>{counts.all}</Text></Pressable>
   <Pressable style={[s.lane,lane==='match'&&s.laneActive]} onPress={()=>chooseLane('match')}><Text style={[s.laneText,lane==='match'&&s.laneTextActive]}>FAIRPATH MATCH</Text></Pressable>
   <Pressable style={[s.lane,lane==='second'&&s.laneActive]} onPress={()=>chooseLane('second')}><Text style={[s.laneText,lane==='second'&&s.laneTextActive]}>2ND CHANCE</Text><Text style={[s.laneCount,lane==='second'&&s.laneTextActive]}>{counts.second}</Text></Pressable>
  </View>
  <FilterStrip><SharpChip label="Remote" active={remote} onPress={chooseRemote}/><SharpChip label="Full-time" active={fullTime} onPress={chooseFull}/><SharpChip label="Part-time" active={partTime} onPress={choosePart}/></FilterStrip>
  <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
   <View style={s.resultsTop}><Text style={s.results}>{loading?'SEARCHING':String(jobs.length)+' RESULTS'}</Text><Text style={s.sort}>Most relevant</Text></View>
   {error?<Text style={s.error}>{error}</Text>:null}
   {!loading&&jobs.length===0?<View style={s.empty}><Text style={s.emptyTitle}>No jobs match these filters.</Text><Text style={s.emptyBody}>Try a wider location, remove a filter, or switch back to All Jobs.</Text></View>:null}
   {jobs.map(j=><Pressable key={j.id} style={s.card} onPress={()=>openJob(j)}>
    <View style={s.cardHeader}><View style={s.companyMark}><Text style={s.companyMarkText}>{j.company_name.slice(0,1).toUpperCase()}</Text></View><Pressable style={s.saveBtn} onPress={(e)=>{e.stopPropagation?.();void handleSave(j.id)}}><Text style={s.saveText}>SAVE</Text></Pressable></View>
    <Text style={s.jobTitle}>{j.title}</Text><Text style={s.company}>{j.company_name}</Text>
    <View style={s.locationLine}><Text style={s.meta}>{j.location_text||[j.city,j.state].filter(Boolean).join(', ')||'Location not listed'}</Text><Text style={s.dot}>·</Text><Text style={s.meta}>{j.workplace_type.replace('_',' ')}</Text></View>
    {j.pay_min!=null?<Text style={s.pay}>{'$'+Number(j.pay_min).toLocaleString()+(j.pay_max?' – $'+Number(j.pay_max).toLocaleString():'')+' / '+(j.pay_period||'period')}</Text>:null}
    <View style={s.badgeRow}><InlineBadge tone={j.eligibility_rules?.second_chance_evidence==='explicit'?'lime':'default'}>{matchLabel(j)}</InlineBadge><InlineBadge>{j.employment_type.replace('_',' ').toUpperCase()}</InlineBadge></View>
    <Text style={s.desc} numberOfLines={2}>{j.description}</Text>
    <View style={s.cardFooter}><Text style={s.source}>{j.source_label||'FairPath'}</Text><Text style={s.viewText}>VIEW JOB  →</Text></View>
   </Pressable>)}
  </ScrollView>
 </ScreenFrame>
}
const s=StyleSheet.create({
 searchBlock:{paddingHorizontal:L.mobileGutter,paddingTop:16,paddingBottom:12,borderBottomWidth:1,borderBottomColor:C.border},
 searchRow:{minHeight:48,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.border,backgroundColor:C.surface,marginBottom:8},
 fieldLabel:{width:58,color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1,paddingLeft:12},
 input:{flex:1,color:C.white,fontSize:14,paddingHorizontal:8,paddingVertical:13},
 mapBtn:{height:46,paddingHorizontal:12,justifyContent:'center',borderLeftWidth:1,borderLeftColor:C.border},mapBtnText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 primary:{height:46,borderRadius:R.sm,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:13},
 lanes:{flexDirection:'row',marginHorizontal:L.mobileGutter,marginTop:14,borderWidth:1,borderColor:C.border},
 lane:{flex:1,minHeight:46,paddingHorizontal:8,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:C.border},laneActive:{backgroundColor:C.white},
 laneText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.7,textAlign:'center'},laneTextActive:{color:C.black},laneCount:{color:C.muted,fontSize:9,marginTop:2},
 list:{paddingHorizontal:L.mobileGutter,paddingBottom:28},resultsTop:{height:42,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},results:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1},sort:{color:C.mutedStrong,fontSize:11},
 card:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:17},cardHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 companyMark:{width:34,height:34,borderRadius:R.sm,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},companyMarkText:{color:C.white,fontFamily:F.black,fontSize:14},
 saveBtn:{height:30,borderRadius:R.xs,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,justifyContent:'center'},saveText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 jobTitle:{color:C.white,fontFamily:F.black,fontSize:22,lineHeight:24,letterSpacing:-.5,marginTop:12},company:{color:C.mutedStrong,fontSize:13,fontWeight:'700',marginTop:4},
 locationLine:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',marginTop:7},meta:{color:C.muted,fontSize:12,textTransform:'capitalize'},dot:{color:C.muted,marginHorizontal:6},
 pay:{color:C.white,fontFamily:F.bold,fontSize:14,marginTop:10},badgeRow:{flexDirection:'row',gap:6,flexWrap:'wrap',marginTop:11},
 desc:{color:C.mutedStrong,fontSize:12,lineHeight:18,marginTop:12},cardFooter:{marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 source:{color:C.muted,fontSize:10},viewText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:.8},
 empty:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:28},emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18},emptyBody:{color:C.muted,fontSize:13,lineHeight:20,marginTop:7},
 error:{color:C.danger,fontSize:12,paddingVertical:12}
});
