import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notify } from '@/core/ui/notify';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { createHousingInquiry } from '@/core/opportunities/opportunity-service';

const MIN_LENGTH=10;
const ERRORS:Record<string,string>={
 INVALID_MESSAGE:'Write at least a short question (10 characters) and keep it under 2,000.',
 RATE_LIMITED:'You have sent several questions about this home today. Please wait for a reply before sending more.',
 LISTING_UNAVAILABLE:'This home is no longer available, so it cannot receive questions.'
};

/**
 * One-shot property question (one message, one reply). This is NOT a full messaging system:
 * there are no threads or follow-ups yet. The server (send_housing_inquiry) validates the text,
 * treats a repeat of the same message within 10 minutes as the same question, and rate-limits.
 */
export default function HousingInquiry(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [subject,setSubject]=useState('Question about this home');
 const [message,setMessage]=useState('');
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 const sending=useRef(false);

 async function submit(){
  if(!id||sending.current)return;
  if(message.trim().length<MIN_LENGTH){setError('Write at least a short question before sending.');return}
  sending.current=true;
  setSaving(true);setError('');
  try{
   await createHousingInquiry({listingId:id,subject,message});
   notify('Question sent','Your question was saved. Replies appear in Housing Activity.');
   router.replace('/housing-activity' as never);
  }catch(e){
   const code=e instanceof Error?e.message:'';
   if(code==='SIGNED_OUT'){router.push(('/sign-up?returnTo='+encodeURIComponent('/housing-inquiry/'+id)) as never);return}
   setError(ERRORS[code]??'Your question was not sent. Check your connection and try again.');
  }finally{
   sending.current=false;
   setSaving(false);
  }
 }

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Ask about this home" backTo={id?'/housing/'+id:'/find-housing'}/>
  <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
   <Text style={s.intro}>Ask about availability, screening, move-in requirements, utilities, accessibility, or another property-specific detail. The property team can reply once; this is a single question, not a chat.</Text>
   <Text style={s.label}>SUBJECT</Text>
   <TextInput style={s.input} value={subject} onChangeText={setSubject} maxLength={120} placeholderTextColor={C.muted}/>
   <Text style={s.label}>MESSAGE · REQUIRED</Text>
   <TextInput style={[s.input,s.multi,error?s.inputError:null]} value={message} onChangeText={v=>{setMessage(v);if(error)setError('')}} multiline maxLength={2000} placeholder="What would you like to know?" placeholderTextColor={C.muted}/>
   <Text style={s.helper}>Do not send Social Security numbers, bank credentials, or other unnecessary sensitive information in messages.</Text>
   {error?<View style={s.errorBox}><Lucide name="triangle-alert" color={C.danger} size={14}/><Text style={s.errorText}>{error}</Text></View>:null}
   <Pressable accessibilityRole="button" style={[s.primary,saving&&s.primaryMuted]} onPress={()=>void submit()} disabled={saving}>
    <Text style={s.primaryText}>{saving?'SENDING…':'SEND QUESTION'}</Text>
    <Lucide name="send" color={C.black} size={16}/>
   </Pressable>
  </ScrollView>
 </ScreenFrame>;
}

const s=StyleSheet.create({
 content:{padding:L.mobileGutter,paddingBottom:40},
 intro:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginBottom:18},
 label:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1,marginTop:12,marginBottom:7},
 input:{minHeight:48,borderWidth:1,borderColor:C.borderStrong,color:C.white,paddingHorizontal:12,fontSize:13},
 inputError:{borderColor:C.danger},
 multi:{minHeight:130,paddingTop:12,textAlignVertical:'top'},
 helper:{color:C.muted,fontSize:9,lineHeight:14,marginTop:8},
 errorBox:{flexDirection:'row',gap:8,alignItems:'flex-start',borderWidth:1,borderColor:C.danger,padding:10,marginTop:12},errorText:{color:C.danger,fontSize:11,lineHeight:16,flex:1},
 primary:{height:50,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,marginTop:18},primaryMuted:{opacity:.6},
 primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.8}
});
