import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadUserNotifications, markAllNotificationsRead, markNotificationRead, UserNotification } from '@/core/opportunities/opportunity-service';

export default function Notifications(){
 const [rows,setRows]=useState<UserNotification[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=useCallback(()=>{setLoading(true);setError('');loadUserNotifications().then(setRows).catch(e=>setError(e?.message==='SIGNED_OUT'?'Sign in to see notifications.':'Notifications could not be loaded.')).finally(()=>setLoading(false))},[]);
 useFocusEffect(useCallback(()=>{load()},[load]));
 const unread=rows.filter(x=>!x.read_at).length;
 async function open(n:UserNotification){if(!n.read_at){try{await markNotificationRead(n.id);setRows(v=>v.map(x=>x.id===n.id?{...x,read_at:new Date().toISOString()}:x))}catch{}}if(n.route)router.push(n.route as never)}
 async function markAll(){try{await markAllNotificationsRead();setRows(v=>v.map(x=>({...x,read_at:x.read_at??new Date().toISOString()})))}catch{}}
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH" title="Notifications" backTo="/me"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.head}><View><Text style={s.eyebrow}>IN-APP INBOX</Text><Text style={s.summary}>{unread?unread+' unread':'You’re all caught up.'}</Text></View>{unread?<Pressable onPress={()=>void markAll()}><Text style={s.markAll}>MARK ALL READ</Text></Pressable>:null}</View>
   <Text style={s.delivery}>Housing application, tour and property-question updates appear here immediately. Push/email delivery can be added on top of this inbox without changing the Housing workflow.</Text>
   {loading?<State text="Loading notifications…"/>:error?<State text={error}/>:rows.length===0?<View style={s.empty}><View style={s.icon}><Lucide name="bell" color={C.lime} size={20}/></View><Text style={s.emptyTitle}>NO UPDATES YET</Text><Text style={s.emptyBody}>Application status, tour and property-response updates will appear here.</Text></View>:rows.map(n=><Pressable key={n.id} style={[s.row,!n.read_at&&s.unread]} onPress={()=>void open(n)}>
    <View style={[s.dot,!n.read_at&&s.dotOn]}/><View style={s.copy}><Text style={s.category}>{n.category.replaceAll('_',' ').toUpperCase()}</Text><Text style={s.title}>{n.title}</Text><Text style={s.body}>{n.body}</Text><Text style={s.date}>{new Date(n.created_at).toLocaleString()}</Text></View>{n.route?<Lucide name="arrow-right" color={C.lime} size={14}/>:null}
   </Pressable>)}
  </ScrollView>
 </ScreenFrame>
}
function State({text}:{text:string}){return <View style={s.state}><Text style={s.stateText}>{text}</Text></View>}
const s=StyleSheet.create({content:{paddingHorizontal:L.mobileGutter,paddingBottom:40},head:{paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.borderStrong,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},eyebrow:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},summary:{color:C.white,fontFamily:F.black,fontSize:20,marginTop:4},markAll:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},delivery:{color:C.muted,fontSize:9,lineHeight:14,paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.border},state:{paddingVertical:38,alignItems:'center'},stateText:{color:C.mutedStrong},empty:{paddingVertical:34},icon:{width:42,height:42,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},emptyTitle:{color:C.white,fontFamily:F.black,fontSize:18,marginTop:15},emptyBody:{color:C.muted,fontSize:10,lineHeight:16,marginTop:5},row:{minHeight:94,borderBottomWidth:1,borderBottomColor:C.border,flexDirection:'row',alignItems:'center',gap:9,paddingVertical:13,paddingHorizontal:7},unread:{backgroundColor:'#0E130B'},dot:{width:8,height:8,borderRadius:4,borderWidth:1,borderColor:C.borderStrong},dotOn:{backgroundColor:C.lime,borderColor:C.lime},copy:{flex:1,minWidth:0},category:{color:C.lime,fontFamily:F.extraBold,fontSize:6.5,letterSpacing:.8},title:{color:C.white,fontFamily:F.extraBold,fontSize:12,marginTop:4},body:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:4},date:{color:C.muted,fontSize:7.5,marginTop:6}});
