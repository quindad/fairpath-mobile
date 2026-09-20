import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadMyJobApplications, type MyJobApplication, type JobApplicationStatus } from '@/core/opportunities/opportunity-service';

const STATUS_COPY:Record<JobApplicationStatus,{label:string;detail:string;tone:'lime'|'default'}>={
 started:{label:'IN PROGRESS',detail:'Your application has not been submitted yet.',tone:'default'},
 submitted:{label:'APPLIED',detail:'Your application was submitted to the employer.',tone:'lime'},
 viewed:{label:'UNDER REVIEW',detail:'The employer has opened or reviewed your application.',tone:'lime'},
 interview:{label:'INTERVIEW',detail:'The employer moved you to the interview stage.',tone:'lime'},
 offer:{label:'OFFER',detail:'The employer marked this application as offer stage.',tone:'lime'},
 hired:{label:'HIRED',detail:'This application was marked hired.',tone:'lime'},
 withdrawn:{label:'WITHDRAWN',detail:'You are no longer active for this application.',tone:'default'},
 rejected:{label:'NOT SELECTED',detail:'The employer closed this application without moving forward.',tone:'default'}
};

function formatDate(value:string|null){
 if(!value)return 'Not submitted';
 const d=new Date(value);
 if(Number.isNaN(d.getTime()))return 'Submitted';
 return d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}

export default function JobApplications(){
 const [items,setItems]=useState<MyJobApplication[]>([]);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');

 const load=useCallback(async()=>{
  setError('');
  try{setItems(await loadMyJobApplications())}
  catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){router.replace('/sign-up?returnTo=/job-applications' as never);return}
   setError('Your applications could not be loaded.');
  }finally{setLoading(false);setRefreshing(false)}
 },[]);

 useEffect(()=>{void load()},[load]);

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH JOBS" title="My applications" backTo="/find-jobs" alwaysBackTo/>
  <ScrollView
   contentContainerStyle={s.content}
   showsVerticalScrollIndicator={false}
   refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load()}} tintColor={C.lime}/>}
  >
   <View style={s.summary}>
    <Text style={s.summaryLabel}>APPLICATION TRACKER</Text>
    <Text style={s.summaryValue}>{loading?'—':String(items.length)}</Text>
    <Text style={s.summaryText}>Your FairPath applications and employer status updates live here.</Text>
   </View>

   {error?<View style={s.state}><Text style={s.error}>{error}</Text><Pressable onPress={()=>void load()}><Text style={s.retry}>TRY AGAIN</Text></Pressable></View>:null}
   {loading&&!error?<View style={s.state}><Text style={s.muted}>Loading applications…</Text></View>:null}
   {!loading&&!error&&items.length===0?<View style={s.empty}>
    <Text style={s.emptyTitle}>No applications yet.</Text>
    <Text style={s.emptyBody}>When you Easy Apply through FairPath, the application and its status will show here.</Text>
    <Pressable style={s.primary} onPress={()=>router.push('/find-jobs' as never)}>
     <Text style={s.primaryText}>FIND JOBS</Text><Lucide name="arrow-right" color={C.black} size={15}/>
    </Pressable>
   </View>:null}

   {!loading&&!error?items.map(item=>{
    const copy=STATUS_COPY[item.status]??STATUS_COPY.submitted;
    const job=item.job;
    const location=job?.location_text||[job?.city,job?.state].filter(Boolean).join(', ')||'Location not listed';
    return <Pressable key={item.id} style={s.card} onPress={()=>router.push(('/job-application/'+item.id) as never)}>
     <View style={s.cardTop}>
      <View style={s.cardCopy}>
       <Text style={s.title}>{job?.title||'Job application'}</Text>
       <Text style={s.company}>{job?.company_name||'FairPath employer'}</Text>
      </View>
      <InlineBadge tone={copy.tone}>{copy.label}</InlineBadge>
     </View>
     <View style={s.metaRow}>
      <Lucide name="map-pin" color={C.muted} size={12}/>
      <Text style={s.meta}>{location}</Text>
     </View>
     <Text style={s.detail}>{copy.detail}</Text>
     <View style={s.footer}>
      <View>
       <Text style={s.footerLabel}>SUBMITTED</Text>
       <Text style={s.footerValue}>{formatDate(item.submitted_at)}</Text>
      </View>
      <View style={s.openRow}><Text style={s.openText}>VIEW APPLICATION</Text><Lucide name="arrow-right" color={C.lime} size={13}/></View>
     </View>
    </Pressable>
   }):null}
  </ScrollView>
 </ScreenFrame>;
}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:16,paddingBottom:36},
 summary:{borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,paddingVertical:18,marginBottom:6},
 summaryLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.15},
 summaryValue:{color:C.white,fontFamily:F.extraBold,fontSize:34,lineHeight:38,marginTop:5},
 summaryText:{color:C.mutedStrong,fontSize:12,lineHeight:18,marginTop:4,maxWidth:330},
 state:{paddingVertical:26,borderBottomWidth:1,borderBottomColor:C.border},
 muted:{color:C.muted,fontSize:12},error:{color:C.danger,fontSize:12,lineHeight:18},
 retry:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1,marginTop:12},
 empty:{paddingVertical:28,borderBottomWidth:1,borderBottomColor:C.border},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:21},
 emptyBody:{color:C.mutedStrong,fontSize:13,lineHeight:20,marginTop:7},
 primary:{height:44,backgroundColor:C.lime,marginTop:18,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},
 card:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 cardTop:{flexDirection:'row',alignItems:'flex-start',gap:12},
 cardCopy:{flex:1,minWidth:0},
 title:{color:C.white,fontFamily:F.extraBold,fontSize:19,lineHeight:22,letterSpacing:-.3},
 company:{color:C.mutedStrong,fontFamily:F.bold,fontSize:11,marginTop:4},
 metaRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:10},
 meta:{color:C.muted,fontSize:10},
 detail:{color:C.mutedStrong,fontSize:12,lineHeight:18,marginTop:13},
 footer:{marginTop:14,paddingTop:12,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 footerLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},
 footerValue:{color:C.mutedStrong,fontSize:10,marginTop:3},
 openRow:{flexDirection:'row',alignItems:'center',gap:6},
 openText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8}
});
