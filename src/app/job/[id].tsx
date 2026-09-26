import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notify } from '@/core/ui/notify';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { JobMap } from '@/components/JobMap';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { isJobSaved, loadJob, loadMyJobApplicationForJob, saveJob, unsaveJob, type Job, type JobApplicationStatus } from '@/core/opportunities/opportunity-service';
import { supabase } from '@/lib/supabase';

export default function JobDetail(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [job,setJob]=useState<Job|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [applicationStatus,setApplicationStatus]=useState<JobApplicationStatus|null>(null);
 const [applicationId,setApplicationId]=useState<string|null>(null);
 const [saved,setSaved]=useState(false);

 useEffect(()=>{
  if(!id)return;
  loadMyJobApplicationForJob(id).then(x=>{setApplicationStatus(x?.status??null);setApplicationId(x?.id??null)}).catch(()=>{setApplicationStatus(null);setApplicationId(null)});
  isJobSaved(id).then(setSaved).catch(()=>setSaved(false));
  loadJob(id).then(setJob).catch(()=>setError('This job could not be loaded.')).finally(()=>setLoading(false));
 },[id]);

 useFocusEffect(useCallback(()=>{
  if(!id)return;
  let active=true;
  isJobSaved(id).then(value=>{if(active)setSaved(value)}).catch(()=>{});
  return()=>{active=false};
 },[id]));

 async function save(){
  if(!job)return;
  try{
   if(saved){await unsaveJob(job.id);setSaved(false)}
   else{await saveJob(job.id);setSaved(true)}
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){router.push(('/sign-up?returnTo='+encodeURIComponent('/job/'+job.id)) as never);return}
   notify('Could not update saved job','Please try again.');
  }
 }

 async function openCompanyWebsite(){
  if(!job?.company_website_url)return;
  const raw=job.company_website_url.trim();
  const url=/^https?:\/\//i.test(raw)?raw:'https://'+raw;
  try{await Linking.openURL(url)}catch{notify('Website unavailable','We could not open this company website.')}
 }

 async function apply(){
  if(!job)return;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){
   router.push(('/sign-up?returnTo='+encodeURIComponent('/job/'+job.id)) as never);
   return;
  }
  if(applicationStatus){router.push((applicationId?'/job-application/'+applicationId:'/job-applications') as never);return;}
  const expiredByTime=Boolean(job.expires_at&&new Date(job.expires_at).getTime()<=Date.now());
  if(expiredByTime||job.status==='expired'||job.status==='closed'||job.status==='filled'){
   notify('Job unavailable',job.status==='filled'?'This position has been filled.':expiredByTime||job.status==='expired'?'This job posting has expired.':'This job is no longer accepting applications.');
   return;
  }
  if(job.application_method==='external'&&job.external_apply_url){
   try{await Linking.openURL(job.external_apply_url)}catch{notify('Link unavailable','We could not open this application link.')}
   return;
  }
  router.push(('/job-apply/'+job.id) as never);
 }

 if(loading)return <ScreenFrame><PageHeader eyebrow="FAIRPATH JOBS" title="Job" backTo="/find-jobs"/><View style={s.state}><Text style={s.stateText}>Loading job…</Text></View></ScreenFrame>;
 if(error||!job)return <ScreenFrame><PageHeader eyebrow="FAIRPATH JOBS" title="Job" backTo="/find-jobs"/><View style={s.state}><Text style={s.error}>{error||'Job not found.'}</Text></View></ScreenFrame>;

 const location=job.location_text||[job.city,job.state,job.postal_code].filter(Boolean).join(', ');
 const second=job.eligibility_rules?.second_chance_evidence==='explicit';
 const expiredByTime=Boolean(job.expires_at&&new Date(job.expires_at).getTime()<=Date.now());
 const inactive=expiredByTime||job.status==='expired'||job.status==='closed'||job.status==='filled';
 const daysLeft=job.expires_at&&!inactive?Math.max(0,Math.ceil((new Date(job.expires_at).getTime()-Date.now())/86400000)):null;
 const lifecycleLabel=job.status==='filled'?'POSITION FILLED':expiredByTime||job.status==='expired'?'JOB EXPIRED':job.status==='closed'?'JOB CLOSED':daysLeft!=null?daysLeft+' DAYS LEFT':null;
 const applied=Boolean(applicationStatus);

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH JOBS" title="Job details" backTo="/find-jobs" trailing={<Pressable style={[s.save,saved&&s.saveActive]} onPress={()=>void save()}><Text style={[s.saveText,saved&&s.saveTextActive]}>{saved?'SAVED':'SAVE'}</Text></Pressable>}/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <Text style={s.company}>{job.company_name.toUpperCase()}</Text>
   <Text style={s.title}>{job.title}</Text>

   <View style={s.locationRow}>
    <Text style={s.location}>{location||'Location not listed'}</Text>
    {job.location_precision==='city'?<Text style={s.approx}>APPROX. AREA</Text>:null}
   </View>

   {job.company_website_url?<Pressable style={s.companySite} onPress={()=>void openCompanyWebsite()}>
    <Text style={s.companySiteLabel}>COMPANY WEBSITE</Text>
    <Text style={s.companySiteAction}>VISIT ↗</Text>
   </Pressable>:null}

   <View style={s.badges}>
    {lifecycleLabel?<InlineBadge tone={inactive?'default':'lime'}>{lifecycleLabel}</InlineBadge>:null}
    <InlineBadge tone={second?'lime':'default'}>{second?'VERIFIED SECOND-CHANCE':'POLICY REVIEW NEEDED'}</InlineBadge>
    {job.easy_apply_enabled?<InlineBadge tone="lime">EASY APPLY</InlineBadge>:null}
    <InlineBadge>{job.workplace_type.toUpperCase()}</InlineBadge>
    <InlineBadge>{job.employment_type.replace('_',' ').toUpperCase()}</InlineBadge>
   </View>

   {job.pay_min!=null?<View style={s.fact}>
    <Text style={s.factLabel}>PAY</Text>
    <Text style={s.factValue}>{'$'+Number(job.pay_min).toLocaleString()+(job.pay_max?' – $'+Number(job.pay_max).toLocaleString():'')+' / '+(job.pay_period||'period')}</Text>
   </View>:null}

   {job.latitude!=null&&job.longitude!=null?<View style={s.mapSection}>
    <Text style={s.sectionLabel}>WORK AREA</Text>
    <JobMap jobs={[job]} compact/>
   </View>:null}

   <View style={s.section}><Text style={s.sectionLabel}>ABOUT THE ROLE</Text><Text style={s.body}>{job.description}</Text></View>
   {job.background_policy_summary?<View style={s.section}><Text style={s.sectionLabel}>BACKGROUND POLICY</Text><Text style={s.body}>{job.background_policy_summary}</Text></View>:null}
   {job.requirements?.length?<View style={s.section}><Text style={s.sectionLabel}>REQUIREMENTS</Text>{job.requirements.map(x=><Text key={x} style={s.line}>— {x}</Text>)}</View>:null}
   {job.skills?.length?<View style={s.section}><Text style={s.sectionLabel}>SKILLS</Text><Text style={s.body}>{job.skills.join(' · ')}</Text></View>:null}
   {job.benefits?.length?<View style={s.section}><Text style={s.sectionLabel}>BENEFITS</Text><Text style={s.body}>{job.benefits.join(' · ')}</Text></View>:null}

   <View style={s.source}><Text style={s.sourceLabel}>SOURCE</Text><Text style={s.sourceText}>{job.source_label||'FairPath'}</Text></View>
  </ScrollView>

  <View style={s.bottom}>
   <Pressable style={[s.apply,(inactive||applied)&&s.applyDisabled]} onPress={apply}>
    <Text style={[s.applyText,(inactive||applied)&&s.applyTextDisabled]}>{applied?'VIEW APPLICATION':inactive?(job.status==='filled'?'POSITION FILLED':expiredByTime||job.status==='expired'?'JOB EXPIRED':'JOB CLOSED'):job.application_method==='external'?'CONTINUE TO APPLY':job.easy_apply_enabled?'EASY APPLY WITH FAIRPATH':'APPLY WITH FAIRPATH'}</Text>
    <Text style={[s.applyText,(inactive||applied)&&s.applyTextDisabled]}>{applied?'→':inactive?'—':'→'}</Text>
   </Pressable>
  </View>
 </ScreenFrame>;
}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:20,paddingBottom:110},
 state:{padding:L.mobileGutter},stateText:{color:C.muted},error:{color:C.danger},
 save:{height:32,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,justifyContent:'center'},saveActive:{backgroundColor:C.lime,borderColor:C.lime},saveText:{color:C.white,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},saveTextActive:{color:C.black},
 company:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.2},
 title:{color:C.white,fontFamily:F.extraBold,fontSize:31,lineHeight:33,letterSpacing:-.9,marginTop:7},
 locationRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:10},
 location:{color:C.mutedStrong,fontSize:13,flex:1},approx:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 companySite:{marginTop:14,paddingVertical:11,borderTopWidth:1,borderBottomWidth:1,borderColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},companySiteLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},companySiteAction:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 badges:{flexDirection:'row',gap:6,flexWrap:'wrap',marginTop:15},
 fact:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},
 factLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},
 factValue:{color:C.white,fontFamily:F.extraBold,fontSize:17,marginTop:5},
 mapSection:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},
 section:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},
 sectionLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginBottom:8},
 body:{color:C.mutedStrong,fontSize:13,lineHeight:20},line:{color:C.mutedStrong,fontSize:13,lineHeight:21},
 source:{paddingVertical:16},sourceLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},sourceText:{color:C.mutedStrong,fontSize:11,marginTop:4},
 bottom:{position:'absolute',left:0,right:0,bottom:0,paddingHorizontal:L.mobileGutter,paddingTop:10,paddingBottom:14,backgroundColor:C.black,borderTopWidth:1,borderTopColor:C.border},
 apply:{height:48,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},applyDisabled:{backgroundColor:'#1A2114',borderWidth:1,borderColor:'#2C3823'},
 applyText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:.8},applyTextDisabled:{color:C.mutedStrong}
});