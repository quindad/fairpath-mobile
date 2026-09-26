import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormScrollView } from '@/components/FormScrollView';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { recordSignUpConsent } from '@/core/profile/consent-service';
import { supabase } from '@/lib/supabase';

/** First-time Apple/Google members must accept Terms and Privacy; recorded in the append-only consent ledger. */
export default function AcceptTerms(){
 const params=useLocalSearchParams<{returnTo?:string}>();
 const returnTo=typeof params.returnTo==='string'&&params.returnTo.startsWith('/')?params.returnTo:null;
 const [agreed,setAgreed]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');

 async function accept(){
  if(!agreed||saving)return;
  setSaving(true);setError('');
  try{
   await recordSignUpConsent();
   const {data:profile}=await supabase.from('profiles').select('onboarding_completed').maybeSingle();
   router.replace((profile?.onboarding_completed?(returnTo??'/find-jobs'):'/onboarding') as never);
  }catch{setError('We could not save your agreement. Please try again.')}
  finally{setSaving(false)}
 }
 async function decline(){
  await supabase.auth.signOut();
  router.replace('/' as never);
 }

 return <View style={s.screen}><StatusBar style="light"/><SafeAreaView style={s.safe}>
  <FormScrollView contentContainerStyle={s.content}>
   <Text style={s.kicker}>ONE LAST STEP</Text>
   <Text style={s.title}>Welcome to FairPath.</Text>
   <Text style={s.body}>Before you continue, please confirm you agree to FairPath's Terms and Privacy Policy. You can change what you share later in your profile.</Text>
   <Pressable accessibilityRole="checkbox" accessibilityState={{checked:agreed}} style={s.row} onPress={()=>setAgreed(v=>!v)}>
    <View style={[s.box,agreed&&s.boxOn]}>{agreed?<Text style={s.mark}>✓</Text>:null}</View>
    <Text style={s.rowText}>I agree to FairPath's Terms and Privacy Policy.</Text>
   </Pressable>
   {error?<Text style={s.error}>{error}</Text>:null}
   <Pressable accessibilityRole="button" style={[s.primary,(!agreed||saving)&&s.primaryOff]} disabled={!agreed||saving} onPress={()=>void accept()}>
    <Text style={[s.primaryText,(!agreed||saving)&&s.primaryTextOff]}>{saving?'Saving…':'Agree and continue'}</Text><Text style={[s.primaryText,(!agreed||saving)&&s.primaryTextOff]}>→</Text>
   </Pressable>
   <Pressable accessibilityRole="button" style={s.secondary} onPress={()=>void decline()}><Text style={s.secondaryText}>Not now — sign out</Text></Pressable>
  </FormScrollView>
 </SafeAreaView></View>;
}

const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:C.black},safe:{flex:1,width:'100%',maxWidth:620,alignSelf:'center'},
 content:{padding:L.mobileGutter,paddingTop:40,paddingBottom:40},
 kicker:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.6},title:{color:C.white,fontFamily:F.black,fontSize:34,lineHeight:36,marginTop:10},body:{color:C.mutedStrong,fontSize:14,lineHeight:21,marginTop:14},
 row:{flexDirection:'row',alignItems:'center',gap:12,marginTop:26,paddingVertical:8},box:{width:24,height:24,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},boxOn:{backgroundColor:C.lime,borderColor:C.lime},mark:{color:C.black,fontFamily:F.extraBold},rowText:{color:C.white,fontSize:13,flex:1,lineHeight:19},
 error:{color:'#FF8A8A',fontSize:12,marginTop:10},
 primary:{height:52,backgroundColor:C.lime,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:22},primaryOff:{backgroundColor:'#1A2114',borderWidth:1,borderColor:'#2C3823'},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:12,letterSpacing:.6},primaryTextOff:{color:C.mutedStrong},
 secondary:{height:46,alignItems:'center',justifyContent:'center',marginTop:8},secondaryText:{color:C.mutedStrong,fontFamily:F.bold,fontSize:12}
});
