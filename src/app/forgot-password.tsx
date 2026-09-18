import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const LIME='#A8F32C', BLACK='#090A09', CARD='#151715', BORDER='#303330', MUTED='#909690', ERROR='#FF8A8A';

export default function ForgotPasswordScreen() {
  const [email,setEmail]=useState('');
  const [loading,setLoading]=useState(false);
  const [errorMessage,setErrorMessage]=useState('');
  const [sent,setSent]=useState(false);

  async function sendReset() {
    if (loading) return;
    const cleanEmail=email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) { setErrorMessage('Enter a valid email address.'); return; }
    setLoading(true); setErrorMessage('');
    try {
      const redirectTo=Platform.OS==='web'
        ? window.location.origin + '/reset-password'
        : 'fairpathmobile://reset-password';
      const { error }=await supabase.auth.resetPasswordForEmail(cleanEmail,{redirectTo});
      if (error) { setErrorMessage(error.message); return; }
      setSent(true);
    } catch {
      setErrorMessage('We could not send the reset email right now. Check your connection and try again.');
    } finally { setLoading(false); }
  }

  return <View style={styles.screen}><StatusBar style="light"/><SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={()=>router.replace('/sign-in')} style={styles.backButton}><Text style={styles.backArrow}>←</Text></Pressable>
      <View style={styles.heading}>
        <Text style={styles.kicker}>ACCOUNT RECOVERY</Text>
        <Text style={styles.title}>{sent?'Check your email.':'Reset your password.'}</Text>
        <Text style={styles.subtitle}>{sent?'If an account exists for that email, FairPath sent a secure password-reset link.':'Enter the email connected to your FairPath account.'}</Text>
      </View>
      {!sent ? <View style={styles.form}>
        <Text style={styles.label}>Email</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@email.com" placeholderTextColor="#666C66" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" style={styles.input} onSubmitEditing={sendReset}/>
        {errorMessage?<Text style={styles.errorText}>{errorMessage}</Text>:null}
        <Pressable style={[styles.primaryButton,loading&&styles.disabled]} onPress={sendReset} disabled={loading}>
          <Text style={styles.primaryText}>{loading?'Sending…':'Send reset link'}</Text><Text style={styles.arrow}>{loading?'•':'→'}</Text>
        </Pressable>
      </View> : <Pressable style={styles.secondaryButton} onPress={()=>router.replace('/sign-in')}><Text style={styles.secondaryText}>Back to sign in</Text></Pressable>}
    </ScrollView>
  </SafeAreaView></View>;
}
const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:BLACK},safeArea:{flex:1,width:'100%',maxWidth:620,alignSelf:'center'},content:{flexGrow:1,paddingHorizontal:24,paddingTop:12,paddingBottom:30},
  backButton:{width:44,height:44,borderRadius:14,backgroundColor:CARD,borderWidth:1,borderColor:BORDER,alignItems:'center',justifyContent:'center'},backArrow:{color:'#F6F7F5',fontSize:23},
  heading:{marginTop:70,marginBottom:42},kicker:{color:LIME,fontSize:11,fontWeight:'800',letterSpacing:1.6,marginBottom:15},title:{color:'#F7F8F6',fontSize:46,lineHeight:49,fontWeight:'800',letterSpacing:-2.1},subtitle:{color:MUTED,fontSize:16,lineHeight:24,marginTop:18,maxWidth:500},
  form:{gap:10},label:{color:'#D7DAD6',fontSize:13,fontWeight:'700'},input:{minHeight:56,borderRadius:16,borderWidth:1,borderColor:BORDER,backgroundColor:CARD,color:'#F7F8F6',fontSize:16,paddingHorizontal:17},errorText:{color:ERROR,fontSize:13,lineHeight:19},
  primaryButton:{minHeight:60,borderRadius:18,backgroundColor:LIME,paddingHorizontal:20,marginTop:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},disabled:{opacity:.65},primaryText:{color:BLACK,fontSize:17,fontWeight:'800'},arrow:{color:BLACK,fontSize:25},
  secondaryButton:{minHeight:58,borderRadius:18,borderWidth:1,borderColor:BORDER,alignItems:'center',justifyContent:'center',backgroundColor:CARD},secondaryText:{color:'#F2F3F1',fontSize:15,fontWeight:'700'}
});