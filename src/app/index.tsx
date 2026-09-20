import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FairPathLogo } from '@/components/FairPathLogo';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import { supabase } from '@/lib/supabase';

export default function Welcome(){
 const [checking,setChecking]=useState(true);

 useEffect(()=>{
  let active=true;
  supabase.auth.getUser().then(({data})=>{
   if(!active)return;
   if(data.user){router.replace('/home' as never);return}
   setChecking(false);
  }).catch(()=>setChecking(false));
  return()=>{active=false};
 },[]);

 if(checking)return <View style={s.screen}/>;

 return <View style={s.screen}>
  <SafeAreaView style={s.safe}>
   <View style={s.brand}>
    <FairPathLogo width={220}/>
    <Text style={s.tag}>OPPORTUNITY HAS A PATH</Text>
   </View>

   <View style={s.hero}>
    <Text style={s.eyebrow}>WELCOME TO FAIRPATH</Text>
    <Text style={s.title}>Your next move{"\n"}starts here.</Text>
    <Text style={s.body}>Jobs, housing, resources and tools built to help you move forward. Browse without an account. Create one when you’re ready to save, apply and track your progress.</Text>
   </View>

   <View style={s.actions}>
    <Pressable style={s.primary} onPress={()=>router.push('/sign-in' as never)}>
     <Text style={s.primaryText}>SIGN IN</Text><Text style={s.primaryArrow}>→</Text>
    </Pressable>
    <Pressable style={s.secondary} onPress={()=>router.push('/sign-up' as never)}>
     <Text style={s.secondaryText}>CREATE ACCOUNT</Text>
    </Pressable>
    <Pressable style={s.guest} onPress={()=>router.replace('/find-jobs' as never)}>
     <Text style={s.guestText}>BROWSE AS GUEST</Text><Text style={s.guestArrow}>→</Text>
    </Pressable>
    <Text style={s.note}>No account needed to browse jobs or housing.</Text>
   </View>
  </SafeAreaView>
 </View>;
}

const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:C.black},
 safe:{flex:1,width:'100%',maxWidth:620,alignSelf:'center',paddingHorizontal:22,paddingTop:18,paddingBottom:26},
 brand:{alignItems:'center'},
 tag:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:2.4,marginTop:4},
 hero:{flex:1,justifyContent:'center',paddingVertical:28},
 eyebrow:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.4,marginBottom:14},
 title:{color:C.white,fontFamily:F.black,fontSize:47,lineHeight:48,letterSpacing:-1.5},
 body:{color:C.mutedStrong,fontSize:14,lineHeight:22,marginTop:18,maxWidth:500},
 actions:{gap:10},
 primary:{height:52,backgroundColor:C.lime,paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:.9},
 primaryArrow:{color:C.black,fontSize:20},
 secondary:{height:50,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},
 secondaryText:{color:C.white,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},
 guest:{height:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:2},
 guestText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},
 guestArrow:{color:C.lime,fontSize:18},
 note:{color:C.muted,fontSize:10,textAlign:'center',marginTop:2}
});
