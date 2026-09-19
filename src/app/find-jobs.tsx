import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, SharpChip, InlineBadge } from '@/components/ProductChrome';
import { JobMap } from '@/components/JobMap';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadJobs, saveJob, type Job } from '@/core/opportunities/opportunity-service';
import { loadProfileAnswers } from '@/core/profile/profile-service';

type Lane='all'|'second';

export default function FindJobs(){
 const params=useLocalSearchParams<{search?:string}>();
 const initialSearch=typeof params.search==='string'?params.search:'';
 const [query,setQuery]=useState(initialSearch);
 const [location,setLocation]=useState('');
 const [jobs,setJobs]=useState<Job[]>([]);
 const [lane,setLane]=useState<Lane>('all');
 const [remote,setRemote]=useState(false);
 const [fullTime,setFullTime]=useState(false);
 const [partTime,setPartTime]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [viewMode,setViewMode]=useState<'list'|'map'>('list');

 async function run(next={remote,fullTime,partTime,lane}){
  setLoading(true);
  setError('');
  try{
   setJobs(await loadJobs(query,location,{
    remote:next.remote,
    fullTime:next.fullTime,
    partTime:next.partTime,
    secondChance:next.lane==='second'
   }));
  }catch{
   setError('Jobs could not load. Check your connection and try again.');
  }finally{
   setLoading(false);
  }
 }

 useEffect(()=>{
  let active=true;
  loadProfileAnswers()
   .then(a=>{
    if(!active)return;
    const v=a['identity.current_location'];
    if(typeof v==='string')setLocation(v);
   })
   .finally(()=>{
    if(active){
     loadJobs(initialSearch)
      .then(setJobs)
      .catch(()=>setError('Jobs could not load.'))
      .finally(()=>setLoading(false));
    }
   });
  return()=>{active=false};
 },[initialSearch]);

 const counts=useMemo(()=>({
  all:jobs.length,
  second:jobs.filter(j=>j.eligibility_rules?.second_chance_evidence==='explicit').length
 }),[jobs]);

 function openJob(j:Job){
  router.push(('/job/'+j.id) as never);
 }

 function matchLabel(j:Job){
  return j.eligibility_rules?.second_chance_evidence==='explicit'
   ?'VERIFIED SECOND-CHANCE'
   :'POLICY REVIEW NEEDED';
 }

 async function handleSave(id:string){
  try{
   await saveJob(id);
   Alert.alert('Saved','Job saved to your FairPath.');
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){
    Alert.alert('Sign in to save','Create an account or sign in to save jobs.',[
     {text:'Not now',style:'cancel'},
     {text:'Sign in',onPress:()=>router.push('/sign-in' as never)}
    ]);
    return;
   }
   Alert.alert('Could not save','Please try again.');
  }
 }

 function chooseLane(next:Lane){
  setLane(next);
  void run({remote,fullTime,partTime,lane:next});
 }
 function chooseRemote(){
  const next=!remote;
  setRemote(next);
  void run({remote:next,fullTime,partTime,lane});
 }
 function chooseFull(){
  const next=!fullTime;
  setFullTime(next);
  setPartTime(false);
  void run({remote,fullTime:next,partTime:false,lane});
 }
 function choosePart(){
  const next=!partTime;
  setPartTime(next);
  setFullTime(false);
  void run({remote,fullTime:false,partTime:next,lane});
 }

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH JOBS" title="Find work"/>
  <View style={s.searchBlock}>
   <View style={s.searchRow}>
    <View style={s.fieldIcon}><Lucide name="briefcase-business" color={C.lime} size={15}/></View>
    <View style={s.fieldCopy}>
     <Text style={s.fieldLabel}>WHAT</Text>
     <TextInput value={query} onChangeText={setQuery} style={s.input} placeholder="Job title, skill or company" placeholderTextColor={C.muted}/>
    </View>
   </View>

   <View style={s.searchRow}>
    <View style={s.fieldIcon}><Lucide name="map-pin" color={C.lime} size={15}/></View>
    <View style={s.fieldCopy}>
     <Text style={s.fieldLabel}>WHERE</Text>
     <TextInput value={location} onChangeText={setLocation} style={s.input} placeholder="City, state or ZIP" placeholderTextColor={C.muted}/>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Show jobs on map" style={s.mapBtn} onPress={()=>setViewMode('map')}>
     <Lucide name="map" color={C.lime} size={15}/>
     <Text style={s.mapBtnText}>MAP</Text>
    </Pressable>
   </View>

   <Pressable style={s.primary} onPress={()=>void run()}>
    <Text style={s.primaryText}>SEARCH JOBS</Text>
    <Lucide name="arrow-right" color={C.black} size={16}/>
   </Pressable>
  </View>

  <View style={s.lanes}>
   <Pressable style={[s.lane,lane==='all'&&s.laneActive]} onPress={()=>chooseLane('all')}>
    <Text style={[s.laneText,lane==='all'&&s.laneTextActive]}>ALL JOBS</Text>
    <Text style={[s.laneCount,lane==='all'&&s.laneCountActive]}>{counts.all}</Text>
   </Pressable>
   <Pressable style={[s.lane,lane==='second'&&s.laneActive]} onPress={()=>chooseLane('second')}>
    <Text style={[s.laneText,lane==='second'&&s.laneTextActive]}>SECOND CHANCE</Text>
    <Text style={[s.laneCount,lane==='second'&&s.laneCountActive]}>{counts.second}</Text>
   </Pressable>
  </View>

  <View style={s.filtersHead}>
   <Text style={s.filtersLabel}>FILTERS</Text>
   <Text style={s.filtersHint}>Narrow the list</Text>
  </View>

  <View style={s.filtersStrip}>
   <View style={s.filterCell}><SharpChip label="Remote" active={remote} onPress={chooseRemote}/></View>
   <View style={s.filterCell}><SharpChip label="Full-time" active={fullTime} onPress={chooseFull}/></View>
   <View style={s.filterCell}><SharpChip label="Part-time" active={partTime} onPress={choosePart}/></View>
  </View>

  <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
   <View style={s.resultsTop}>
    <Text style={s.results}>{loading?'SEARCHING':String(jobs.length)+' RESULTS'}</Text>
    <View style={s.viewToggle}>
     <Pressable style={[s.viewButton,viewMode==='list'&&s.viewButtonActive]} onPress={()=>setViewMode('list')}>
      <Lucide name="list" color={viewMode==='list'?C.lime:C.mutedStrong} size={13}/>
      <Text style={[s.viewButtonText,viewMode==='list'&&s.viewButtonTextActive]}>LIST</Text>
     </Pressable>
     <Pressable style={[s.viewButton,viewMode==='map'&&s.viewButtonActive]} onPress={()=>setViewMode('map')}>
      <Lucide name="map" color={viewMode==='map'?C.lime:C.mutedStrong} size={13}/>
      <Text style={[s.viewButtonText,viewMode==='map'&&s.viewButtonTextActive]}>MAP</Text>
     </Pressable>
    </View>
   </View>

   {error?<Text style={s.error}>{error}</Text>:null}

   {!loading&&jobs.length===0?<View style={s.empty}>
    <Text style={s.emptyTitle}>No jobs match these filters.</Text>
    <Text style={s.emptyBody}>Try a wider location, remove a filter, or switch back to All Jobs.</Text>
   </View>:null}

   {!loading&&jobs.length>0&&viewMode==='map'?<JobMap jobs={jobs} onOpenJob={openJob}/>:null}

   {viewMode==='list'?jobs.map(j=><Pressable key={j.id} style={s.card} onPress={()=>openJob(j)}>
    <View style={s.cardTop}>
     <View style={s.companyMark}><Text style={s.companyMarkText}>{j.company_name.slice(0,1).toUpperCase()}</Text></View>
     <View style={s.cardTopCopy}>
      <Text style={s.jobTitle}>{j.title}</Text>
      <Text style={s.company}>{j.company_name}</Text>
     </View>
     <Pressable accessibilityRole="button" accessibilityLabel="Save job" style={s.saveBtn} onPress={(e)=>{e.stopPropagation?.();void handleSave(j.id)}}>
      <Lucide name="bookmark" color={C.mutedStrong} size={15}/>
     </Pressable>
    </View>

    <View style={s.metaRow}>
     <Lucide name="map-pin" color={C.muted} size={13}/>
     <Text style={s.meta}>{j.location_text||[j.city,j.state].filter(Boolean).join(', ')||'Location not listed'}</Text>
     <View style={s.metaDot}/>
     <Text style={s.meta}>{j.workplace_type.replace('_',' ')}</Text>
    </View>

    {j.pay_min!=null?<Text style={s.pay}>
     {'$'+Number(j.pay_min).toLocaleString()+(j.pay_max?' – $'+Number(j.pay_max).toLocaleString():'')+' / '+(j.pay_period||'period')}
    </Text>:null}

    <View style={s.badgeRow}>
     <InlineBadge tone={j.eligibility_rules?.second_chance_evidence==='explicit'?'lime':'default'}>{matchLabel(j)}</InlineBadge>
     {j.easy_apply_enabled?<InlineBadge tone="lime">EASY APPLY</InlineBadge>:null}
     <InlineBadge>{j.employment_type.replace('_',' ').toUpperCase()}</InlineBadge>
    </View>

    <Text style={s.desc} numberOfLines={2}>{j.description}</Text>

    <View style={s.cardFooter}>
     <View>
      <Text style={s.sourceLabel}>SOURCE</Text>
      <Text style={s.source}>{j.source_label||'FairPath'}</Text>
     </View>
     <View style={s.viewAction}>
      <Text style={s.viewText}>VIEW JOB</Text>
      <Lucide name="arrow-right" color={C.lime} size={14}/>
     </View>
    </View>
   </Pressable>):null}
  </ScrollView>
 </ScreenFrame>;
}

const s=StyleSheet.create({
 searchBlock:{paddingHorizontal:L.mobileGutter,paddingTop:14,paddingBottom:14,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 searchRow:{minHeight:58,flexDirection:'row',alignItems:'center',borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',marginBottom:8},
 fieldIcon:{width:42,alignItems:'center',justifyContent:'center'},
 fieldCopy:{flex:1,minWidth:0,paddingVertical:9},
 fieldLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1.25,marginBottom:2},
 input:{color:C.white,fontFamily:F.medium,fontSize:13,paddingVertical:2,paddingHorizontal:0},
 mapBtn:{height:56,paddingHorizontal:12,flexDirection:'row',gap:6,alignItems:'center',justifyContent:'center',borderLeftWidth:1,borderLeftColor:C.borderStrong,backgroundColor:'#0C100B'},
 mapBtnText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},
 primary:{height:44,borderRadius:2,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:2},
 primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:1},
 lanes:{flexDirection:'row',marginHorizontal:L.mobileGutter,marginTop:14,borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong},
 lane:{flex:1,minHeight:52,paddingHorizontal:10,alignItems:'flex-start',justifyContent:'center',borderRightWidth:1,borderRightColor:C.borderStrong,backgroundColor:'#090B09'},
 laneActive:{backgroundColor:'#10150C',borderBottomWidth:2,borderBottomColor:C.lime},
 laneText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8,textAlign:'left'},
 laneTextActive:{color:C.lime},
 laneCount:{color:C.muted,fontFamily:F.semiBold,fontSize:8,marginTop:4},
 laneCountActive:{color:C.white},
 filtersHead:{paddingHorizontal:L.mobileGutter,paddingTop:13,paddingBottom:0,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 filtersLabel:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1},
 filtersHint:{color:C.muted,fontFamily:F.medium,fontSize:9},
 filtersStrip:{height:52,paddingHorizontal:L.mobileGutter,paddingVertical:9,flexDirection:'row',gap:7},
 filterCell:{flex:1},
 list:{paddingHorizontal:L.mobileGutter,paddingBottom:28},
 resultsTop:{height:46,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 results:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1},
 viewToggle:{flexDirection:'row',borderWidth:1,borderColor:C.borderStrong},
 viewButton:{height:28,paddingHorizontal:9,flexDirection:'row',gap:5,alignItems:'center',justifyContent:'center',backgroundColor:'#090B09'},
 viewButtonActive:{backgroundColor:'#10150C'},
 viewButtonText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 viewButtonTextActive:{color:C.lime},
 card:{borderTopWidth:1,borderTopColor:C.borderStrong,paddingVertical:18},
 cardTop:{flexDirection:'row',alignItems:'flex-start'},
 companyMark:{width:36,height:36,borderRadius:2,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',alignItems:'center',justifyContent:'center',marginRight:10},
 companyMarkText:{color:C.white,fontFamily:F.extraBold,fontSize:13},
 cardTopCopy:{flex:1,minWidth:0,paddingRight:10},
 saveBtn:{width:34,height:34,borderRadius:2,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',backgroundColor:'#0A0C0A'},
 jobTitle:{color:C.white,fontFamily:F.extraBold,fontSize:20,lineHeight:22,letterSpacing:-.4},
 company:{color:C.mutedStrong,fontFamily:F.bold,fontSize:12,marginTop:3},
 metaRow:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6,marginTop:12},
 meta:{color:C.muted,fontSize:11,textTransform:'capitalize'},
 metaDot:{width:3,height:3,borderRadius:2,backgroundColor:C.borderStrong},
 pay:{color:C.white,fontFamily:F.extraBold,fontSize:14,marginTop:11},
 badgeRow:{flexDirection:'row',gap:6,flexWrap:'wrap',marginTop:11},
 desc:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginTop:13},
 cardFooter:{marginTop:15,paddingTop:12,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 sourceLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},
 source:{color:C.mutedStrong,fontSize:9,marginTop:3},
 viewAction:{flexDirection:'row',alignItems:'center',gap:6},
 viewText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},
 empty:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:28},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18},
 emptyBody:{color:C.muted,fontSize:13,lineHeight:20,marginTop:7},
 error:{color:C.danger,fontSize:12,paddingVertical:12}
});
