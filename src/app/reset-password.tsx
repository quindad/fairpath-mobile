import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const LIME='#A8F32C', BLACK='#090A09', CARD='#151715', BORDER='#303330', MUTED='#909690', ERROR='#FF8A8A';

export default function ResetPasswordScreen(){
  const [ready,setReady]=useState(false),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[loading,setLoading]=useState(false),[errorMessage,setErrorMessage]=useState('');

  useEffect(()=>{let active=true; async function recover(){
    if(Platform.OS==='web'){
      const p=new URLSearchParams(window.location.hash.replace(/^#/,''));
      const access=p.get('access_token'),refresh=p.get('refresh_token'),err=p.get('error_description');
      if(err){if(active)setErrorMessage(err.replace(/\+/g,' '));return;}
      if(access&&refresh){const {error}=await supabase.auth.setSession({access_token:access,refresh_token:refresh});if(error){if(active)setErrorMessage('This reset link is invalid or expired.');return;}}
    }
    const {data}=await supabase.auth.getSession(); if(active){if(data.session)setReady(true);else setErrorMessage('This reset link is invalid or expired.');}
  } recover(); return()=>{active=false}},[]);

  async function updatePassword(){
    if(loading||!ready)return;
    if(password.length<8){setErrorMessage('Create a password with at least 8 characters.');return;}
    if(password!==confirm){setErrorMessage('Those passwords do not match.');return;}
    setLoading(true);setErrorMessage('');
    try{const {error}=await supabase.auth.updateUser({password});if(error){setErrorMessage(error.message);return;}await supabase.auth.signOut();router.replace('/sign-in');}
    catch{setErrorMessage('We could not update your password. Check your connection and try again.');}
    finally{setLoading(false);}
  }

  return <View style={styles.screen}><StatusBar style="light"/><SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.heading}><Text style={styles.kicker}>SECURE YOUR ACCOUNT</Text><Text style={styles.title}>Choose a new password.</Text><Text style={styles.subtitle}>Use at least 8 characters. After the update, FairPath will return you to sign in.</Text></View>
    {ready?<View style={styles.form}>
      <Text style={styles.label}>New password</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password" placeholder="At least 8 characters" placeholderTextColor="#666C66" style={styles.input}/>
      <Text style={styles.label}>Confirm new password</Text><TextInput value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password" placeholder="Enter it again" placeholderTextColor="#666C66" style={styles.input} onSubmitEditing={updatePassword}/>
      {errorMessage?<Text style={styles.errorText}>{errorMessage}</Text>:null}
      <Pressable style={[styles.primaryButton,loading&&styles.disabled]} onPress={updatePassword} disabled={loading}><Text style={styles.primaryText}>{loading?'Updating…':'Update password'}</Text><Text style={styles.arrow}>{loading?'•':'→'}</Text></Pressable>
    </View>:<View>{errorMessage?<Text style={styles.errorText}>{errorMessage}</Text>:<Text style={styles.subtitle}>Securing your reset link…</Text>}<Pressable style={styles.secondaryButton} onPress={()=>router.replace('/forgot-password')}><Text style={styles.secondaryText}>Request a new link</Text></Pressable></View>}
  </ScrollView></SafeAreaView></View>
}
const styles=StyleSheet.create({
screen:{flex:1,backgroundColor:BLACK},safeArea:{flex:1,width:'100%',maxWidth:620,alignSelf:'center'},content:{flexGrow:1,paddingHorizontal:24,paddingTop:80,paddingBottom:30},heading:{marginBottom:42},kicker:{color:LIME,fontSize:11,fontWeight:'800',letterSpacing:1.6,marginBottom:15},title:{color:'#F7F8F6',fontSize:46,lineHeight:49,fontWeight:'800',letterSpacing:-2.1},subtitle:{color:MUTED,fontSize:16,lineHeight:24,marginTop:18,maxWidth:500},form:{gap:10},label:{color:'#D7DAD6',fontSize:13,fontWeight:'700',marginTop:4},input:{minHeight:56,borderRadius:16,borderWidth:1,borderColor:BORDER,backgroundColor:CARD,color:'#F7F8F6',fontSize:16,paddingHorizontal:17},errorText:{color:ERROR,fontSize:13,lineHeight:19,marginVertical:8},primaryButton:{minHeight:60,borderRadius:18,backgroundColor:LIME,paddingHorizontal:20,marginTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},disabled:{opacity:.65},primaryText:{color:BLACK,fontSize:17,fontWeight:'800'},arrow:{color:BLACK,fontSize:25},secondaryButton:{minHeight:58,borderRadius:18,borderWidth:1,borderColor:BORDER,alignItems:'center',justifyContent:'center',backgroundColor:CARD,marginTop:24},secondaryText:{color:'#F2F3F1',fontSize:15,fontWeight:'700'}
});