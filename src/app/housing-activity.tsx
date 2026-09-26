import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { notify } from '@/core/ui/notify';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { cancelHousingTourRequest, HousingInquiry, HousingTourRequest, loadMyHousingInquiries, loadMyHousingTours, markHousingInquiryReplyRead } from '@/core/opportunities/opportunity-service';
import { currentInquiryStage, hasUnreadReply, inquiryStages } from '@/core/housing/inquiry-state';

export default function HousingActivity(){
 const [tours,setTours]=useState<HousingTourRequest[]>([]);const [inquiries,setInquiries]=useState<HousingInquiry[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=useCallback(()=>{setLoading(true);setError('');Promise.all([loadMyHousingTours(),loadMyHousingInquiries()]).then(([a,b])=>{setTours(a);setInquiries(b)}).catch(e=>setError(e?.message==='SIGNED_OUT'?'Sign in to see your housing activity.':'Housing activity could not be loaded.')).finally(()=>setLoading(false))},[]);
 useFocusEffect(useCallback(()=>{load()},[load]));
 const unreadReplies=inquiries.filter(hasUnreadReply).length;
 // Opening a reply asks the server to stamp reply_read_at; the UI only updates after the server confirms.
 async function openReply(q:HousingInquiry){
  if(!hasUnreadReply(q))return;
  try{await markHousingInquiryReplyRead(q.id);setInquiries(v=>v.map(x=>x.id===q.id?{...x,reply_read_at:new Date().toISOString()}:x))}
  catch{notify('Could not update','We could not mark this reply as read. Please try again.')}
 }
 async function cancel(id:string){notify('Cancel tour request?','This changes your pending request to cancelled.',[{text:'Keep request',style:'cancel'},{text:'Cancel request',style:'destructive',onPress:async()=>{try{await cancelHousingTourRequest(id);await load()}catch{notify('Could not cancel','Please try again.')}}}])}
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Housing activity" backTo="/me"/><ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
  {loading?<State text="Loading housing activity…"/>:error?<State text={error}/>:<>
   <Text style={s.section}>TOUR REQUESTS</Text>{tours.length?tours.map(t=><View key={t.id} style={s.card}><View style={s.top}><InlineBadge tone={t.status==='confirmed'?'lime':undefined}>{t.status.toUpperCase()}</InlineBadge><Text style={s.date}>{new Date(t.preferred_date+'T00:00:00').toLocaleDateString()}</Text></View><Text style={s.title}>{t.preferred_window.toUpperCase()}</Text>{t.status==='confirmed'&&t.confirmed_date?<Text style={s.confirmed}>CONFIRMED · {new Date(t.confirmed_date+'T00:00:00').toLocaleDateString()}{t.confirmed_window?' · '+t.confirmed_window.toUpperCase():''}</Text>:null}{t.note?<Text style={s.body}>{t.note}</Text>:null}{t.partner_note?<View style={s.response}><Text style={s.responseLabel}>PROPERTY TEAM</Text><Text style={s.responseText}>{t.partner_note}</Text></View>:null}{t.status==='requested'?<Pressable style={s.link} onPress={()=>void cancel(t.id)}><Text style={s.linkText}>CANCEL REQUEST</Text></Pressable>:null}</View>):<Text style={s.none}>No tour requests yet.</Text>}
   <Text style={s.section}>PROPERTY QUESTIONS{unreadReplies?' · '+unreadReplies+' NEW':''}</Text>{inquiries.length?inquiries.map(q=><InquiryCard key={q.id} q={q} onOpenReply={openReply}/>):<Text style={s.none}>No property questions yet.</Text>}
  </>}
 </ScrollView></ScreenFrame>
}
const STAGE_LABEL={sent:'SENT',received:'RECEIVED',seen:'SEEN',replied:'REPLIED'} as const;
function InquiryCard({q,onOpenReply}:{q:HousingInquiry;onOpenReply:(q:HousingInquiry)=>void}){
 const [open,setOpen]=useState(false);
 const unread=hasUnreadReply(q);
 const stages=inquiryStages(q);
 function toggle(){const next=!open;setOpen(next);if(next&&unread)onOpenReply(q)}
 return <View style={s.card}>
  <Pressable accessibilityRole="button" onPress={toggle}>
   <View style={s.top}>
    <InlineBadge tone={q.responded_at?'lime':undefined}>{STAGE_LABEL[currentInquiryStage(q)]}</InlineBadge>
    {unread?<View style={s.newReply}><View style={s.newDot}/><Text style={s.newText}>NEW REPLY</Text></View>:<Text style={s.date}>{new Date(q.created_at).toLocaleDateString()}</Text>}
   </View>
   {q.listing?<Text style={s.home}>{q.listing.title} · {q.listing.city}, {q.listing.state}</Text>:null}
   <Text style={s.title}>{q.subject}</Text>
   <Text style={s.body} numberOfLines={open?undefined:3}>{q.message}</Text>
  </Pressable>
  <View style={s.stages}>{stages.map(st=><View key={st.stage} style={s.stage}><View style={[s.stageDot,st.reached&&s.stageDotOn]}/><Text style={[s.stageText,st.reached&&s.stageTextOn]}>{STAGE_LABEL[st.stage]}</Text>{st.reached&&st.at?<Text style={s.stageTime}>{new Date(st.at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</Text>:null}</View>)}</View>
  {q.response_message?(open||!unread)?<View style={s.response}><Text style={s.responseLabel}>PROPERTY TEAM REPLY{q.reply_read_at?' · READ':''}</Text><Text style={s.responseText}>{q.response_message}</Text>{q.responded_at?<Text style={s.responseDate}>{new Date(q.responded_at).toLocaleString()}</Text>:null}</View>:<Pressable style={s.link} onPress={toggle}><Text style={s.linkText}>OPEN REPLY</Text></Pressable>:<Text style={s.waiting}>Waiting for the property team. Status only changes when the property team acts in FairPath.</Text>}
  {q.listing?<Pressable style={s.link} onPress={()=>router.push(('/housing/'+q.listing!.id) as never)}><Text style={s.linkText}>VIEW HOME</Text></Pressable>:null}
 </View>;
}
function State({text}:{text:string}){return <View style={s.state}><Text style={s.stateText}>{text}</Text></View>}
const s=StyleSheet.create({
 newReply:{flexDirection:'row',alignItems:'center',gap:6},newDot:{width:8,height:8,borderRadius:4,backgroundColor:C.lime},newText:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.9},
 stages:{marginTop:12,gap:6},stage:{flexDirection:'row',alignItems:'center',gap:8},stageDot:{width:8,height:8,borderRadius:4,borderWidth:1,borderColor:C.borderStrong},stageDotOn:{backgroundColor:C.lime,borderColor:C.lime},stageText:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.9,width:64},stageTextOn:{color:C.white},stageTime:{color:C.muted,fontSize:9},
 waiting:{color:C.muted,fontSize:9,lineHeight:14,marginTop:10},content:{padding:L.mobileGutter,paddingBottom:40},state:{paddingVertical:40,alignItems:'center'},stateText:{color:C.mutedStrong},section:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginTop:16,marginBottom:4},none:{color:C.muted,fontSize:10,paddingVertical:16},card:{paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.borderStrong},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},date:{color:C.muted,fontSize:8},title:{color:C.white,fontFamily:F.extraBold,fontSize:15,marginTop:9},confirmed:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.6,marginTop:7},body:{color:C.mutedStrong,fontSize:10,lineHeight:16,marginTop:6},response:{borderLeftWidth:2,borderLeftColor:C.lime,paddingLeft:9,marginTop:10},responseLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:6.5,letterSpacing:.8},responseText:{color:C.white,fontSize:10,lineHeight:15,marginTop:4},responseDate:{color:C.muted,fontSize:7.5,marginTop:4},home:{color:C.lime,fontFamily:F.extraBold,fontSize:7.5,letterSpacing:.5,marginTop:9},link:{marginTop:10},linkText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7}});
