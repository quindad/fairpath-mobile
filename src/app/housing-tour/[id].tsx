import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { createHousingTourRequest } from '@/core/opportunities/opportunity-service';
import { isTodayOrFutureDateText, isValidDateText } from '@/core/forms/formatters';
import { SimpleDatePicker } from '@/components/SimpleDatePicker';

const WINDOWS=['morning','afternoon','evening','flexible'] as const;
export default function HousingTour(){
 const {id}=useLocalSearchParams<{id:string}>(); const [date,setDate]=useState(''); const [window,setWindow]=useState<(typeof WINDOWS)[number]>('flexible'); const [note,setNote]=useState(''); const [saving,setSaving]=useState(false);
 async function submit(){if(!id||saving)return;if(!isValidDateText(date,{allowFuture:true})||!isTodayOrFutureDateText(date)){Alert.alert('Choose a future date','Tour requests must be for today or a future date.');return}const [m,d,y]=date.split('/');setSaving(true);try{await createHousingTourRequest({listingId:id,preferredDate:`${y}-${m}-${d}`,preferredWindow:window,note});Alert.alert('Tour request sent','Your request is saved in FairPath. A property partner can confirm or decline it when Partner tools are live.');router.back()}catch(e){if(e instanceof Error&&e.message==='SIGNED_OUT'){router.push(('/sign-up?returnTo='+encodeURIComponent('/housing-tour/'+id)) as never);return}Alert.alert('Could not request tour','Please try again.')}finally{setSaving(false)}}
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH HOUSING" title="Request a tour" backTo={id?'/housing/'+id:'/find-housing'}/><ScrollView contentContainerStyle={s.content}>
  <Text style={s.intro}>Choose a preferred date and time window. This is a request, not a confirmed appointment.</Text>
  <SimpleDatePicker label="PREFERRED DATE" value={date} onChange={setDate} minDate={new Date()}/>
  <Text style={s.label}>TIME WINDOW</Text><View style={s.grid}>{WINDOWS.map(x=><Pressable key={x} style={[s.choice,window===x&&s.choiceOn]} onPress={()=>setWindow(x)}><Text style={[s.choiceText,window===x&&s.choiceTextOn]}>{x.toUpperCase()}</Text></Pressable>)}</View>
  <Text style={s.label}>NOTE</Text><TextInput style={[s.input,s.multi]} value={note} onChangeText={setNote} multiline placeholder="Optional note for the property team" placeholderTextColor={C.muted}/>
  <View style={s.notice}><Lucide name="calendar-clock" color={C.lime} size={15}/><Text style={s.noticeText}>FairPath will show this request to the property side once the FairPath Partner workflow is connected. Until then, it remains a saved request in your account.</Text></View>
  <Pressable style={s.primary} onPress={()=>void submit()} disabled={saving}><Text style={s.primaryText}>{saving?'SENDING…':'REQUEST TOUR'}</Text><Lucide name="arrow-right" color={C.black} size={16}/></Pressable>
 </ScrollView></ScreenFrame>
}
const s=StyleSheet.create({content:{padding:L.mobileGutter,paddingBottom:40},intro:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginBottom:20},label:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1,marginTop:14,marginBottom:7},input:{minHeight:48,borderWidth:1,borderColor:C.borderStrong,color:C.white,paddingHorizontal:12,fontSize:13},multi:{minHeight:96,paddingTop:12,textAlignVertical:'top'},grid:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{minHeight:40,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:12,alignItems:'center',justifyContent:'center'},choiceOn:{borderColor:C.lime,backgroundColor:'#10150C'},choiceText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7.5},choiceTextOn:{color:C.lime},notice:{flexDirection:'row',gap:9,borderWidth:1,borderColor:'#526F2B',padding:13,marginTop:18},noticeText:{color:C.mutedStrong,fontSize:9,lineHeight:14,flex:1},primary:{height:50,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,marginTop:18},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.8}});
