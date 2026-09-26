import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import { isAppleSignInAvailable, routeAfterSocialSignIn, signInWithApple, signInWithGoogle, type SocialAuthResult } from '@/core/auth/social-auth';

/**
 * Apple + Google entry points shared by sign-in and sign-up.
 * `beforeStart` lets sign-up require the Terms/Privacy checkbox first. On success, `onSignedIn` runs
 * (sign-up records consent there); cancellation is silent and errors are shown inline.
 */
export function SocialAuthButtons({returnTo,beforeStart,onSignedIn}:{returnTo:string|null;beforeStart?:()=>boolean;onSignedIn?:(r:Extract<SocialAuthResult,{status:'success'}>)=>Promise<Partial<Extract<SocialAuthResult,{status:'success'}>>|void>|void}){
 const [busy,setBusy]=useState<'apple'|'google'|null>(null);
 const [message,setMessage]=useState('');
 const [appleOk,setAppleOk]=useState(false);
 const [AppleButton,setAppleButton]=useState<null|typeof import('expo-apple-authentication').AppleAuthenticationButton>(null);
 const [Apple,setApple]=useState<null|typeof import('expo-apple-authentication')>(null);

 useEffect(()=>{
  let active=true;
  isAppleSignInAvailable().then(async ok=>{
   if(!active||!ok)return;
   const mod=await import('expo-apple-authentication');
   if(!active)return;
   setApple(mod);setAppleButton(()=>mod.AppleAuthenticationButton);setAppleOk(true);
  });
  return()=>{active=false};
 },[]);

 async function run(provider:'apple'|'google'){
  if(busy)return;
  setMessage('');
  if(beforeStart&&!beforeStart())return;
  setBusy(provider);
  try{
   const result=provider==='apple'?await signInWithApple():await signInWithGoogle();
   if(result.status==='cancelled')return;
   if(result.status==='error'){setMessage(result.message);return}
   const patch=onSignedIn?await onSignedIn(result):undefined;
   router.replace(routeAfterSocialSignIn({...result,...(patch??{})},returnTo) as never);
  }finally{setBusy(null)}
 }

 return <View style={s.wrap}>
  <View style={s.dividerRow}><View style={s.rule}/><Text style={s.or}>OR CONTINUE WITH</Text><View style={s.rule}/></View>
  {appleOk&&AppleButton&&Apple?<AppleButton
   buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
   buttonStyle={Apple.AppleAuthenticationButtonStyle.WHITE}
   cornerRadius={2}
   style={s.apple}
   onPress={()=>void run('apple')}
  />:null}
  <Pressable accessibilityRole="button" accessibilityLabel="Continue with Google" style={[s.google,busy&&s.disabled]} disabled={Boolean(busy)} onPress={()=>void run('google')}>
   <View style={s.gMark}><Text style={s.gMarkText}>G</Text></View>
   <Text style={s.googleText}>{busy==='google'?'Opening Google…':'Continue with Google'}</Text>
  </Pressable>
  {message?<Text style={s.error}>{message}</Text>:null}
  {Platform.OS==='web'?null:<Text style={s.note}>New here? Signing in with Apple or Google creates your FairPath account.</Text>}
 </View>;
}

const s=StyleSheet.create({
 wrap:{marginTop:22},
 dividerRow:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:14},rule:{flex:1,height:1,backgroundColor:C.borderStrong},or:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2},
 apple:{height:48,width:'100%',marginBottom:10},
 google:{height:48,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A'},disabled:{opacity:.6},
 gMark:{width:22,height:22,backgroundColor:C.white,alignItems:'center',justifyContent:'center'},gMarkText:{color:'#4285F4',fontFamily:F.black,fontSize:14},
 googleText:{color:C.white,fontFamily:F.bold,fontSize:14},
 error:{color:'#FF8A8A',fontSize:12,lineHeight:18,marginTop:10},
 note:{color:C.muted,fontSize:10,lineHeight:15,marginTop:12,textAlign:'center'}
});
