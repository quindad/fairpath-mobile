import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadMyJobApplicationDetail, withdrawMyJobApplication, type JobApplicationStatus, type MyJobApplicationDetail } from '@/core/opportunities/opportunity-service';

const STATUS:Record<JobApplicationStatus,{label:string;tone:'lime'|'default';body:string}>={
 started:{label:'IN PROGRESS',tone:'default',body:'Your application has not been submitted yet.'},
 submitted:{label:'APPLIED',tone:'lime',body:'Your application was submitted to the employer.'},
 viewed:{label:'UNDER REVIEW',tone:'lime',body:'The employer has opened or reviewed your application.'},
 interview:{label:'INTERVIEW',tone:'lime',body:'The employer moved you to the interview stage.'},
 offer:{label:'OFFER',tone:'lime',body:'The employer marked this application as offer stage.'},
 hired:{label:'HIRED',tone:'lime',body:'This application was marked hired.'},
 withdrawn:{label:'WITHDRAWN',tone:'default',body:'You withdrew this application.'},
 rejected:{label:'NOT SELECTED',tone:'default',body:'The employer closed this application without moving forward.'}
};

function fmt(value:string|null){
 if(!value)return '—';
 const d=new Date(value);
 return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
}

export default function JobApplicationDetail(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [item,setItem]=useState<MyJobApplicationDetail|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [withdrawing,setWithdrawing]=useState(false);

 useEffect(()=>{
  if(!id)return;
  loadMyJobApplicationDetail(id)
   .then(setItem)
   .catch(e=>{
    if(e instanceof Error&&e.message==='SIGNED_OUT'){router.replace(('/sign-in?returnTo='+encodeURIComponent('/job-application/'+id)) as never);return}
    setError('This application could not be loaded.');
   })
   .finally(()=>setLoading(false));
 },[id]);

 function confirmWithdraw(){
  if(!item||!['submitted','viewed','interview','offer'].includes(item.status))return;
  Alert.alert('Withdraw application','This removes you from consideration for this job. You can still keep the application in your history.',[
   {text:'Cancel',style:'cancel'},
   {text:'Withdraw',style:'destructive',onPress:()=>void withdraw()}
  ]);
 }

 async function withdraw(){
  if(!item)return;
  setWithdrawing(true);
  try{
   await withdrawMyJobApplication(item.id);
   setItem({...item,status:'withdrawn',updated_at:new Date().toISOString()});
  }catch{
   Alert.alert('Could not withdraw','Please try again.');
  }finally{setWithdrawing(false)}
 }

 if(loading)return <ScreenFrame><PageHeader eyebrow="FAIRPATH JOBS" title="Application" backTo="/job-applications"/><View style={s.state}><Text style={s.muted}>Loading application…</Text></View></ScreenFrame>;
 if(error||!item)return <ScreenFrame><PageHeader eyebrow="FAIRPATH JOBS" title="Application" backTo="/job-applications"/><View style={s.state}><Text style={s.error}>{error||'Application not found.'}</Text></View></ScreenFrame>;

 const copy=STATUS[item.status]??STATUS.submitted;
 const profile=(item.answers?.profile??{}) as Record<string,unknown>;
 const employer=(item.answers?.employer_questions??{}) as Record<string,unknown>;
 const location=item.job?.location_text||[item.job?.city,item.job?.state].filter(Boolean).join(', ')||'Location not listed';
 const canWithdraw=['submitted','viewed','interview','offer'].includes(item.status);

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH JOBS" title="Application" backTo="/job-applications"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.hero}>
    <View style={s.heroTop}>
     <View style={s.heroCopy}>
      <Text style={s.company}>{item.job?.company_name||'FairPath employer'}</Text>
      <Text style={s.title}>{item.job?.title||'Job application'}</Text>
     </View>
     <InlineBadge tone={copy.tone}>{copy.label}</InlineBadge>
    </View>
    <View style={s.metaRow}><Lucide name="map-pin" color={C.muted} size={12}/><Text style={s.meta}>{location}</Text></View>
    <Text style={s.statusBody}>{copy.body}</Text>
   </View>

   <View style={s.timeline}>
    <Text style={s.sectionLabel}>APPLICATION TIMELINE</Text>
    <View style={s.timelineRow}><Text style={s.timelineKey}>Submitted</Text><Text style={s.timelineValue}>{fmt(item.submitted_at)}</Text></View>
    <View style={s.timelineRow}><Text style={s.timelineKey}>Last update</Text><Text style={s.timelineValue}>{fmt(item.updated_at)}</Text></View>
   </View>

   <View style={s.section}>
    <Text style={s.sectionLabel}>YOUR APPLICATION</Text>
    {Object.entries(profile).filter(([,v])=>v!==''&&v!=null).map(([k,v])=><View key={k} style={s.answer}><Text style={s.answerKey}>{k.replace(/_/g,' ').toUpperCase()}</Text><Text style={s.answerValue}>{Array.isArray(v)?v.join(', '):String(v)}</Text></View>)}
    {!Object.keys(profile).length?<Text style={s.muted}>No reusable profile answers were stored with this application.</Text>:null}
   </View>

   {Object.keys(employer).length?<View style={s.section}>
    <Text style={s.sectionLabel}>EMPLOYER QUESTIONS</Text>
    {Object.entries(employer).map(([k,v])=><View key={k} style={s.answer}><Text style={s.answerKey}>{k.toUpperCase()}</Text><Text style={s.answerValue}>{String(v)}</Text></View>)}
   </View>:null}

   {item.job?<Pressable style={s.viewJob} onPress={()=>router.push(('/job/'+item.job!.id) as never)}>
    <Text style={s.viewJobText}>VIEW JOB</Text><Lucide name="arrow-right" color={C.lime} size={14}/>
   </Pressable>:null}

   {canWithdraw?<Pressable style={s.withdraw} disabled={withdrawing} onPress={confirmWithdraw}>
    <Text style={s.withdrawText}>{withdrawing?'WITHDRAWING…':'WITHDRAW APPLICATION'}</Text>
   </Pressable>:null}
  </ScrollView>
 </ScreenFrame>;
}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:18,paddingBottom:36},
 state:{padding:L.mobileGutter},muted:{color:C.muted,fontSize:12},error:{color:C.danger,fontSize:12},
 hero:{paddingBottom:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 heroTop:{flexDirection:'row',alignItems:'flex-start',gap:12},heroCopy:{flex:1,minWidth:0},
 company:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1},
 title:{color:C.white,fontFamily:F.extraBold,fontSize:24,lineHeight:27,marginTop:5},
 metaRow:{flexDirection:'row',alignItems:'center',gap:6,marginTop:10},meta:{color:C.muted,fontSize:10},
 statusBody:{color:C.mutedStrong,fontSize:12,lineHeight:18,marginTop:12},
 timeline:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 section:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},
 sectionLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginBottom:10},
 timelineRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:6},
 timelineKey:{color:C.muted,fontSize:11},timelineValue:{color:C.white,fontFamily:F.bold,fontSize:11},
 answer:{paddingVertical:10,borderTopWidth:1,borderTopColor:C.border},
 answerKey:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 answerValue:{color:C.white,fontSize:12,lineHeight:18,marginTop:4},
 viewJob:{height:44,marginTop:18,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 viewJobText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 withdraw:{height:44,marginTop:10,borderWidth:1,borderColor:'#5A2F2F',alignItems:'center',justifyContent:'center'},
 withdrawText:{color:'#E49A9A',fontFamily:F.extraBold,fontSize:8,letterSpacing:.8}
});
