import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FairPathColors } from '@/constants/fairpath';
import { getRequiredVisibleQuestions, type ProfileQuestion } from '@/core/models/profile-questions';
import { calculateFairPathReadiness } from '@/core/models/readiness-engine';
import { loadProfileAnswers, saveProfileAnswer } from '@/core/profile/profile-service';
import type { ReadinessArea } from '@/core/models/readiness';

const LIME=FairPathColors.lime,BLACK=FairPathColors.black,CARD=FairPathColors.card,MUTED=FairPathColors.muted;
const YES_NO=['Yes','No'];
const areaNames:Record<ReadinessArea,string>={identity:'IDENTITY',employment:'EMPLOYMENT',housing:'HOUSING',reentry:'REENTRY',documents:'DOCUMENTS',eligibility:'ELIGIBILITY'};

function decodeValue(q:ProfileQuestion,value:unknown){
 if(q.input==='yes_no') return value===true?'Yes':value===false?'No':'';
 if(Array.isArray(value)) return value as string[];
 if(value===null||value===undefined) return '';
 return String(value);
}
function encodeValue(q:ProfileQuestion,value:string|string[]){
 if(q.input==='yes_no') return value==='Yes';
 if(q.input==='number') return Number(value);
 return value;
}
function validationMessage(q:ProfileQuestion|null,value:string|string[]){
 if(!q)return '';
 const text=Array.isArray(value)?'':String(value).trim();
 if(q.id==='identity.phone'){
  const digits=text.replace(/\D/g,'');
  if(digits.length!==10)return 'Enter a valid 10-digit phone number.';
 }
 return '';
}

export default function CompleteProfile(){
 const {width,height}=useWindowDimensions();
 const compact=height<760;
 const desktop=width>=768;
 const params=useLocalSearchParams<{area?:string;returnTo?:string}>();
 const requestedArea=(typeof params.area==='string'?params.area:null) as ReadinessArea|null;
 const returnTo=typeof params.returnTo==='string'&&params.returnTo.startsWith('/')?params.returnTo:null;
 const [answers,setAnswers]=useState<Record<string,unknown>>({});
 const [question,setQuestion]=useState<ProfileQuestion|null>(null);
 const [value,setValue]=useState<string|string[]>('');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const [demoMode,setDemoMode]=useState(false);
 const [percent,setPercent]=useState(0);

 function chooseNext(nextAnswers:Record<string,unknown>,preferredArea=requestedArea){
  const required=getRequiredVisibleQuestions(nextAnswers);
  const unanswered=required.filter(q=>nextAnswers[q.id]===null||nextAnswers[q.id]===undefined||nextAnswers[q.id]===''||(Array.isArray(nextAnswers[q.id])&&(nextAnswers[q.id] as unknown[]).length===0));
  const next=(preferredArea?unanswered.find(q=>q.area===preferredArea):null)??unanswered[0]??null;
  setQuestion(next);
  setValue(next?decodeValue(next,nextAnswers[next.id]):'');
  setPercent(calculateFairPathReadiness(nextAnswers).overallPercentage);
  if(!next) router.replace((returnTo??'/profile-readiness') as never);
 }

 useEffect(()=>{let active=true;loadProfileAnswers().then(a=>{if(active){setAnswers(a);chooseNext(a);}}).catch(()=>{if(active){setDemoMode(true);setError('Preview mode: sign in to save this profile permanently.');chooseNext({});}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);

 const options=useMemo(()=>question?.input==='yes_no'?YES_NO:question?.options??[],[question]);
 const multi=question?.input==='multi_select';
 const validation=validationMessage(question,value);
 const hasValue=Array.isArray(value)?value.length>0:String(value).trim().length>0;
 const canContinue=hasValue&&!validation;

 function goToPreviousQuestion(){
  if(!question){router.back();return;}
  const required=getRequiredVisibleQuestions(answers);
  const index=required.findIndex(q=>q.id===question.id);
  const previous=index>0?required[index-1]:null;
  if(!previous){router.back();return;}
  setError('');
  setQuestion(previous);
  setValue(decodeValue(previous,answers[previous.id]));
  setPercent(calculateFairPathReadiness(answers).overallPercentage);
 }

 function selectOption(option:string){
  if(!question)return;
  if(multi){
   const current=Array.isArray(value)?value:[];
   setValue(current.includes(option)?current.filter(x=>x!==option):[...current,option]);
  }else setValue(option);
 }

 async function saveAndContinue(){
  if(!question||saving)return;
  const message=validationMessage(question,value);
  if(!hasValue||message){setError(message||'Enter an answer before continuing.');return;}
  setSaving(true);setError('');
  try{
   const encoded=encodeValue(question,value);
   if(!demoMode){try{await saveProfileAnswer(question.id,encoded)}catch(e){if(e instanceof Error&&e.message==='SIGNED_OUT'){setDemoMode(true)}else throw e}}
   const next={...answers,[question.id]:encoded};
   setAnswers(next);
   chooseNext(next,requestedArea);
  }catch{setError('We could not save that answer. Your response is still here — try again.');}
  finally{setSaving(false);}
 }

 if(loading||!question)return <View style={s.screen}><StatusBar style="light"/><SafeAreaView style={s.center}><Text style={s.loading}>{error||'Loading your FairPath…'}</Text></SafeAreaView></View>;

 return <View style={s.screen}><StatusBar style="light"/><SafeAreaView style={s.safe}>
  <View style={s.top}><Pressable style={s.back} onPress={goToPreviousQuestion}><Text style={s.backText}>←</Text></Pressable><Text style={s.percent}>{percent}% READY</Text></View>
  <View style={s.track}><View style={[s.fill,{width:`${percent}%`}]}/></View>
  <ScrollView contentContainerStyle={[s.content,desktop&&s.contentDesktop,compact&&s.contentCompact]} keyboardShouldPersistTaps="handled">
   <Text style={s.kicker}>{areaNames[question.area]}</Text>
   <Text style={s.title}>{question.label}</Text>
   <Text style={s.help}>{question.helpText}</Text>
   {question.sensitive?<View style={s.private}><Text style={s.privateText}>PRIVATE PROFILE INFORMATION</Text><Text style={s.privateBody}>This answer is not automatically displayed as a general partner-visible profile field.</Text></View>:null}
   {options.length>0?<View style={s.options}>{options.map(o=>{const selected=Array.isArray(value)?value.includes(o):value===o;return <Pressable key={o} style={[s.option,selected&&s.optionSelected]} onPress={()=>selectOption(o)}><View style={[s.mark,selected&&s.markSelected]}><Text style={s.check}>{selected?'✓':''}</Text></View><Text style={[s.optionText,selected&&s.optionTextSelected]}>{o}</Text></Pressable>})}</View>:
   <><TextInput value={String(value)} onChangeText={v=>{setValue(v);if(error)setError('')}} style={s.input} placeholder={question.id==='identity.phone'?'(555) 555-1234':question.input==='date'?'MM/DD/YYYY':question.input==='number'?'Enter a number':'Type your answer'} placeholderTextColor="#666C66" keyboardType={question.id==='identity.phone'?'phone-pad':question.input==='number'?'numeric':'default'} onSubmitEditing={saveAndContinue}/>{validation?<Text style={s.validation}>{validation}</Text>:null}</>}
  </ScrollView>
  <View style={[s.footer,desktop&&s.footerDesktop]}><Pressable disabled={!canContinue||saving} style={[s.button,(!canContinue||saving)&&s.disabled]} onPress={saveAndContinue}><Text style={[s.buttonText,(!canContinue||saving)&&s.buttonTextDisabled]}>{saving?'Saving…':'Save & continue'}</Text><Text style={[s.buttonArrow,(!canContinue||saving)&&s.buttonArrowDisabled]}>→</Text></Pressable>{error?<Text style={s.error}>{error}</Text>:null}<Text style={s.note}>{demoMode?'Preview mode · answers stay in this session until you sign in.':'Saved to your FairPath so you can pick up where you left off.'}</Text></View>
 </SafeAreaView></View>
}
const s=StyleSheet.create({screen:{flex:1,backgroundColor:BLACK},safe:{flex:1,width:'100%',maxWidth:650,alignSelf:'center'},center:{flex:1,alignItems:'center',justifyContent:'center'},loading:{color:MUTED,fontSize:15},top:{paddingHorizontal:24,paddingTop:12,paddingBottom:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{width:44,height:44,borderRadius:14,backgroundColor:CARD,borderWidth:1,borderColor:'#303330',alignItems:'center',justifyContent:'center'},backText:{color:'#fff',fontSize:22},percent:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:11,letterSpacing:1.3},track:{height:3,marginHorizontal:24,backgroundColor:'#252925',borderRadius:10,overflow:'hidden'},fill:{height:'100%',backgroundColor:LIME},content:{flexGrow:1,paddingHorizontal:24,paddingTop:42,paddingBottom:24},contentDesktop:{flexGrow:0,paddingTop:34},contentCompact:{paddingTop:24},kicker:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:10,letterSpacing:2,marginBottom:14},title:{color:'#fff',fontFamily:'LeagueSpartan_900Black',fontSize:40,lineHeight:44,letterSpacing:-1.5,maxWidth:580},help:{color:MUTED,fontSize:15,lineHeight:23,marginTop:15,maxWidth:560},private:{backgroundColor:'#101510',borderWidth:1,borderColor:'#33412C',borderRadius:16,padding:14,marginTop:18},privateText:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:8,letterSpacing:1.2},privateBody:{color:'#929A8E',fontSize:11,lineHeight:17,marginTop:5},options:{gap:10,marginTop:30},option:{minHeight:60,borderRadius:17,borderWidth:1,borderColor:'#303330',backgroundColor:CARD,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:13},optionSelected:{borderColor:LIME,backgroundColor:'#182014'},mark:{width:25,height:25,borderRadius:8,borderWidth:1,borderColor:'#4A4F4A',alignItems:'center',justifyContent:'center'},markSelected:{backgroundColor:LIME,borderColor:LIME},check:{color:BLACK,fontWeight:'900'},optionText:{color:'#D7DAD6',fontSize:15,fontWeight:'700',flex:1},optionTextSelected:{color:'#fff'},input:{minHeight:62,borderRadius:17,borderWidth:1,borderColor:'#303330',backgroundColor:CARD,color:'#fff',fontSize:16,paddingHorizontal:17,marginTop:30},footer:{padding:24,paddingTop:12},footerDesktop:{paddingTop:18,paddingBottom:28},button:{minHeight:60,borderRadius:17,backgroundColor:LIME,paddingHorizontal:19,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},disabled:{backgroundColor:'#1B201A',borderWidth:1,borderColor:'#303630'},buttonText:{color:BLACK,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:16},buttonArrow:{color:BLACK,fontSize:24},buttonTextDisabled:{color:'#697069'},buttonArrowDisabled:{color:'#697069'},error:{color:'#FF8A8A',fontSize:12,textAlign:'center',marginTop:10},validation:{color:'#FF8A8A',fontSize:12,marginTop:8},note:{color:'#626762',fontSize:10,textAlign:'center',marginTop:10}});
