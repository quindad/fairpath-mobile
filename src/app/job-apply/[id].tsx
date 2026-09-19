import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadJob, loadJobApplicationAutofill, submitJobApplication, type Job, type JobApplicationAutofill } from '@/core/opportunities/opportunity-service';

const EMPTY:JobApplicationAutofill={first_name:'',last_name:'',email:'',phone:'',address:'',date_of_birth:'',education:'',skills:'',certifications:'',desired_roles:'',resume_ready:''};

export default function JobApply(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [job,setJob]=useState<Job|null>(null);
 const [form,setForm]=useState<JobApplicationAutofill>(EMPTY);
 const [extra,setExtra]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [submitting,setSubmitting]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{if(!id)return;Promise.all([loadJob(id),loadJobApplicationAutofill()]).then(([j,a])=>{setJob(j);setForm(a)}).catch(e=>{if(e instanceof Error&&e.message==='SIGNED_OUT'){router.replace('/sign-in' as never);return}setError('Application could not load.')}).finally(()=>setLoading(false))},[id]);

 const requiredKeys:(keyof JobApplicationAutofill)[]=['first_name','last_name','email','phone','address'];
 const completion=useMemo(()=>Math.round(requiredKeys.filter(k=>form[k].trim()).length/requiredKeys.length*100),[form]);
 const questions=job?.application_questions??[];
 const requiredExtras=questions.filter(q=>q.required);
 const missingExtra=requiredExtras.some(q=>!String(extra[q.id]??'').trim());
 const ready=completion===100&&!missingExtra;

 function set<K extends keyof JobApplicationAutofill>(key:K,value:string){setForm(v=>({...v,[key]:value}))}

 async function submit(){
  if(!job||!id)return;
  if(!ready){Alert.alert('Application not ready','Complete the required fields before submitting.');return}
  setSubmitting(true);
  try{
   await submitJobApplication(id,{profile:form,employer_questions:extra,reviewed_by_user:true,reviewed_at:new Date().toISOString()});
   Alert.alert('Application sent','Your FairPath Easy Apply application was submitted.',[{text:'Done',onPress:()=>router.replace(('/job/'+id) as never)}]);
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){router.replace('/sign-in' as never);return}
   Alert.alert('Could not submit','Please try again.');
  }finally{setSubmitting(false)}
 }

 if(loading)return <ScreenFrame><PageHeader eyebrow="EASY APPLY" title="Application"/><View style={s.state}><Text style={s.muted}>Preparing your application…</Text></View></ScreenFrame>;
 if(error||!job)return <ScreenFrame><PageHeader eyebrow="EASY APPLY" title="Application"/><View style={s.state}><Text style={s.error}>{error||'Job not found.'}</Text></View></ScreenFrame>;

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH EASY APPLY" title="Review application"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.hero}>
    <Text style={s.company}>{job.company_name.toUpperCase()}</Text>
    <Text style={s.title}>{job.title}</Text>
    <View style={s.readyRow}><Text style={s.readyLabel}>APPLICATION READY</Text><Text style={s.readyPct}>{completion}%</Text></View>
    <View style={s.track}><View style={[s.fill,{width:completion+'%'}]}/></View>
   </View>

   <View style={s.notice}>
    <Lucide name="wand-sparkles" color={C.lime} size={17}/>
    <View style={s.noticeCopy}><Text style={s.noticeTitle}>Autofilled from your FairPath profile</Text><Text style={s.noticeBody}>Review every field before submitting. FairPath does not auto-answer criminal-history questions.</Text></View>
   </View>

   <Text style={s.sectionLabel}>CONTACT</Text>
   <Field label="FIRST NAME" value={form.first_name} onChangeText={v=>set('first_name',v)} />
   <Field label="LAST NAME" value={form.last_name} onChangeText={v=>set('last_name',v)} />
   <Field label="EMAIL" value={form.email} onChangeText={v=>set('email',v)} keyboardType="email-address" />
   <Field label="PHONE" value={form.phone} onChangeText={v=>set('phone',v)} keyboardType="phone-pad" />
   <Field label="ADDRESS / LOCATION" value={form.address} onChangeText={v=>set('address',v)} />

   <Text style={s.sectionLabel}>PROFILE</Text>
   <Field label="DATE OF BIRTH" value={form.date_of_birth} onChangeText={v=>set('date_of_birth',v)} />
   <Field label="EDUCATION" value={form.education} onChangeText={v=>set('education',v)} />
   <Field label="SKILLS" value={form.skills} onChangeText={v=>set('skills',v)} multiline />
   <Field label="CERTIFICATIONS" value={form.certifications} onChangeText={v=>set('certifications',v)} multiline />
   <Field label="WORK PREFERENCES" value={form.desired_roles} onChangeText={v=>set('desired_roles',v)} multiline />
   <Field label="RESUME READY" value={form.resume_ready} onChangeText={v=>set('resume_ready',v)} />

   {questions.length?<><Text style={s.sectionLabel}>EMPLOYER QUESTIONS</Text>{questions.map(q=><View key={q.id} style={s.question}>
    <Text style={s.questionLabel}>{q.label}{q.required?' *':''}</Text>
    {q.type==='yes_no'?<View style={s.yesNo}><Choice label="YES" active={extra[q.id]==='Yes'} onPress={()=>setExtra(v=>({...v,[q.id]:'Yes'}))}/><Choice label="NO" active={extra[q.id]==='No'} onPress={()=>setExtra(v=>({...v,[q.id]:'No'}))}/></View>:<TextInput value={extra[q.id]??''} onChangeText={v=>setExtra(x=>({...x,[q.id]:v}))} style={[s.input,s.multiline]} placeholder="Your answer" placeholderTextColor={C.muted} multiline/>}
   </View>)}</>:null}

   <View style={s.review}>
    <Lucide name="shield-check" color={C.lime} size={17}/>
    <Text style={s.reviewText}>Nothing is submitted until you tap SUBMIT APPLICATION. You can edit every autofilled field first.</Text>
   </View>

   <Pressable style={[s.submit,!ready&&s.submitDisabled]} disabled={!ready||submitting} onPress={()=>void submit()}>
    <Text style={s.submitText}>{submitting?'SUBMITTING…':'SUBMIT APPLICATION'}</Text>
    <Lucide name="arrow-right" color={C.black} size={16}/>
   </Pressable>
  </ScrollView>
 </ScreenFrame>;
}

function Field({label,value,onChangeText,multiline=false,keyboardType}:{label:string;value:string;onChangeText:(v:string)=>void;multiline?:boolean;keyboardType?:'default'|'email-address'|'phone-pad'}){
 return <View style={s.field}><Text style={s.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} style={[s.input,multiline&&s.multiline]} placeholder="Add information" placeholderTextColor={C.muted} multiline={multiline} keyboardType={keyboardType}/></View>
}
function Choice({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable style={[s.choice,active&&s.choiceActive]} onPress={onPress}><Text style={[s.choiceText,active&&s.choiceTextActive]}>{label}</Text></Pressable>}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:14,paddingBottom:36},state:{padding:L.mobileGutter},muted:{color:C.muted},error:{color:C.danger},
 hero:{paddingBottom:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},company:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1},title:{color:C.white,fontFamily:F.extraBold,fontSize:24,lineHeight:27,marginTop:5},readyRow:{flexDirection:'row',justifyContent:'space-between',marginTop:16},readyLabel:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},readyPct:{color:C.lime,fontFamily:F.extraBold,fontSize:13},track:{height:2,backgroundColor:C.borderStrong,marginTop:7},fill:{height:2,backgroundColor:C.lime},
 notice:{flexDirection:'row',gap:10,paddingVertical:15,borderBottomWidth:1,borderBottomColor:C.borderStrong},noticeCopy:{flex:1},noticeTitle:{color:C.white,fontFamily:F.bold,fontSize:11},noticeBody:{color:C.muted,fontSize:9,lineHeight:14,marginTop:3},
 sectionLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2,marginTop:20,marginBottom:7},
 field:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:11},fieldLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},input:{color:C.white,fontFamily:F.medium,fontSize:12,paddingVertical:6,paddingHorizontal:0},multiline:{minHeight:58,textAlignVertical:'top'},
 question:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:12},questionLabel:{color:C.white,fontFamily:F.bold,fontSize:11,lineHeight:16},yesNo:{flexDirection:'row',gap:8,marginTop:9},choice:{flex:1,height:38,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},choiceActive:{borderColor:C.lime,backgroundColor:'#10150C'},choiceText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8},choiceTextActive:{color:C.lime},
 review:{flexDirection:'row',gap:9,paddingVertical:16,borderTopWidth:1,borderTopColor:C.borderStrong,marginTop:18},reviewText:{flex:1,color:C.mutedStrong,fontSize:9,lineHeight:14},
 submit:{height:48,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},submitDisabled:{opacity:.35},submitText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9}
});