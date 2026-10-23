import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { getNotificationPreferences, setNotificationPreferences, type NotificationPreferences } from '@/core/notifications/notification-preferences';
import { disablePushRegistration, syncPushRegistration } from '@/core/notifications/push-registration';
import {
  loadOpportunityAlertPrefs,
  saveOpportunityAlertPrefs,
  type OpportunityAlertPrefs,
} from '@/core/opportunity/opportunity-alert-prefs';

export default function NotificationSettings() {
 const [prefs,setPrefs]=useState<NotificationPreferences|null>(null);
 const [oppPrefs,setOppPrefs]=useState<OpportunityAlertPrefs|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 useEffect(()=>{let active=true;Promise.all([getNotificationPreferences(),loadOpportunityAlertPrefs()]).then(([v,o])=>{if(active){setPrefs(v);setOppPrefs(o)}}).catch(()=>{if(active)setError('Could not load notification preferences.')});return()=>{active=false}},[]);
 async function changeOpp(key:keyof OpportunityAlertPrefs,value:boolean) {
  if(!oppPrefs||busy)return;
  setBusy(true);setError('');
  const updated={...oppPrefs,[key]:value};
  try { await saveOpportunityAlertPrefs(updated); setOppPrefs(updated); }
  catch { setError('Unable to save opportunity alert settings.'); }
  finally { setBusy(false); }
 }
 async function change(key:keyof NotificationPreferences,value:boolean) {
  if(!prefs||busy)return;
  setBusy(true);setError('');setMessage('');
  const updated={...prefs,[key]:value};
  try {
   await setNotificationPreferences(updated);
   if(key==='push_enabled') {
    if(value) {
     const result=await syncPushRegistration();
     if(result!=='registered') {
      await setNotificationPreferences({...updated,push_enabled:false});
      setPrefs({...updated,push_enabled:false});
      setMessage(result==='permission-denied'?'Enable notifications in your device settings.':'Push notifications are unavailable on this device.');
      return;
     }
    } else await disablePushRegistration();
  }
   setPrefs(updated);
  } catch {
   setError('Unable to save your settings. Please try again.');
  } finally {setBusy(false)}
 }
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH" title="Notification settings" backTo="/notifications"/>
  <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
   <Text style={s.intro}>Choose which updates FairPath can send to your phone. Your in-app inbox remains available.</Text>
   {!prefs&&!error?<ActivityIndicator color={C.lime}/>:null}
   {prefs?<><View style={s.row}><View style={s.copy}><Text style={s.title}>Push notifications</Text><Text style={s.description}>Application, housing and account updates.</Text></View><Switch disabled={busy} value={prefs.push_enabled} onValueChange={v=>void change('push_enabled',v)} trackColor={{true:C.lime}}/></View>
   <View style={s.row}><View style={s.copy}><Text style={s.title}>Marketing updates</Text><Text style={s.description}>Optional FairPath announcements.</Text></View><Switch disabled={busy} value={prefs.marketing_enabled} onValueChange={v=>void change('marketing_enabled',v)} trackColor={{true:C.lime}}/></View></>:null}
   {oppPrefs?<><Text style={[s.intro,{marginTop:24}]}>Opportunity alerts (device preferences). Push delivery still requires push notifications above; no campaigns run until you opt in here.</Text>
   <View style={s.row}><View style={s.copy}><Text style={s.title}>Opportunity alerts</Text><Text style={s.description}>GIVE matches, resources, referrals, deadlines, and org programs.</Text></View><Switch disabled={busy} value={oppPrefs.enabled} onValueChange={v=>void changeOpp('enabled',v)} trackColor={{true:C.lime}}/></View>
   {oppPrefs.enabled?<><View style={s.row}><View style={s.copy}><Text style={s.title}>Relevant GIVE</Text></View><Switch disabled={busy} value={oppPrefs.relevantGive} onValueChange={v=>void changeOpp('relevantGive',v)} trackColor={{true:C.lime}}/></View>
   <View style={s.row}><View style={s.copy}><Text style={s.title}>New resources</Text></View><Switch disabled={busy} value={oppPrefs.newResources} onValueChange={v=>void changeOpp('newResources',v)} trackColor={{true:C.lime}}/></View>
   <View style={s.row}><View style={s.copy}><Text style={s.title}>Referral updates</Text></View><Switch disabled={busy} value={oppPrefs.referralUpdates} onValueChange={v=>void changeOpp('referralUpdates',v)} trackColor={{true:C.lime}}/></View>
   <View style={s.row}><View style={s.copy}><Text style={s.title}>Education deadlines</Text></View><Switch disabled={busy} value={oppPrefs.educationDeadlines} onValueChange={v=>void changeOpp('educationDeadlines',v)} trackColor={{true:C.lime}}/></View>
   <View style={s.row}><View style={s.copy}><Text style={s.title}>Organization opportunities</Text></View><Switch disabled={busy} value={oppPrefs.orgOpportunities} onValueChange={v=>void changeOpp('orgOpportunities',v)} trackColor={{true:C.lime}}/></View></>:null}</>:null}
   {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
   {message?<Text accessibilityRole="alert" style={s.description}>{message}</Text>:null}
   {error&&!prefs?<Pressable onPress={()=>void getNotificationPreferences().then(setPrefs).then(()=>setError('')).catch(()=>{})}><Text style={s.link}>RETRY</Text></Pressable>:null}
  </ScrollView></ScreenFrame>;
}
const s=StyleSheet.create({content:{paddingHorizontal:L.mobileGutter,paddingVertical:24},intro:{color:C.mutedStrong,fontSize:12,lineHeight:20,marginBottom:20},row:{paddingVertical:20,borderBottomWidth:1,borderBottomColor:C.border,flexDirection:'row',alignItems:'center',gap:15},copy:{flex:1},title:{color:C.white,fontFamily:F.extraBold,fontSize:14},description:{color:C.mutedStrong,fontSize:11,lineHeight:18,marginTop:6},error:{color:'#FF9A9A',fontSize:12,marginTop:20},link:{color:C.lime,fontFamily:F.extraBold,marginTop:20}});
