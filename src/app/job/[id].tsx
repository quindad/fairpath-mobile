import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { JobMap } from '@/components/JobMap';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { isJobSaved, loadJob, loadMyJobApplicationForJob, saveJob, unsaveJob, type Job, type JobApplicationStatus } from '@/core/opportunities/opportunity-service';
import { loadFairPathReadiness } from '@/core/profile/profile-service';

const DEMO_JOBS:Record<string,Job>={
 'demo-warehouse':{
  id:'demo-warehouse',title:'Warehouse Associate',company_name:'Second Chance Logistics',
  description:'Sample FairPath opportunity used to preview the job experience.',location_text:'Columbus, OH',
  city:'Columbus',state:'OH',postal_code:null,workplace_type:'onsite',employment_type:'full_time',
  pay_min:19,pay_max:23,pay_period:'hour',benefits:['Sample benefits'],skills:['Warehouse operations'],
  requirements:['Sample requirements shown for preview only'],
  background_policy_summary:'Demo second-chance opportunity. This is sample data, not a live employer posting.',
  eligibility_rules:{second_chance_evidence:'explicit'},application_method:'demo',external_apply_url:null,
  source_label:'FairPath Demo',source_url:null,featured:true,created_at:new Date().toISOString(),
  latitude:39.9612,longitude:-82.9988,location_precision:'city',easy_apply_enabled:true,application_questions:[]
 },
 'demo-support':{
  id:'demo-support',title:'Customer Support Specialist',company_name:'Pathway Services',
  description:'Sample FairPath opportunity used to preview the job experience.',location_text:'Remote',
  city:null,state:null,postal_code:null,workplace_type:'remote',employment_type:'full_time',
  pay_min:20,pay_max:25,pay_period:'hour',benefits:['Sample benefits'],skills:['Customer support'],
  requirements:['Sample requirements shown for preview only'],
  background_policy_summary:'Demo opportunity. This is sample data, not a live employer posting.',
  eligibility_rules:{second_chance_evidence:'explicit'},application_method:'demo',external_apply_url:null,
  source_label:'FairPath Demo',source_url:null,featured:true,created_at:new Date().toISOString(),
  latitude:null,longitude:null,location_precision:'remote',easy_apply_enabled:true,application_questions:[]
 }
};

export default function JobDetail(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [job,setJob]=useState<Job|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [readiness,setReadiness]=useState<number|null>(null);
 const [applicationStatus,setApplicationStatus]=useState<JobApplicationStatus|null>(null);
 const [applicationId,setApplicationId]=useState<string|null>(null);
 const [saved,setSaved]=useState(false);

 useEffect(()=>{
  if(!id)return;
  loadFairPathReadiness().then(({readiness})=>setReadiness(readiness.overallPercentage)).catch(()=>setReadiness(0));
  loadMyJobApplicationForJob(id).then(x=>{setApplicationStatus(x?.status??null);setApplicationId(x?.id??null)}).catch(()=>{setApplicationStatus(null);setApplicationId(null)});
  if(!id.startsWith('demo-'))isJobSaved(id).then(setSaved).catch(()=>setSaved(false));
  if(DEMO_JOBS[id]){setJob(DEMO_JOBS[id]);setLoading(false);return}
  loadJob(id).then(setJob).catch(()=>setError('This job could not be loaded.')).finally(()=>setLoading(false));
 },[id]);

 async function save(){
  if(!job)return;
  if(job.application_method==='demo'){Alert.alert('Preview job','Sample jobs are not saved to your account.');return}
  try{
   if(saved){await unsaveJob(job.id);setSaved(false)}
   else{await saveJob(job.id);setSaved(true)}
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){router.push(('/sign-in?returnTo='+encodeURIComponent('/job/'+job.id)) as never);return}
   Alert.alert('Could not update saved job','Please try again.');
  }
 }

 async function openCompanyWebsite(){
  if(!job?.company_website_url)return;
  const raw=job.company_website_url.trim();
  const url=/^https?:\/\//i.test(raw)?raw:'https://'+raw;
  try{await Linking.openURL(url)}catch{Alert.alert('Website unavailable','We could not open this company website.')}
 }

 async function apply(){
  if(!job)return;
  if(applicationStatus){router.push((applicationId?'/job-application/'+applicationId:'/job-applications') as never);return;}
  const expiredByTime=Boolean(job.expires_at&&new Date(job.expires_at).getTime()<=Date.now());
  if(expiredByTime||job.status==='expired'||job.status==='closed'||job.status==='filled'){
   Alert.alert('Job unavailable',job.status==='filled'?'This position has been filled.':expiredByTime||job.status==='expired'?'This job posting has expired.':'This job is no longer accepting applications.');
   return;
  }
  if(job.application_method==='demo'){
   Alert.alert('Preview job','This is sample data for the FairPath preview. Live jobs can use FairPath Easy Apply.');
   return;
  }
  if(job.application_method==='external'&&job.external_apply_url){
   await Linking.openURL(job.external_apply_url);
   return;
  }
  if(job.easy_apply_enabled&&readiness!==100){
   router.push(('/complete-profile?returnTo='+encodeURIComponent('/job/'+job.id)) as never);
   return;
  }
  router.push(('/job-apply/'+job.id) as never);
 }

 if(loading)return <ScreenFrame><PageHeader eyebrow="FAIRPATH JOBS" title="Job"/><View style={s.state}><Text style={s.stateText}>Loading job…</Text></View></ScreenFrame>;
 if(error||!job)return <ScreenFrame><PageHeader eyebrow="FAIRPATH JOBS" title="Job"/><View style={s.state}><Text style={s.error}>{error||'Job not found.'}</Text></View></ScreenFrame>;

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
    <Text style={[s.applyText,(inactive||applied)&&s.applyTextDisabled]}>{applied?'VIEW APPLICATION':inactive?(job.status==='filled'?'POSITION FILLED':expiredByTime||job.status==='expired'?'JOB EXPIRED':'JOB CLOSED'):job.application_method==='demo'?'PREVIEW LISTING':job.application_method==='external'?'CONTINUE TO APPLY':job.easy_apply_enabled&&readiness!==100?'COMPLETE PROFILE TO UNLOCK':job.easy_apply_enabled?'EASY APPLY WITH FAIRPATH':'APPLY WITH FAIRPATH'}</Text>
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