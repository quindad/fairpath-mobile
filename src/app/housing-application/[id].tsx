import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notify } from '@/core/ui/notify';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { HousingApplicationDocuments } from '@/components/HousingApplicationDocuments';
import {
  deleteHousingApplicationDraft,
  HousingApplicationDetail,
  HousingApplicationEvent,
  loadHousingApplicationEvents,
  loadMyHousingApplicationDetail,
  withdrawMyHousingApplication,
} from '@/core/opportunities/opportunity-service';
import { prepareHousingApplication } from '@/core/ai/signal';
import { housingApplicationEventLabel, housingApplicationTimeline } from '@/core/housing/application-timeline';

const LABEL:Record<string,string>={
 started:'IN PROGRESS',submitted:'SUBMITTED',reviewing:'UNDER REVIEW',tour:'TOUR / NEXT STEP',
 approved:'APPROVED',denied:'NOT APPROVED',withdrawn:'WITHDRAWN'
};
const FORM_STEPS=['Applicant','Income','Household','History','Review'];

export default function HousingApplication(){
 const {id,submitted:submittedParam}=useLocalSearchParams<{id:string;submitted?:string}>();
 const [item,setItem]=useState<HousingApplicationDetail|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [events,setEvents]=useState<HousingApplicationEvent[]>([]);
 const [prepText,setPrepText]=useState('');
 const [prepLoading,setPrepLoading]=useState(false);
 const [prepRequested,setPrepRequested]=useState(false);

 const load=useCallback(()=>{
  if(!id)return;
  setLoading(true);setError('');
  Promise.all([loadMyHousingApplicationDetail(id),loadHousingApplicationEvents(id)])
   .then(([app,eventRows])=>{setItem(app);setEvents(eventRows)})
   .catch(e=>{
    if(e instanceof Error&&e.message==='SIGNED_OUT'){router.replace(('/sign-up?returnTo='+encodeURIComponent('/housing-application/'+id)) as never);return}
    setError('Application could not be loaded.');
   })
   .finally(()=>setLoading(false));
 },[id]);
 useFocusEffect(useCallback(()=>{load()},[load]));

 if(loading)return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Application" backTo="/housing-applications"/><State text="Loading application…"/></ScreenFrame>;
 if(error||!item)return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Application" backTo="/housing-applications"/><State text={error||'Application not found.'}/></ScreenFrame>;

 const fast=item.application_type==='fasttrack';
 const draft=item.status==='started';
 const isSubmitted=Boolean(item.submitted_at);
 const progress=draft?Math.max(0,Math.min(100,Math.round((Math.max(1,item.current_step)-1)/4*100))):100;

 async function askSignal(){
  if(!item?.listing||prepLoading)return;
  setPrepLoading(true);setPrepRequested(true);
  try{
   const r=await prepareHousingApplication(item.listing.id);
   if(r.status==='ok')setPrepText(r.text);
   else if(r.status==='out_of_credits')setPrepText('You are out of Signal credits for now. They refresh with your plan.');
   else if(r.status==='rate_limited')setPrepText('Signal is busy across FairPath right now. Try again shortly.');
   else if(r.status==='signed_out'){router.replace(('/sign-up?returnTo='+encodeURIComponent('/housing-application/'+id)) as never);return}
   else setPrepText(r.message);
  }catch{
   setPrepText('Signal could not prepare application tips right now. Please try again.');
  }finally{
   setPrepLoading(false);
  }
 }

 function deleteDraft(){
  if(!item)return;
  notify(
   'Delete draft application?',
   'This permanently deletes this unfinished draft. You can start a new application for this home afterward.',
   [
    {text:'Keep draft',style:'cancel'},
    {text:'Delete draft',style:'destructive',onPress:async()=>{
     try{
      await deleteHousingApplicationDraft(item.id);
      router.replace(item.listing?('/housing/'+item.listing.id) as never:'/housing-applications' as never);
     }catch{notify('Could not delete draft','Please try again.')}
    }}
   ]
  );
 }
 function withdrawSubmitted(){
  if(!item)return;
  notify('Withdraw application?','This marks your application as withdrawn and the property team will see that. It cannot undo anything already done outside FairPath.',[
   {text:'Keep application',style:'cancel'},
   {text:'Withdraw application',style:'destructive',onPress:async()=>{
    try{await withdrawMyHousingApplication(item.id);await load()}
    catch(e){notify('Could not withdraw',e instanceof Error&&e.message==='CANNOT_WITHDRAW'?'This application can no longer be withdrawn. Refresh to see its current status.':'Please try again.')}
   }}
  ]);
 }

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Application" backTo="/housing-applications"/>
  <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.statusRow}>
    <InlineBadge tone={fast?'lime':undefined}>{fast?'FASTTRACK':'STANDARD'}</InlineBadge>
    <Text style={s.status}>{LABEL[item.status]??item.status.toUpperCase()}</Text>
   </View>

   {submittedParam==='1'&&item.status!=='started'?<View style={s.successBanner}><Lucide name="circle-check-big" color={C.lime} size={18}/><View style={{flex:1}}><Text style={s.successTitle}>APPLICATION SUBMITTED</Text><Text style={s.successBody}>FairPath confirmed the submission in the database. You can track every next step here.</Text></View></View>:null}

   <Text style={s.title}>{item.listing?.title??'Housing application'}</Text>
   {item.listing?<><Text style={s.price}>{'$'+Number(item.listing.rent_monthly).toLocaleString()+' / month'}</Text><Text style={s.meta}>{[item.listing.bedrooms!=null?item.listing.bedrooms+' bd':null,item.listing.bathrooms!=null?item.listing.bathrooms+' ba':null,item.listing.city+', '+item.listing.state].filter(Boolean).join(' · ')}</Text></>:null}

   {item.listing&&draft?<View style={s.draftCard}>
    <Text style={s.progressTitle}>SIGNAL · APPLICATION PREP</Text>
    {prepRequested?<Text style={s.draftCopy}>{prepLoading?'Signal is thinking…':prepText}</Text>:
     <Pressable accessibilityRole="button" style={s.secondary} onPress={()=>void askSignal()}><Text style={s.secondaryText}>PREP WITH SIGNAL</Text></Pressable>}
   </View>:null}

   {draft?<View style={s.draftCard}>
    <View style={s.progressHead}><Text style={s.progressTitle}>APPLICATION PROGRESS</Text><Text style={s.progressPct}>{progress}%</Text></View>
    <View style={s.track}><View style={[s.fill,{width:(progress+'%') as any}]}/></View>
    <View style={s.stepList}>{FORM_STEPS.map((label,index)=>{const n=index+1;const complete=n<item.current_step;const current=n===item.current_step;return <View key={label} style={s.stepRow}><View style={[s.stepDot,complete&&s.stepDotDone,current&&s.stepDotCurrent]}>{complete?<Lucide name="check" color={C.black} size={9}/>:null}</View><Text style={[s.stepText,(complete||current)&&s.stepTextActive]}>{n}. {label}</Text>{current?<Text style={s.current}>CURRENT</Text>:null}</View>})}</View>
    <Text style={s.draftCopy}>{fast?'This is a legacy FastTrack draft from an older flow. Continue where you left off or withdraw and start fresh.':'Your application is saved as a draft. Continue where you left off.'}</Text>
   </View>:null}

   {!draft?<StatusTimeline status={item.status} events={events}/>:null}
   {!draft&&(item.partner_note||item.status_reason)?<View style={s.answers}>
    <Text style={s.section}>PROPERTY FEEDBACK</Text>
    {item.status_reason?<View style={s.answerRow}><Text style={s.answerKey}>REASON</Text><Text style={s.answerValue}>{item.status_reason}</Text></View>:null}
    {item.partner_note?<View style={s.answerRow}><Text style={s.answerKey}>NOTE</Text><Text style={s.answerValue}>{item.partner_note}</Text></View>:null}
   </View>:null}
   {!draft&&item.answers?.record_statement_snapshot?<View style={s.answers}>
    <Text style={s.section}>RECORD STATEMENT SHARED</Text>
    <Text style={s.answerValue}>{item.answers.record_statement_snapshot.body}</Text>
   </View>:null}
   {events.length?<View style={s.activity}><Text style={s.section}>ACTIVITY</Text>{events.map(e=><View key={e.id} style={s.activityRow}><View style={s.activityDot}/><View style={{flex:1}}><Text style={s.activityTitle}>{housingApplicationEventLabel(e)}</Text><Text style={s.activityDate}>{new Date(e.created_at).toLocaleString()}</Text></View></View>)}</View>:null}

   {isSubmitted?<View style={s.submittedCard}><Text style={s.smallLabel}>SUBMITTED</Text><Text style={s.submittedDate}>{new Date(item.submitted_at!).toLocaleString()}</Text><Text style={s.submittedBody}>Your application is now in the FairPath housing workflow. Property-owner review, screening, fees, availability, and final decisions can still apply.</Text></View>:null}
   {!draft&&Object.keys(item.answers??{}).length?<View style={s.answers}>
    <Text style={s.section}>SUBMITTED INFORMATION</Text>
    {([['APPLICANT',[item.answers.first_name,item.answers.last_name].filter(Boolean).join(' ')],['CONTACT',[item.answers.email,item.answers.phone].filter(Boolean).join(' · ')],['EMPLOYMENT',[item.answers.employment_status,item.answers.employer].filter(Boolean).join(' · ')],['MONTHLY INCOME',item.answers.monthly_income?'$'+Number(String(item.answers.monthly_income).replace(/[^0-9.]/g,'')||0).toLocaleString():''],['MOVE-IN',item.answers.move_in_date??''],['OCCUPANTS',item.answers.occupants??''],['PETS',item.answers.pets??'']] as [string,string][]).filter(([,v])=>v).map(([k,v])=><View key={k} style={s.answerRow}><Text style={s.answerKey}>{k}</Text><Text style={s.answerValue}>{v}</Text></View>)}
    <Text style={s.answerNote}>Only the fields you entered in this application were sent. FairPath does not attach your justice-history or other profile records.</Text>
   </View>:null}
   <HousingApplicationDocuments applicationId={item.id} readOnly={!draft}/>

   {draft?<Pressable accessibilityRole="button" style={s.primary} onPress={()=>router.push(('/housing-apply/'+item.id) as never)}>
    <Text style={s.primaryText}>{fast?'CONTINUE FASTTRACK APPLICATION':'CONTINUE STANDARD APPLICATION'}</Text><Lucide name="arrow-right" color={C.black} size={16}/>
   </Pressable>:null}

   {!draft?<Pressable accessibilityRole="button" style={s.homeButton} onPress={()=>router.replace('/housing-applications' as never)}><Lucide name="file-check-2" color={C.black} size={15}/><Text style={s.homeButtonText}>ALL MY APPLICATIONS</Text></Pressable>:null}
   {!draft?<Pressable accessibilityRole="button" style={s.secondary} onPress={()=>router.replace('/home' as never)}><Text style={s.secondaryText}>BACK TO FAIRPATH HOME</Text></Pressable>:null}
   {item.listing?<Pressable accessibilityRole="button" style={s.secondary} onPress={()=>router.push(('/housing/'+item.listing!.id) as never)}><Text style={s.secondaryText}>VIEW HOME</Text></Pressable>:null}
   {draft?<Pressable accessibilityRole="button" style={s.dangerButton} onPress={deleteDraft}><Text style={s.dangerText}>DELETE DRAFT APPLICATION</Text></Pressable>:null}
   {['submitted','reviewing','tour'].includes(item.status)?<Pressable accessibilityRole="button" style={s.dangerButton} onPress={withdrawSubmitted}><Text style={s.dangerText}>WITHDRAW APPLICATION</Text></Pressable>:null}

   <Text style={s.updated}>LAST UPDATED {new Date(item.updated_at).toLocaleString()}</Text>
  </ScrollView>
 </ScreenFrame>;
}

function StatusTimeline({status,events}:{status:string;events:HousingApplicationEvent[]}){
 const steps=housingApplicationTimeline(status,events);
 return <View style={s.timeline}><Text style={s.section}>APPLICATION STATUS</Text>{steps.map(step=>{const on=step.state!=='upcoming';return <View key={step.key} style={s.timelineRow}><View style={[s.timelineDot,on&&s.timelineDotOn]}/><View style={s.timelineCopy}><Text style={[s.timelineTitle,on&&s.timelineTitleOn]}>{step.label}</Text><Text style={s.timelineBody}>{step.body}</Text></View></View>})}</View>
}
function State({text}:{text:string}){return <View style={s.state}><Text style={s.stateText}>{text}</Text></View>}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:18,paddingBottom:40},state:{padding:L.mobileGutter},stateText:{color:C.mutedStrong},
 successBanner:{flexDirection:'row',gap:10,borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0F150B',padding:13,marginBottom:14},successTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},successBody:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:4},statusRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},status:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 title:{color:C.white,fontFamily:F.black,fontSize:26,lineHeight:29,marginTop:14},price:{color:C.white,fontFamily:F.extraBold,fontSize:14,marginTop:8},meta:{color:C.mutedStrong,fontSize:10,marginTop:5},
 draftCard:{borderWidth:1,borderColor:C.borderStrong,padding:14,marginTop:18},progressHead:{flexDirection:'row',justifyContent:'space-between'},progressTitle:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},progressPct:{color:C.lime,fontFamily:F.extraBold,fontSize:10},track:{height:3,backgroundColor:C.borderStrong,marginTop:8},fill:{height:3,backgroundColor:C.lime},
 stepList:{marginTop:12},stepRow:{minHeight:34,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:C.border},stepDot:{width:18,height:18,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},stepDotDone:{backgroundColor:C.lime,borderColor:C.lime},stepDotCurrent:{borderColor:C.lime},stepText:{color:C.muted,fontSize:10,flex:1},stepTextActive:{color:C.white,fontFamily:F.bold},current:{color:C.lime,fontFamily:F.extraBold,fontSize:6,letterSpacing:.7},draftCopy:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:12},
 timeline:{marginTop:22},section:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginBottom:6},timelineRow:{flexDirection:'row',gap:10,minHeight:62},timelineDot:{width:12,height:12,borderRadius:6,borderWidth:1,borderColor:C.borderStrong,marginTop:3},timelineDotOn:{backgroundColor:C.lime,borderColor:C.lime},timelineCopy:{flex:1,borderBottomWidth:1,borderBottomColor:C.border,paddingBottom:12},timelineTitle:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:11},timelineTitleOn:{color:C.white},timelineBody:{color:C.muted,fontSize:9,lineHeight:14,marginTop:3},
 answers:{marginTop:20},answerRow:{paddingVertical:9,borderBottomWidth:1,borderBottomColor:C.border},answerKey:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.9},answerValue:{color:C.white,fontSize:12,lineHeight:18,marginTop:3},answerNote:{color:C.muted,fontSize:9,lineHeight:14,marginTop:10},
 activity:{marginTop:20},activityRow:{minHeight:46,flexDirection:'row',gap:10,alignItems:'flex-start',borderBottomWidth:1,borderBottomColor:C.border,paddingVertical:9},activityDot:{width:9,height:9,borderRadius:5,backgroundColor:C.lime,marginTop:3},activityTitle:{color:C.white,fontFamily:F.extraBold,fontSize:9},activityDate:{color:C.muted,fontSize:8,marginTop:3},submittedCard:{borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0F150B',padding:14,marginTop:18},smallLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},submittedDate:{color:C.white,fontFamily:F.extraBold,fontSize:12,marginTop:5},submittedBody:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:6},
 primary:{height:50,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,marginTop:20},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},
 homeButton:{height:50,backgroundColor:C.lime,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',marginTop:18},homeButtonText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.8},secondary:{height:46,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',marginTop:9},secondaryText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 dangerButton:{height:44,alignItems:'center',justifyContent:'center',marginTop:8},dangerText:{color:C.danger,fontFamily:F.extraBold,fontSize:7.5,letterSpacing:.8},
 updated:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7,marginTop:18}
});