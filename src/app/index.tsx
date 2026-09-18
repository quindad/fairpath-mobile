import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LIME='#A8F32C', BLACK='#090A09', CARD='#111311', MUTED='#B0B4AF';

export default function HomeScreen(){
 const {width}=useWindowDimensions();
 const desktop=width>=768;
 return <View style={styles.screen}><StatusBar style="light"/><SafeAreaView style={styles.safe}>
   <View pointerEvents="none" style={styles.glowTop}/><View pointerEvents="none" style={styles.glowBottom}/>
   <View style={[styles.frame,desktop&&styles.frameDesktop]}>
     <View style={styles.brand}>
       <View style={styles.monogram}><Text style={styles.f}>F</Text><Text style={styles.p}>P</Text><Text style={styles.logoArrow}>➜</Text></View>
       <Text style={styles.brandName}><Text style={styles.white}>Fair</Text>Path</Text>
       <Text style={styles.tag}>A FAIRPATH FORWARD.</Text>
     </View>
     <View style={styles.main}>
       <View style={styles.eyebrow}><View style={styles.line}/><Text style={styles.eyebrowText}>OPPORTUNITY HAS A PATH</Text></View>
       <Text style={[styles.title,desktop&&styles.titleDesktop]}>FIND YOUR{String.fromCharCode(10)}<Text style={styles.lime}>FAIRPATH</Text>{String.fromCharCode(10)}FORWARD.</Text>
       <Text style={styles.subtitle}>Jobs, housing, resources and support built to help you move{String.fromCharCode(10)}forward — without judgment.</Text>
     </View>
     <View style={styles.actions}>
       <Pressable style={styles.primary} onPress={()=>router.push('/sign-up')}><Text style={styles.primaryText}>Get started</Text><View style={styles.arrowBox}><Text style={styles.arrow}>→</Text></View></Pressable>
       <Pressable style={styles.secondary} onPress={()=>router.push('/sign-in')}><Text style={styles.secondaryText}>I already have an account</Text></Pressable>
       <View style={styles.trust}><View style={styles.trustLine}/><Text style={styles.trustText}>Your story is yours. FairPath helps you find what comes next.</Text></View>
     </View>
   </View>
 </SafeAreaView></View>
}
const styles=StyleSheet.create({
 screen:{flex:1,backgroundColor:BLACK},safe:{flex:1,overflow:'hidden'},
 glowTop:{position:'absolute',width:420,height:420,borderRadius:210,backgroundColor:'#172608',opacity:.48,left:-260,top:-220},
 glowBottom:{position:'absolute',width:440,height:440,borderRadius:220,backgroundColor:'#183007',opacity:.46,right:-300,bottom:-270},
 frame:{flex:1,width:'100%',maxWidth:620,alignSelf:'center',paddingHorizontal:24,paddingTop:24,paddingBottom:28},
 frameDesktop:{maxWidth:690,paddingTop:28,paddingBottom:34},
 brand:{alignSelf:'center',alignItems:'center'},
 monogram:{height:58,width:92,flexDirection:'row',alignItems:'center',justifyContent:'center',position:'relative'},
 f:{color:'#F7F8F6',fontFamily:'LeagueSpartan_900Black',fontSize:60,lineHeight:62,letterSpacing:-10},
 p:{color:LIME,fontFamily:'LeagueSpartan_900Black',fontSize:60,lineHeight:62,letterSpacing:-6},
 logoArrow:{position:'absolute',color:BLACK,fontSize:27,fontWeight:'900',right:3,top:12},
 brandName:{color:LIME,fontFamily:'LeagueSpartan_900Black',fontSize:27,lineHeight:27,letterSpacing:-1.4,marginTop:-4},
 white:{color:'#F7F8F6'},tag:{color:'#E2E4E1',fontFamily:'LeagueSpartan_700Bold',fontSize:8,letterSpacing:3.4,marginTop:7},
 main:{flex:1,justifyContent:'center',paddingTop:28,paddingBottom:20},
 eyebrow:{flexDirection:'row',alignItems:'center',gap:14,marginBottom:25},line:{width:52,height:2,backgroundColor:LIME},
 eyebrowText:{color:LIME,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:12,letterSpacing:2.1},
 title:{color:'#F8F8F7',fontFamily:'LeagueSpartan_900Black',fontSize:59,lineHeight:51,letterSpacing:-2.5},
 titleDesktop:{fontSize:72,lineHeight:61,letterSpacing:-3},
 lime:{color:LIME},
 subtitle:{color:MUTED,fontSize:18,lineHeight:28,marginTop:27},
 actions:{gap:13},
 primary:{height:68,borderRadius:17,backgroundColor:LIME,paddingLeft:24,paddingRight:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 primaryText:{color:BLACK,fontFamily:'LeagueSpartan_800ExtraBold',fontSize:18},
 arrowBox:{width:46,height:46,alignItems:'center',justifyContent:'center'},
 arrow:{color:BLACK,fontSize:28,lineHeight:30},
 secondary:{height:64,borderRadius:17,borderWidth:1,borderColor:'#414541',backgroundColor:CARD,alignItems:'center',justifyContent:'center'},
 secondaryText:{color:'#F5F6F4',fontFamily:'LeagueSpartan_700Bold',fontSize:16},
 trust:{flexDirection:'row',alignItems:'center',gap:14,marginTop:9},trustLine:{width:2,height:34,backgroundColor:LIME},
 trustText:{color:'#858B85',fontSize:12,lineHeight:18}
});