import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import {
  FastTrackQuote,
  HousingApplicationDocument,
  HousingApplicationForm,
  loadFastTrackQuote,
  loadHousingApplicationForm,
  loadMyHousingApplicationDetail,
  saveHousingApplicationDraft,
  submitHousingApplication,
  validateHousingApplicationForm,
} from '@/core/opportunities/opportunity-service';
import { digitsOnly, formatDateInput, formatUsPhone } from '@/core/forms/formatters';
import { HousingApplicationDocuments } from '@/components/HousingApplicationDocuments';

const EMPTY:HousingApplicationForm={
 first_name:'',last_name:'',email:'',phone:'',date_of_birth:'',current_address:'',
 monthly_income:'',employer:'',employment_status:'',move_in_date:'',occupants:'',
 pets:'',housing_history:'',references:'',additional_notes:''
};
const STEPS=['APPLICANT','INCOME','HOUSEHOLD','HISTORY','REVIEW'];
const STEP_FIELDS:Record<number,(keyof HousingApplicationForm)[]>={
 1:['first_name','last_name','email','phone','date_of_birth','current_address'],
 2:['employment_status','employer','monthly_income'],
 3:['move_in_date','occupants','pets'],
 4:['housing_history','references'],
 5:[]
};
const EMPLOYMENT=['Employed','Self-employed','Benefits / assistance','Unemployed','Other'];
const PETS=['None','Cat(s)','Dog(s)','Other'];

export default function HousingApply(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [form,setForm]=useState<HousingApplicationForm>(EMPTY);
 const [step,setStep]=useState(1);
 const [fast,setFast]=useState(false);
 const [title,setTitle]=useState('Housing application');
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [touched,setTouched]=useState<Partial<Record<keyof HousingApplicationForm,boolean>>>({});
 const [accuracy,setAccuracy]=useState(false);
 const [submitConsent,setSubmitConsent]=useState(false);
 const [fastAck,setFastAck]=useState(false);
 const [fastQuote,setFastQuote]=useState<FastTrackQuote|null>(null);
 const [requiredDocs,setRequiredDocs]=useState<HousingApplicationDocument['document_type'][]>([]);
 const [documents,setDocuments]=useState<HousingApplicationDocument[]>([]);

 useEffect(()=>{
  if(!id)return;
  Promise.all([loadHousingApplicationForm(id),loadMyHousingApplicationDetail(id)])
   .then(([x,a])=>{
    if(a.status!=='started'){router.replace(('/housing-application/'+id) as never);return}
    setForm(x.form);
    setStep(Math.max(1,Math.min(x.current_step,5)));
    setFast(a.application_type==='fasttrack');
    setTitle(a.listing?.title??'Housing application');
    setRequiredDocs((a.listing?.required_application_documents??[]) as HousingApplicationDocument['document_type'][]);
   })
   .catch(()=>Alert.alert('Could not load application','Please try again.'))
   .finally(()=>setLoading(false));
 },[id]);
 useEffect(()=>{if(!id||!fast)return;loadFastTrackQuote(id).then(setFastQuote).catch(()=>setFastQuote(null))},[id,fast]);

 const errors=useMemo(()=>validateHousingApplicationForm(form),[form]);
 const currentFields=STEP_FIELDS[step]??[];
 const currentErrors=currentFields.filter(k=>errors[k]&&!(k==='employer'&&form.employment_status==='Unemployed'));
 const allErrors=Object.keys(errors) as (keyof HousingApplicationForm)[];
 const missingRequiredDocs=requiredDocs.filter(type=>!documents.some(doc=>doc.document_type===type&&doc.status!=='rejected'));
 const completion=useMemo(()=>{
  const required=(Object.values(STEP_FIELDS).flat() as (keyof HousingApplicationForm)[]).filter((k,i,a)=>a.indexOf(k)===i);
  const good=required.filter(k=>!errors[k]||(k==='employer'&&form.employment_status==='Unemployed')).length;
  return Math.round(good/required.length*100);
 },[errors,form.employment_status]);

 function update<K extends keyof HousingApplicationForm>(key:K,value:string){setForm(v=>({...v,[key]:value}))}
 function markStep(){setTouched(v=>({...v,...Object.fromEntries(currentFields.map(k=>[k,true]))}))}
 function displayError(key:keyof HousingApplicationForm){return touched[key]?errors[key]:undefined}

 async function saveAndNext(){
  if(!id||saving)return;
  markStep();
  if(currentErrors.length){
   Alert.alert('Complete this step',currentErrors.length===1?'One required item still needs attention.':currentErrors.length+' required items still need attention.');
   return;
  }
  setSaving(true);
  try{
   const next=Math.min(step+1,5);
   await saveHousingApplicationDraft(id,form,next);
   setStep(next);
   setTouched({});
  }catch{Alert.alert('Could not save','Your application stayed on this step. Please try again.')}
  finally{setSaving(false)}
 }

 async function previous(){
  if(step<=1){router.back();return}
  if(id){try{await saveHousingApplicationDraft(id,form,step-1)}catch{}}
  setTouched({});
  setStep(v=>Math.max(1,v-1));
 }

 function attemptSubmit(){
  setTouched(Object.fromEntries((Object.keys(form) as (keyof HousingApplicationForm)[]).map(k=>[k,true])));
  if(allErrors.length){
   Alert.alert('Application incomplete',allErrors.length===1?'Fix the required item before submitting.':'Fix '+allErrors.length+' required items before submitting.');
   return;
  }
  if(!accuracy||!submitConsent||(fast&&!fastAck)){
   Alert.alert('Confirm before submitting','Review and accept the required confirmations at the bottom of the application.');
   return;
  }
  if(missingRequiredDocs.length){
   Alert.alert('Required documents missing','Upload every document required by this property before submitting.');
   return;
  }
  if(fast&&fastQuote?.payment_enforced&&!['paid','waived'].includes(fastQuote.status)){
   Alert.alert('FastTrack payment required','Complete FastTrack payment before submitting this application.',[
    {text:'Not now',style:'cancel'},
    {text:'Open checkout',onPress:()=>router.push(('/fasttrack-checkout/'+id) as never)}
   ]);
   return;
  }
  void doSubmit();
 }

 async function doSubmit(){
  if(!id||saving)return;
  setSaving(true);
  try{
   await submitHousingApplication(id,form,{accuracy,submit:submitConsent,fasttrack_ack:fast?fastAck:undefined});
   router.replace(('/housing-application/'+id+'?submitted=1') as never);
  }catch(e){
   const message=e instanceof Error&&e.message==='APPLICATION_INCOMPLETE'
    ?'Required information is still missing.'
    :e instanceof Error&&e.message==='CONSENT_REQUIRED'
      ?'Required confirmations are missing.'
      :e instanceof Error&&e.message==='PAYMENT_REQUIRED'
        ?'FastTrack payment is required before submission.'
        :'The application was not submitted. Please try again.';
   Alert.alert('Could not submit',message);
  }finally{setSaving(false)}
 }

 if(loading)return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Application" backTo="/housing-applications"/><Text style={s.loading}>Loading application…</Text></ScreenFrame>;

 return <ScreenFrame>
  <PageHeader eyebrow={fast?'FASTTRACK APPLICATION':'STANDARD APPLICATION'} title={title} onBack={()=>void previous()}/>
  <View style={s.progress}>
   {STEPS.map((label,i)=><View key={label} style={s.piece}><View style={[s.bar,i<step&&s.barOn]}/><Text style={[s.stepLabel,i===step-1&&s.stepOn]}>{label}</Text></View>)}
  </View>

  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
   <View style={s.modeCard}>
    <View style={s.modeTop}><InlineBadge tone={fast?'lime':undefined}>{fast?'FASTTRACK':'STANDARD'}</InlineBadge><Text style={s.completion}>{completion}% COMPLETE</Text></View>
    <Text style={s.modeTitle}>{fast?'Prefilled where FairPath already knows the answer.':'A full application, one section at a time.'}</Text>
    <Text style={s.modeBody}>{fast?'FastTrack reuses available FairPath profile information, but missing fields still have to be completed and every answer remains editable before submission.':'Standard applications start as a clean form and save your progress as you move through each section.'}</Text>
   </View>

   {step===1?<>
    <SectionHead kicker="STEP 1 OF 5" title="Applicant information"/>
    <Field label="FIRST NAME" value={form.first_name} onChangeText={v=>update('first_name',v)} error={displayError('first_name')}/>
    <Field label="LAST NAME" value={form.last_name} onChangeText={v=>update('last_name',v)} error={displayError('last_name')}/>
    <Field label="EMAIL" value={form.email} onChangeText={v=>update('email',v)} keyboardType="email-address" autoCapitalize="none" error={displayError('email')}/>
    <Field label="PHONE" value={formatUsPhone(form.phone)} onChangeText={v=>update('phone',formatUsPhone(v))} keyboardType="phone-pad" maxLength={14} placeholder="(555) 555-1234" error={displayError('phone')}/>
    <Field label="DATE OF BIRTH" value={formatDateInput(form.date_of_birth)} onChangeText={v=>update('date_of_birth',formatDateInput(v))} keyboardType="number-pad" maxLength={10} placeholder="MM/DD/YYYY" error={displayError('date_of_birth')}/>
    <Field label="CURRENT ADDRESS / HOUSING SITUATION" value={form.current_address} onChangeText={v=>update('current_address',v)} placeholder="Street address or current housing situation" error={displayError('current_address')}/>
   </>:null}

   {step===2?<>
    <SectionHead kicker="STEP 2 OF 5" title="Income & employment"/>
    <ChoiceField label="EMPLOYMENT STATUS" options={EMPLOYMENT} value={form.employment_status} onChange={v=>update('employment_status',v)} error={displayError('employment_status')}/>
    {form.employment_status!=='Unemployed'?<Field label="EMPLOYER / INCOME SOURCE" value={form.employer} onChangeText={v=>update('employer',v)} placeholder="Employer, benefits, business, or other source" error={displayError('employer')}/>:null}
    <MoneyField label="GROSS MONTHLY INCOME" value={form.monthly_income} onChangeText={v=>update('monthly_income',digitsOnly(v,7))} error={displayError('monthly_income')}/>
    <Text style={s.help}>Use 0 if you currently have no monthly income. Property-specific income verification can happen later in the workflow.</Text>
   </>:null}

   {step===3?<>
    <SectionHead kicker="STEP 3 OF 5" title="Move-in & household"/>
    <Field label="DESIRED MOVE-IN DATE" value={formatDateInput(form.move_in_date)} onChangeText={v=>update('move_in_date',formatDateInput(v))} keyboardType="number-pad" maxLength={10} placeholder="MM/DD/YYYY" error={displayError('move_in_date')}/>
    <Field label="TOTAL OCCUPANTS" value={form.occupants} onChangeText={v=>update('occupants',digitsOnly(v,2))} keyboardType="number-pad" maxLength={2} placeholder="1" error={displayError('occupants')}/>
    <ChoiceField label="PETS" options={PETS} value={PETS.includes(form.pets)?form.pets:''} onChange={v=>update('pets',v)} error={displayError('pets')}/>
    {form.pets==='Other'?<Text style={s.help}>You can add specific pet details in Additional notes before submitting.</Text>:null}
   </>:null}

   {step===4?<>
    <SectionHead kicker="STEP 4 OF 5" title="Housing history"/>
    <Field label="CURRENT / PRIOR HOUSING" value={form.housing_history} onChangeText={v=>update('housing_history',v)} multiline placeholder="Current residence, prior residence, dates, or 'No prior rental history'" error={displayError('housing_history')}/>
    <Field label="LANDLORD / HOUSING REFERENCES" value={form.references} onChangeText={v=>update('references',v)} multiline placeholder="Names and contact details, or 'None available'" error={displayError('references')}/>
    <Field label="ADDITIONAL NOTES" value={form.additional_notes} onChangeText={v=>update('additional_notes',v)} multiline placeholder="Optional information you want considered"/>
   </>:null}

   {step===5?<>
    <SectionHead kicker="STEP 5 OF 5" title="Review & submit"/>
    <Review label="APPLICATION TYPE" value={fast?'FastTrack':'Standard'}/>
    <Review label="APPLICANT" value={[form.first_name,form.last_name].filter(Boolean).join(' ')}/>
    <Review label="CONTACT" value={[form.email,formatUsPhone(form.phone)].filter(Boolean).join(' · ')}/>
    <Review label="DATE OF BIRTH" value={formatDateInput(form.date_of_birth)}/>
    <Review label="CURRENT ADDRESS" value={form.current_address}/>
    <Review label="EMPLOYMENT" value={[form.employment_status,form.employer].filter(Boolean).join(' · ')}/>
    <Review label="MONTHLY INCOME" value={form.monthly_income?'$'+Number(form.monthly_income).toLocaleString():'Not provided'}/>
    <Review label="MOVE-IN" value={formatDateInput(form.move_in_date)}/>
    <Review label="OCCUPANTS" value={form.occupants}/>
    <Review label="PETS" value={form.pets}/>
    <Review label="HOUSING HISTORY" value={form.housing_history}/>
    <Review label="REFERENCES" value={form.references}/>

    {allErrors.length?<Pressable style={s.errorSummary} onPress={()=>setStep(firstErrorStep(errors))}>
     <Lucide name="triangle-alert" color={C.lime} size={15}/>
     <Text style={s.errorSummaryText}>{allErrors.length} required {allErrors.length===1?'item needs':'items need'} attention. TAP TO FIX.</Text>
    </Pressable>:null}

    <HousingApplicationDocuments applicationId={id!} requiredTypes={requiredDocs} onDocumentsChange={setDocuments}/>
    {missingRequiredDocs.length?<View style={s.documentWarning}><Lucide name="triangle-alert" color={C.lime} size={14}/><Text style={s.documentWarningText}>Upload the required property documents before submitting: {missingRequiredDocs.join(', ').replaceAll('_',' ')}.</Text></View>:null}
    {fast&&fastQuote?<View style={s.fastQuote}><View style={s.quoteTop}><Text style={s.quoteLabel}>FASTTRACK FEE</Text><Text style={s.quoteAmount}>{'
    <Consent checked={accuracy} onPress={()=>setAccuracy(v=>!v)} text="I confirm the information in this application is accurate to the best of my knowledge."/>
    <Consent checked={submitConsent} onPress={()=>setSubmitConsent(v=>!v)} text="I want FairPath to submit this completed application into the property application workflow."/>
    {fast?<Consent checked={fastAck} onPress={()=>setFastAck(v=>!v)} text="I understand FastTrack can speed up reuse and review of my information but does not guarantee approval or waive property-specific screening."/>:null}

    <View style={s.notice}><Text style={s.noticeTitle}>BEFORE YOU SUBMIT</Text><Text style={s.noticeBody}>Nothing is sent until you confirm below. Property screening, verification, fees, availability, and property-owner decisions can still apply.</Text></View>
   </>:null}

   <Pressable style={[s.primary,(saving||(step===5&&(allErrors.length>0||missingRequiredDocs.length>0||!accuracy||!submitConsent||(fast&&!fastAck))))&&s.primaryDisabled]} disabled={saving} onPress={step===5?attemptSubmit:()=>void saveAndNext()}>
    <Text style={[s.primaryText,step===5&&(allErrors.length>0||!accuracy||!submitConsent||(fast&&!fastAck))&&s.primaryTextDisabled]}>{saving?'SAVING…':step===5?'CONFIRM & SUBMIT APPLICATION':'SAVE & CONTINUE'}</Text>
    <Lucide name="arrow-right" color={step===5&&(allErrors.length>0||missingRequiredDocs.length>0||!accuracy||!submitConsent||(fast&&!fastAck))?C.mutedStrong:C.black} size={16}/>
   </Pressable>
   {step>1?<Pressable style={s.secondary} onPress={()=>void previous()}><Text style={s.secondaryText}>← PREVIOUS STEP</Text></Pressable>:null}
  </ScrollView>
 </ScreenFrame>;
}

function firstErrorStep(errors:Partial<Record<keyof HousingApplicationForm,string>>){
 for(const n of [1,2,3,4])if((STEP_FIELDS[n]??[]).some(k=>errors[k]))return n;
 return 1;
}
function SectionHead({kicker,title}:{kicker:string;title:string}){return <><Text style={s.kicker}>{kicker}</Text><Text style={s.heading}>{title}</Text></>}
function Field({label,value,onChangeText,placeholder='',keyboardType='default',multiline=false,error,maxLength,autoCapitalize='sentences'}:{label:string;value:string;onChangeText:(v:string)=>void;placeholder?:string;keyboardType?:any;multiline?:boolean;error?:string;maxLength?:number;autoCapitalize?:any}){
 return <View style={s.field}><View style={s.fieldHead}><Text style={s.label}>{label}</Text>{error?<Text style={s.required}>REQUIRED</Text>:null}</View><TextInput style={[s.input,multiline&&s.multi,error&&s.inputError]} value={value} onChangeText={onChangeText} placeholder={placeholder||'Enter '+label.toLowerCase()} placeholderTextColor={C.muted} keyboardType={keyboardType} multiline={multiline} maxLength={maxLength} autoCapitalize={autoCapitalize}/>{error?<Text style={s.errorText}>{error}</Text>:null}</View>
}
function MoneyField({label,value,onChangeText,error}:{label:string;value:string;onChangeText:(v:string)=>void;error?:string}){return <View style={s.field}><View style={s.fieldHead}><Text style={s.label}>{label}</Text>{error?<Text style={s.required}>REQUIRED</Text>:null}</View><View style={[s.money,error&&s.inputError]}><Text style={s.moneyPrefix}>$</Text><TextInput style={s.moneyInput} value={value} onChangeText={onChangeText} keyboardType="number-pad" placeholder="0" placeholderTextColor={C.muted}/></View>{error?<Text style={s.errorText}>{error}</Text>:null}</View>}
function ChoiceField({label,options,value,onChange,error}:{label:string;options:string[];value:string;onChange:(v:string)=>void;error?:string}){return <View style={s.field}><View style={s.fieldHead}><Text style={s.label}>{label}</Text>{error?<Text style={s.required}>REQUIRED</Text>:null}</View><View style={s.choiceGrid}>{options.map(o=><Pressable key={o} style={[s.choice,value===o&&s.choiceActive]} onPress={()=>onChange(o)}><Text style={[s.choiceText,value===o&&s.choiceTextActive]}>{o.toUpperCase()}</Text></Pressable>)}</View>{error?<Text style={s.errorText}>{error}</Text>:null}</View>}
function Review({label,value}:{label:string;value:string}){return <View style={s.review}><Text style={s.label}>{label}</Text><Text style={s.reviewValue}>{value||'Not provided'}</Text></View>}
function Consent({checked,onPress,text}:{checked:boolean;onPress:()=>void;text:string}){return <Pressable style={s.consent} onPress={onPress}><View style={[s.checkBox,checked&&s.checkBoxOn]}>{checked?<Lucide name="check" color={C.black} size={12}/>:null}</View><Text style={s.consentText}>{text}</Text></Pressable>}

const s=StyleSheet.create({
 loading:{color:C.mutedStrong,padding:L.mobileGutter},
 progress:{flexDirection:'row',gap:5,paddingHorizontal:L.mobileGutter,paddingTop:14},
 piece:{flex:1,minWidth:0},bar:{height:3,backgroundColor:C.borderStrong},barOn:{backgroundColor:C.lime},
 stepLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:5.5,letterSpacing:.4,marginTop:5},stepOn:{color:C.lime},
 content:{padding:L.mobileGutter,paddingBottom:40},
 modeCard:{borderBottomWidth:1,borderBottomColor:C.borderStrong,paddingBottom:16,marginBottom:18},
 modeTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},completion:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.7},
 modeTitle:{color:C.white,fontFamily:F.black,fontSize:19,marginTop:10},modeBody:{color:C.mutedStrong,fontSize:10,lineHeight:16,marginTop:5},
 kicker:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1},heading:{color:C.white,fontFamily:F.black,fontSize:26,marginTop:5,marginBottom:16},
 field:{marginBottom:14},fieldHead:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},label:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8,marginBottom:6},required:{color:C.lime,fontFamily:F.extraBold,fontSize:6,letterSpacing:.7},
 input:{minHeight:48,borderWidth:1,borderColor:C.borderStrong,color:C.white,paddingHorizontal:12,fontSize:13},inputError:{borderColor:C.lime},
 multi:{minHeight:96,paddingTop:12,textAlignVertical:'top'},errorText:{color:C.lime,fontSize:9,marginTop:5},
 money:{height:48,borderWidth:1,borderColor:C.borderStrong,flexDirection:'row',alignItems:'center',paddingHorizontal:12},moneyPrefix:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:14},moneyInput:{flex:1,color:C.white,fontSize:13,paddingLeft:6},
 choiceGrid:{flexDirection:'row',flexWrap:'wrap',gap:7},choice:{minHeight:40,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:11,alignItems:'center',justifyContent:'center'},choiceActive:{borderColor:C.lime,backgroundColor:'#10150C'},choiceText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7.5},choiceTextActive:{color:C.lime},
 help:{color:C.muted,fontSize:9,lineHeight:14,marginTop:-3,marginBottom:10},
 review:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.border},reviewValue:{color:C.white,fontSize:12,lineHeight:18},
 errorSummary:{borderWidth:1,borderColor:C.lime,backgroundColor:'#10150C',padding:12,marginTop:16,flexDirection:'row',gap:8,alignItems:'center'},errorSummaryText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.5,flex:1},
 consentTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginTop:22,marginBottom:7},
 consent:{minHeight:52,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:10},
 checkBox:{width:22,height:22,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},checkBoxOn:{backgroundColor:C.lime,borderColor:C.lime},
 consentText:{color:C.mutedStrong,fontSize:10,lineHeight:15,flex:1},
 documentWarning:{borderWidth:1,borderColor:C.lime,backgroundColor:'#10150C',padding:10,marginTop:8,flexDirection:'row',gap:8},documentWarningText:{color:C.lime,fontSize:8.5,lineHeight:13,flex:1},fastQuote:{borderWidth:1,borderColor:C.borderStrong,padding:13,marginTop:14},quoteTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},quoteLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},quoteAmount:{color:C.white,fontFamily:F.black,fontSize:20},quoteDiscount:{color:C.lime,fontSize:8.5,marginTop:5},quoteBody:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:7},notice:{borderWidth:1,borderColor:'#526F2B',padding:14,marginTop:18},noticeTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},noticeBody:{color:C.mutedStrong,fontSize:10,lineHeight:16,marginTop:6},
 primary:{minHeight:50,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,marginTop:14},primaryDisabled:{backgroundColor:'#1A2114',borderWidth:1,borderColor:'#2C3823'},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:8.5,letterSpacing:.8},primaryTextDisabled:{color:C.mutedStrong},
 secondary:{minHeight:44,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',marginTop:8},secondaryText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8}
});
