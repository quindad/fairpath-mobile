import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader, BottomNav } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { supabase } from '@/lib/supabase';

const rows=[
 ["Profile readiness","Review and complete your FairPath profile","/profile-readiness"],
 ["Saved homes","Your saved FairPath housing","/saved-homes"],
 ["Housing applications","Track standard and FastTrack applications","/housing-applications"],
 ["Privacy","Control your account and information","/profile-readiness"]
] as const;

export default function Screen(){
 async function signOut(){
  router.replace('/find-jobs' as never);
  const {error}=await supabase.auth.signOut();
  if(error){Alert.alert('Could not sign out','Please try again.');}
 }

 return <ScreenFrame>
  <PageHeader eyebrow="YOUR ACCOUNT" title="Me" onBack={false}/>
  <ScrollView contentContainerStyle={s.content}>
   <Text style={s.intro}>Your FairPath in one place.</Text>
   <View style={s.list}>
    {rows.map(([title,body,route])=><Pressable key={title} style={s.row} onPress={()=>router.push(route as never)}>
     <View style={s.copy}><Text style={s.title}>{title}</Text><Text style={s.body}>{body}</Text></View><Text style={s.arrow}>→</Text>
    </Pressable>)}
   </View>
   <Pressable style={s.signOut} onPress={()=>void signOut()}>
    <Text style={s.signOutText}>SIGN OUT</Text>
   </Pressable>
  </ScrollView>
  <BottomNav/>
 </ScreenFrame>
}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingBottom:28},
 intro:{color:C.mutedStrong,fontSize:14,lineHeight:21,paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},
 list:{},
 row:{minHeight:82,borderBottomWidth:1,borderBottomColor:C.border,flexDirection:'row',alignItems:'center'},
 copy:{flex:1,paddingRight:12},
 title:{color:C.white,fontFamily:F.extraBold,fontSize:17},
 body:{color:C.muted,fontSize:11,lineHeight:16,marginTop:4},
 arrow:{color:C.lime,fontSize:19},
 signOut:{height:46,marginTop:24,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},
 signOutText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1}
});
