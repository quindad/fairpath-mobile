import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadSavedJobs, unsaveJob, type Job } from '@/core/opportunities/opportunity-service';

export default function SavedJobs(){
 const [jobs,setJobs]=useState<Job[]>([]);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');

 const load=useCallback(async()=>{
  setError('');
  try{setJobs(await loadSavedJobs())}
  catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){router.replace('/sign-in?returnTo=/saved-jobs' as never);return}
   setError('Saved jobs could not be loaded.');
  }finally{setLoading(false);setRefreshing(false)}
 },[]);

 useEffect(()=>{void load()},[load]);

 async function remove(jobId:string){
  try{
   await unsaveJob(jobId);
   setJobs(current=>current.filter(j=>j.id!==jobId));
  }catch{setError('That job could not be removed. Try again.')}
 }

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH JOBS" title="Saved jobs" backTo="/find-jobs"/>
  <ScrollView
   contentContainerStyle={s.content}
   showsVerticalScrollIndicator={false}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load()}} tintColor={C.lime}/>}
  >
   <View style={s.summary}>
    <Text style={s.summaryLabel}>YOUR SHORTLIST</Text>
    <Text style={s.summaryValue}>{loading?'—':String(jobs.length)}</Text>
    <Text style={s.summaryText}>Jobs you save stay here until you remove them.</Text>
   </View>

   {error?<View style={s.state}><Text style={s.error}>{error}</Text><Pressable onPress={()=>void load()}><Text style={s.retry}>TRY AGAIN</Text></Pressable></View>:null}
   {loading&&!error?<View style={s.state}><Text style={s.muted}>Loading saved jobs…</Text></View>:null}
   {!loading&&!error&&jobs.length===0?<View style={s.empty}>
    <Text style={s.emptyTitle}>No saved jobs yet.</Text>
    <Text style={s.emptyBody}>Tap the bookmark on a job you want to come back to.</Text>
    <Pressable style={s.primary} onPress={()=>router.replace('/find-jobs' as never)}>
     <Text style={s.primaryText}>FIND JOBS</Text><Lucide name="arrow-right" color={C.black} size={15}/>
    </Pressable>
   </View>:null}

   {!loading&&!error?jobs.map(job=>{
    const location=job.location_text||[job.city,job.state].filter(Boolean).join(', ')||'Location not listed';
    const expired=Boolean(job.expires_at&&new Date(job.expires_at).getTime()<=Date.now())||job.status==='expired';
    const inactive=expired||job.status==='closed'||job.status==='filled';
    return <View key={job.id} style={s.card}>
     <Pressable style={s.cardMain} onPress={()=>router.push(('/job/'+job.id) as never)}>
      <View style={s.cardTop}>
       <View style={s.mark}><Text style={s.markText}>{job.company_name.slice(0,1).toUpperCase()}</Text></View>
       <View style={s.copy}>
        <Text style={s.title}>{job.title}</Text>
        <Text style={s.company}>{job.company_name}</Text>
       </View>
       {inactive?<InlineBadge>{job.status==='filled'?'FILLED':expired?'EXPIRED':'CLOSED'}</InlineBadge>:null}
      </View>
      <View style={s.metaRow}><Lucide name="map-pin" color={C.muted} size={12}/><Text style={s.meta}>{location}</Text></View>
      {job.pay_min!=null?<Text style={s.pay}>{'$'+Number(job.pay_min).toLocaleString()+(job.pay_max?' – $'+Number(job.pay_max).toLocaleString():'')+' / '+(job.pay_period||'period')}</Text>:null}
      <View style={s.footer}><Text style={s.view}>VIEW JOB</Text><Lucide name="arrow-right" color={C.lime} size={13}/></View>
     </Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="Remove saved job" style={s.remove} onPress={()=>void remove(job.id)}>
      <Lucide name="bookmark-x" color={C.mutedStrong} size={14}/><Text style={s.removeText}>REMOVE</Text>
     </Pressable>
    </View>
   }):null}
  </ScrollView>
 </ScreenFrame>;
}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:16,paddingBottom:36},
 summary:{borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,paddingVertical:18,marginBottom:6},
 summaryLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.15},
 summaryValue:{color:C.white,fontFamily:F.extraBold,fontSize:34,lineHeight:38,marginTop:5},
 summaryText:{color:C.mutedStrong,fontSize:12,lineHeight:18,marginTop:4},
 state:{paddingVertical:26,borderBottomWidth:1,borderBottomColor:C.border},
 muted:{color:C.muted,fontSize:12},error:{color:C.danger,fontSize:12,lineHeight:18},retry:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1,marginTop:12},
 empty:{paddingVertical:28,borderBottomWidth:1,borderBottomColor:C.border},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:21},emptyBody:{color:C.mutedStrong,fontSize:13,lineHeight:20,marginTop:7},
 primary:{height:44,backgroundColor:C.lime,marginTop:18,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},
 card:{borderBottomWidth:1,borderBottomColor:C.borderStrong},
 cardMain:{paddingVertical:18},
 cardTop:{flexDirection:'row',alignItems:'flex-start',gap:10},
 mark:{width:36,height:36,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',alignItems:'center',justifyContent:'center'},
 markText:{color:C.white,fontFamily:F.extraBold,fontSize:13},
 copy:{flex:1,minWidth:0},title:{color:C.white,fontFamily:F.extraBold,fontSize:19,lineHeight:22},company:{color:C.mutedStrong,fontFamily:F.bold,fontSize:11,marginTop:3},
 metaRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:10},meta:{color:C.muted,fontSize:10},
 pay:{color:C.white,fontFamily:F.extraBold,fontSize:13,marginTop:10},
 footer:{marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 view:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 remove:{height:40,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
 removeText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7,letterSpacing:.9}
});
