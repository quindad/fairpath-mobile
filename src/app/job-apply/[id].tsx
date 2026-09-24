import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notify } from '@/core/ui/notify';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadJob, loadJobApplicationAutofill, loadMyJobApplicationForJob, saveJobApplicationProfile, submitJobApplication, type Job, type JobApplicationAutofill } from '@/core/opportunities/opportunity-service';
import { loadFairPathReadiness } from '@/core/profile/profile-service';
import { formatDateInput, formatUsPhone } from '@/core/forms/formatters';

const EMPTY:JobApplicationAutofill={first_name:'',last_name:'',email:'',phone:'',address:'',date_of_birth:'',education:'',skills:'',certifications:'',desired_roles:'',resume_ready:''};

export default function JobApply(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [job,setJob]=useState<Job|null>(null);
 const [form,setForm]=useState<JobApplicationAutofill>(EMPTY);
 const [extra,setExtra]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{if(!id)return;Promise.all([loadJob(id),loadJobApplicationAutofill(),loadFairPathReadiness(),loadMyJobApplicationForJob(id)]).then(([j,a,r,existing])=>{if(existing){router.replace(('/job-application/'+existing.id) as never);return}if(r.readiness.overallPercentage!==100){router.replace(('/complete-profile?returnTo='+encodeURIComponent('/job/'+id)) as never);return}setJob(j);setForm(a)}).catch(e=>{if(e instanceof Error&&e.message==='SIGNED_OUT'){router.replace(('/sign-up?returnTo='+encodeURIComponent('/job/'+id)) as never);return}setError('Application could not load.')}).finally(()=>setLoading(false))},[id]);

 const requiredKeys:(keyof JobApplicationAutofill)[]=['first_name','last_name','email','phone','address'];
 const validRequired=(key:keyof JobApplicationAutofill,value:string)=>{
  const v=value.trim();
  if(!v)return false;
  if(key==='first_name'||key==='last_name')return v.length>=2;
  if(key==='email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  if(key==='phone')return v.replace(/\D/g,'').length===10;
  if(key==='address')return v.length>=10&&/\d/.test(v)&&/[A-Za-z]/.test(v);
  return true;
 };
 const completedRequired=useMemo(()=>requiredKeys.filter(k=>validRequired(k,form[k])).length,[form]);
 const completion=useMemo(()=>Math.round(completedRequired/requiredKeys.length*100),[completedRequired]);
 const questions=job?.application_questions??[];
 const requiredExtras=questions.filter(q=>q.required);
 const missingRequiredFields=requiredKeys.filter(k=>!validRequired(k,form[k]));
 const missingExtraCount=requiredExtras.filter(q=>!String(extra[q.id]??'').trim()).length;
 const missingCount=missingRequiredFields.length+missingExtraCount;
 const ready=missingCount===0;

 function set<K extends keyof JobApplicationAutofill>(key:K,value:string){setForm(v=>({...v,[key]:value}))}

 async function submit(){
  if(!job||!id)return;
  if(!ready){notify('Application not ready','Complete the required fields before submitting.');return}
  setSubmitting(true);
  try{
   await saveJobApplicationProfile(form);
   const applicationId=await submitJobApplication(id,{profile:form,employer_questions:extra,reviewed_by_user:true,reviewed_at:new Date().toISOString()});
   router.replace((applicationId?'/job-application/'+applicationId:'/job-applications') as never);
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){router.replace(('/sign-up?returnTo='+encodeURIComponent('/job/'+id)) as never);return}
   if(e instanceof Error&&e.message==='ALREADY_APPLIED'){notify('Already applied','You already submitted an application for this job.',[{text:'View application',onPress:()=>router.replace('/job-applications' as never)}]);return}
   notify('Could not submit','Please try again.');
  }finally{setSubmitting(false)}
 }

 if(loading)return <ScreenFrame><PageHeader eyebrow="EASY APPLY" title="Application" backTo={id?'/job/'+id:'/find-jobs'} alwaysBackTo/><View style={s.state}><Text style={s.muted}>Preparing your application…</Text></View></ScreenFrame>;
 if(error||!job)return <ScreenFrame><PageHeader eyebrow="EASY APPLY" title="Application" backTo={id?'/job/'+id:'/find-jobs'} alwaysBackTo/><View style={s.state}><Text style={s.error}>{error||'Job not found.'}</Text></View></ScreenFrame>;

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH EASY APPLY" title="Review application" backTo={id?'/job/'+id:'/find-jobs'} alwaysBackTo/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.hero}>
    <Text style={s.company}>{job.company_name.toUpperCase()}</Text>
    <Text style={s.title}>{job.title}</Text>
    <View style={s.readyRow}><Text style={s.readyLabel}>{ready?'READY TO SUBMIT':missingCount+' REQUIRED '+(missingCount===1?'ITEM':'ITEMS')+' LEFT'}</Text><Text style={s.readyPct}>{completion}%</Text></View>
    <View style={s.track}><View style={[s.fill,{width:(completion+'%') as any}]}/></View>
   </View>

   <View style={s.notice}>
    <Lucide name="wand-sparkles" color={C.lime} size={17}/>
    <View style={s.noticeCopy}><Text style={s.noticeTitle}>Autofilled from your FairPath profile</Text><Text style={s.noticeBody}>Review every field before submitting. Reusable details you update here are saved to your FairPath profile for future Easy Apply applications. FairPath does not auto-answer criminal-history questions.</Text></View>
   </View>

   <Text style={s.sectionLabel}>CONTACT</Text>
   <Field label="FIRST NAME" value={form.first_name} onChangeText={v=>set('first_name',v)} required valid={validRequired('first_name',form.first_name)} invalidHint="Enter your full first name" />
   <Field label="LAST NAME" value={form.last_name} onChangeText={v=>set('last_name',v)} required valid={validRequired('last_name',form.last_name)} invalidHint="Enter your full last name" />
   <Field label="EMAIL" value={form.email} onChangeText={v=>set('email',v)} keyboardType="email-address" required valid={validRequired('email',form.email)} invalidHint="Enter a valid email address" />
   <Field label="PHONE" value={formatUsPhone(form.phone)} onChangeText={v=>set('phone',formatUsPhone(v))} keyboardType="phone-pad" required valid={validRequired('phone',form.phone)} invalidHint="Enter a 10-digit phone number" />
   <Field label="HOME ADDRESS" value={form.address} onChangeText={v=>set('address',v)} required valid={validRequired('address',form.address)} invalidHint="Enter your full street address" />

   <Text style={s.sectionLabel}>PROFILE</Text>
   <Field label="DATE OF BIRTH" value={formatDateInput(form.date_of_birth)} onChangeText={v=>set('date_of_birth',formatDateInput(v))} />
   <Field label="EDUCATION" value={form.education} onChangeText={v=>set('education',v)} />
   <Field label="SKILLS" value={form.skills} onChangeText={v=>set('skills',v)} multiline />
   <Field label="CERTIFICATIONS" value={form.certifications} onChangeText={v=>set('certifications',v)} multiline />
   <Field label="WORK PREFERENCES" value={form.desired_roles} onChangeText={v=>set('desired_roles',v)} multiline />
   <Field label="RESUME READY" value={form.resume_ready} onChangeText={v=>set('resume_ready',v)} />

   {questions.length?<><Text style={s.sectionLabel}>EMPLOYER QUESTIONS</Text>{questions.map(q=><View key={q.id} style={s.question}>
    <View style={s.questionHead}><Text style={s.questionLabel}>{q.label}</Text>{q.required?<Text style={s.requiredTag}>REQUIRED</Text>:null}</View>
    {q.type==='yes_no'?<View style={s.yesNo}><Choice label="YES" active={extra[q.id]==='Yes'} onPress={()=>setExtra(v=>({...v,[q.id]:'Yes'}))}/><Choice label="NO" active={extra[q.id]==='No'} onPress={()=>setExtra(v=>({...v,[q.id]:'No'}))}/></View>:<TextInput value={extra[q.id]??''} onChangeText={v=>setExtra(x=>({...x,[q.id]:v}))} style={[s.input,s.multiline]} placeholder="Your answer" placeholderTextColor={C.muted} multiline/>}
   </View>)}</>:null}

   <View style={s.review}>
    <Lucide name="shield-check" color={C.lime} size={17}/>
    <Text style={s.reviewText}>Nothing is submitted until you tap SUBMIT APPLICATION. You can edit every autofilled field first.</Text>
   </View>

   <Pressable style={[s.submit,!ready&&s.submitDisabled]} disabled={!ready||submitting} onPress={()=>void submit()}>
    <Text style={[s.submitText,!ready&&s.submitTextDisabled]}>{submitting?'SUBMITTING…':ready?'SUBMIT APPLICATION':'COMPLETE REQUIRED ITEMS'}</Text>
    <Lucide name="arrow-right" color={ready?C.black:C.mutedStrong} size={16}/>
   </Pressable>
  </ScrollView>
 </ScreenFrame>;
}

function Field({label,value,onChangeText,multiline=false,keyboardType,required=false,valid=true,invalidHint='Complete this field'}:{label:string;value:string;onChangeText:(v:string)=>void;multiline?:boolean;keyboardType?:'default'|'email-address'|'phone-pad';required?:boolean;valid?:boolean;invalidHint?:string}){
 const invalid=required&&!valid;
 return <View style={[s.field,invalid&&s.fieldMissing]}>
  <View style={s.fieldHead}><Text style={s.fieldLabel}>{label}</Text>{required?<Text style={s.requiredTag}>REQUIRED</Text>:null}</View>
  <TextInput value={value} onChangeText={onChangeText} style={[s.input,multiline&&s.multiline]} placeholder={invalid?"Required information":"Add information"} placeholderTextColor={invalid?C.lime:C.muted} multiline={multiline} keyboardType={keyboardType}/>
  {invalid&&value.trim()?<Text style={s.validationText}>{invalidHint}</Text>:null}
 </View>
}
function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable style={[s.choice,active&&s.choiceActive]} onPress={onPress}><Text style={[s.choiceText,active&&s.choiceTextActive]}>{label}</Text></Pressable>}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:14,paddingBottom:36},state:{padding:L.mobileGutter},muted:{color:C.muted},error:{color:C.danger},
 hero:{paddingBottom:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},company:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1},title:{color:C.white,fontFamily:F.extraBold,fontSize:24,lineHeight:27,marginTop:5},readyRow:{flexDirection:'row',justifyContent:'space-between',marginTop:16},readyLabel:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},readyPct:{color:C.lime,fontFamily:F.extraBold,fontSize:13},track:{height:2,backgroundColor:C.borderStrong,marginTop:7},fill:{height:2,backgroundColor:C.lime},
 notice:{flexDirection:'row',gap:10,paddingVertical:15,borderBottomWidth:1,borderBottomColor:C.borderStrong},noticeCopy:{flex:1},noticeTitle:{color:C.white,fontFamily:F.bold,fontSize:11},noticeBody:{color:C.muted,fontSize:9,lineHeight:14,marginTop:3},
 sectionLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2,marginTop:20,marginBottom:7},
 field:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:11,paddingLeft:0},fieldMissing:{borderLeftWidth:2,borderLeftColor:C.lime,paddingLeft:10},fieldHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},fieldLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},requiredTag:{color:C.lime,fontFamily:F.extraBold,fontSize:6,letterSpacing:.9},validationText:{color:C.lime,fontFamily:F.medium,fontSize:8,marginTop:2},input:{color:C.white,fontFamily:F.medium,fontSize:12,paddingVertical:6,paddingHorizontal:0},multiline:{minHeight:58,textAlignVertical:'top'},
 question:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:12},questionHead:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:12},questionLabel:{color:C.white,fontFamily:F.bold,fontSize:11,lineHeight:16,flex:1},yesNo:{flexDirection:'row',gap:8,marginTop:9},choice:{flex:1,height:38,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},choiceActive:{borderColor:C.lime,backgroundColor:'#10150C'},choiceText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8},choiceTextActive:{color:C.lime},
 review:{flexDirection:'row',gap:9,paddingVertical:16,borderTopWidth:1,borderTopColor:C.borderStrong,marginTop:18},reviewText:{flex:1,color:C.mutedStrong,fontSize:9,lineHeight:14},
 submit:{height:48,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},submitDisabled:{backgroundColor:'#1A2114',borderWidth:1,borderColor:'#2C3823',opacity:1},submitText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},submitTextDisabled:{color:C.mutedStrong}
});