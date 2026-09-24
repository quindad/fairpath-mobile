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

const LABEL:Record<string,string>={
 started:'IN PROGRESS',submitted:'SUBMITTED',reviewing:'UNDER REVIEW',tour:'TOUR / NEXT STEP',
 approved:'APPROVED',denied:'NOT APPROVED',withdrawn:'WITHDRAWN'
};
const FORM_STEPS=['Applicant','Income','Household','History','Review'];
const EVENT_LABEL:Record<string,string>={submitted:'APPLICATION SUBMITTED',reviewing:'PROPERTY REVIEW STARTED',tour:'TOUR / NEXT STEP',approved:'APPLICATION APPROVED',denied:'APPLICATION NOT APPROVED',withdrawn:'APPLICATION WITHDRAWN'};

export default function HousingApplication(){
 const {id,submitted:submittedParam}=useLocalSearchParams<{id:string;submitted?:string}>();
 const [item,setItem]=useState<HousingApplicationDetail|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [events,setEvents]=useState<HousingApplicationEvent[]>([]);

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

 function deleteDraft(){
  if(!item)return;
  notify(
   'Delete draft application?',
   'This permanently deletes this unfinished draft. You can start a new Standard or FastTrack application for this home afterward.',
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
  notify('Withdraw submitted application?','This changes the FairPath application status to withdrawn. It cannot undo actions already taken outside FairPath.',[
   {text:'Cancel',style:'cancel'},
   {text:'Withdraw',style:'destructive',onPress:async()=>{
    try{await withdrawMyHousingApplication(item.id);await load()}
    catch{notify('Could not withdraw','Please try again.')}
   }}
  ]);
 }

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Application" backTo="/housing-applications"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.statusRow}>
    <InlineBadge tone={fast?'lime':undefined}>{fast?'FASTTRACK':'STANDARD'}</InlineBadge>
    <Text style={s.status}>{LABEL[item.status]??item.status.toUpperCase()}</Text>
   </View>

   {submittedParam==='1'&&item.status!=='started'?<View style={s.successBanner}><Lucide name="circle-check-big" color={C.lime} size={18}/><View style={{flex:1}}><Text style={s.successTitle}>APPLICATION SUBMITTED</Text><Text style={s.successBody}>FairPath confirmed the submission in the database. You can track every next step here.</Text></View></View>:null}

   <Text style={s.title}>{item.listing?.title??'Housing application'}</Text>
   {item.listing?<><Text style={s.price}>{'$'+Number(item.listing.rent_monthly).toLocaleString()+' / month'}</Text><Text style={s.meta}>{[item.listing.bedrooms!=null?item.listing.bedrooms+' bd':null,item.listing.bathrooms!=null?item.listing.bathrooms+' ba':null,item.listing.city+', '+item.listing.state].filter(Boolean).join(' · ')}</Text></>:null}

   {draft?<View style={s.draftCard}>
    <View style={s.progressHead}><Text style={s.progressTitle}>APPLICATION PROGRESS</Text><Text style={s.progressPct}>{progress}%</Text></View>
    <View style={s.track}><View style={[s.fill,{width:(progress+'%') as any}]}/></View>
    <View style={s.stepList}>{FORM_STEPS.map((label,index)=>{const n=index+1;const complete=n<item.current_step;const current=n===item.current_step;return <View key={label} style={s.stepRow}><View style={[s.stepDot,complete&&s.stepDotDone,current&&s.stepDotCurrent]}>{complete?<Lucide name="check" color={C.black} size={9}/>:null}</View><Text style={[s.stepText,(complete||current)&&s.stepTextActive]}>{n}. {label}</Text>{current?<Text style={s.current}>CURRENT</Text>:null}</View>})}</View>
    <Text style={s.draftCopy}>{fast?'FastTrack is using available FairPath profile information where possible. Missing fields still have to be completed before submission.':'Your Standard application is saved as a draft. Continue where you left off.'}</Text>
   </View>:null}

   {!draft?<StatusTimeline status={item.status}/>:null}
   {events.length?<View style={s.activity}><Text style={s.section}>ACTIVITY</Text>{events.map(e=><View key={e.id} style={s.activityRow}><View style={s.activityDot}/><View style={{flex:1}}><Text style={s.activityTitle}>{EVENT_LABEL[e.event_type]??e.event_type.replaceAll('_',' ').toUpperCase()}</Text><Text style={s.activityDate}>{new Date(e.created_at).toLocaleString()}</Text></View></View>)}</View>:null}

   {isSubmitted?<View style={s.submittedCard}><Text style={s.smallLabel}>SUBMITTED</Text><Text style={s.submittedDate}>{new Date(item.submitted_at!).toLocaleString()}</Text><Text style={s.submittedBody}>Your application is now in the FairPath housing workflow. Property-owner review, screening, fees, availability, and final decisions can still apply.</Text></View>:null}
   <HousingApplicationDocuments applicationId={item.id} readOnly={!draft}/>

   {draft?<Pressable style={s.primary} onPress={()=>router.push(('/housing-apply/'+item.id) as never)}>
    <Text style={s.primaryText}>{fast?'CONTINUE FASTTRACK APPLICATION':'CONTINUE STANDARD APPLICATION'}</Text><Lucide name="arrow-right" color={C.black} size={16}/>
   </Pressable>:null}

   {!draft?<Pressable style={s.homeButton} onPress={()=>router.replace('/home' as never)}><Lucide name="house" color={C.black} size={15}/><Text style={s.homeButtonText}>BACK TO FAIRPATH HOME</Text></Pressable>:null}
   {item.listing?<Pressable style={s.secondary} onPress={()=>router.push(('/housing/'+item.listing!.id) as never)}><Text style={s.secondaryText}>VIEW HOME</Text></Pressable>:null}
   {draft?<Pressable style={s.dangerButton} onPress={deleteDraft}><Text style={s.dangerText}>DELETE DRAFT APPLICATION</Text></Pressable>:null}
   {['submitted','reviewing','tour'].includes(item.status)?<Pressable style={s.dangerButton} onPress={withdrawSubmitted}><Text style={s.dangerText}>WITHDRAW SUBMITTED APPLICATION</Text></Pressable>:null}

   <Text style={s.updated}>LAST UPDATED {new Date(item.updated_at).toLocaleString()}</Text>
  </ScrollView>
 </ScreenFrame>;
}

function StatusTimeline({status}:{status:string}){
 const order=['submitted','reviewing','tour','approved'];
 const current=status==='denied'?3:status==='withdrawn'?0:Math.max(0,order.indexOf(status));
 const labels=['Submitted','Property review','Tour / next step','Decision'];
 return <View style={s.timeline}><Text style={s.section}>APPLICATION STATUS</Text>{labels.map((label,index)=><View key={label} style={s.timelineRow}><View style={[s.timelineDot,index<=current&&s.timelineDotOn]}/><View style={s.timelineCopy}><Text style={[s.timelineTitle,index<=current&&s.timelineTitleOn]}>{label}</Text>{index===0?<Text style={s.timelineBody}>FairPath received your completed application.</Text>:index===1?<Text style={s.timelineBody}>Property review and any required screening happen here.</Text>:index===2?<Text style={s.timelineBody}>A tour, clarification, or other property-specific next step may be requested.</Text>:<Text style={s.timelineBody}>The property owner or manager records the final application decision.</Text>}</View></View>)}</View>
}
function State({text}:{text:string}){return <View style={s.state}><Text style={s.stateText}>{text}</Text></View>}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:18,paddingBottom:40},state:{padding:L.mobileGutter},stateText:{color:C.mutedStrong},
 successBanner:{flexDirection:'row',gap:10,borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0F150B',padding:13,marginBottom:14},successTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},successBody:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:4},statusRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},status:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 title:{color:C.white,fontFamily:F.black,fontSize:26,lineHeight:29,marginTop:14},price:{color:C.white,fontFamily:F.extraBold,fontSize:14,marginTop:8},meta:{color:C.mutedStrong,fontSize:10,marginTop:5},
 draftCard:{borderWidth:1,borderColor:C.borderStrong,padding:14,marginTop:18},progressHead:{flexDirection:'row',justifyContent:'space-between'},progressTitle:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},progressPct:{color:C.lime,fontFamily:F.extraBold,fontSize:10},track:{height:3,backgroundColor:C.borderStrong,marginTop:8},fill:{height:3,backgroundColor:C.lime},
 stepList:{marginTop:12},stepRow:{minHeight:34,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:C.border},stepDot:{width:18,height:18,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},stepDotDone:{backgroundColor:C.lime,borderColor:C.lime},stepDotCurrent:{borderColor:C.lime},stepText:{color:C.muted,fontSize:10,flex:1},stepTextActive:{color:C.white,fontFamily:F.bold},current:{color:C.lime,fontFamily:F.extraBold,fontSize:6,letterSpacing:.7},draftCopy:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:12},
 timeline:{marginTop:22},section:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginBottom:6},timelineRow:{flexDirection:'row',gap:10,minHeight:62},timelineDot:{width:12,height:12,borderRadius:6,borderWidth:1,borderColor:C.borderStrong,marginTop:3},timelineDotOn:{backgroundColor:C.lime,borderColor:C.lime},timelineCopy:{flex:1,borderBottomWidth:1,borderBottomColor:C.border,paddingBottom:12},timelineTitle:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:11},timelineTitleOn:{color:C.white},timelineBody:{color:C.muted,fontSize:9,lineHeight:14,marginTop:3},
 activity:{marginTop:20},activityRow:{minHeight:46,flexDirection:'row',gap:10,alignItems:'flex-start',borderBottomWidth:1,borderBottomColor:C.border,paddingVertical:9},activityDot:{width:9,height:9,borderRadius:5,backgroundColor:C.lime,marginTop:3},activityTitle:{color:C.white,fontFamily:F.extraBold,fontSize:9},activityDate:{color:C.muted,fontSize:8,marginTop:3},submittedCard:{borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0F150B',padding:14,marginTop:18},smallLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},submittedDate:{color:C.white,fontFamily:F.extraBold,fontSize:12,marginTop:5},submittedBody:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:6},
 primary:{height:50,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,marginTop:20},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},
 homeButton:{height:50,backgroundColor:C.lime,flexDirection:'row',gap:8,alignItems:'center',justifyContent:'center',marginTop:18},homeButtonText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.8},secondary:{height:46,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',marginTop:9},secondaryText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 dangerButton:{height:44,alignItems:'center',justifyContent:'center',marginTop:8},dangerText:{color:C.danger,fontFamily:F.extraBold,fontSize:7.5,letterSpacing:.8},
 updated:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7,marginTop:18}
});