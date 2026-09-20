import { router, usePathname } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L, FairPathRadius as R } from '@/constants/fairpath';

export function ScreenFrame({children,showNav=false}:{children:React.ReactNode;showNav?:boolean}){
  return <View style={s.screen}><SafeAreaView style={s.safe}>{children}{showNav?<BottomNav/>:null}</SafeAreaView></View>;
}
export function safeBack(fallback='/home'){
  if(router.canGoBack())router.back();
  else router.replace(fallback as never);
}
export function PageHeader({eyebrow,title,onBack=true,backTo='/home',alwaysBackTo=false,trailing}:{eyebrow:string;title:string;onBack?:boolean|(()=>void);backTo?:string;alwaysBackTo?:boolean;trailing?:React.ReactNode}){
  const goBack=()=>typeof onBack==='function'?onBack():alwaysBackTo?router.replace(backTo as never):safeBack(backTo);
  return <View style={s.header}>{onBack?<Pressable accessibilityRole="button" accessibilityLabel="Go back" style={s.back} onPress={goBack}><Text style={s.backText}>←</Text></Pressable>:null}<View style={s.headerCopy}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.title}>{title}</Text></View>{trailing?<View style={s.trailing}>{trailing}</View>:null}</View>;
}
export function SectionTitle({children}:{children:React.ReactNode}){return <Text style={s.section}>{children}</Text>}
export function SharpChip({label,active,onPress}:{label:string;active?:boolean;onPress?:()=>void}){
  return <Pressable onPress={onPress} style={[s.chip,active&&s.chipActive]}><Text style={[s.chipText,active&&s.chipTextActive]}>{label}</Text></Pressable>;
}
export function FilterStrip({children}:{children:React.ReactNode}){return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterStrip}>{children}</ScrollView>}
export function BottomNav(){
 const pathname=usePathname();
 const items:[string,string,string][]=[['house','Home','/home'],['search','Find','/find'],['bot','AI','/fairpath-ai'],['store','Market','/marketplace'],['user','Me','/me']];
 return <View style={s.nav}>{items.map(([icon,label,route])=>{const active=pathname===route||(route==='/find'&&(pathname.includes('job')||pathname.includes('housing')))||(route==='/fairpath-ai'&&(pathname.includes('fairpath-ai')||pathname.includes('credit-tools')))||(route==='/marketplace'&&pathname.includes('market'));return <Pressable key={label} style={s.navItem} onPress={()=>router.replace(route as never)}><View style={[s.navIconWrap,active&&s.navIconWrapActive]}><Lucide name={icon as any} color={active?C.lime:C.mutedStrong} size={17}/></View><Text style={[s.navText,active&&s.navActive]}>{label}</Text>{active?<View style={s.navIndicator}/>:null}</Pressable>})}</View>
}
export function Divider(){return <View style={s.divider}/>}
export function InlineBadge({children,tone='default'}:{children:React.ReactNode;tone?:'default'|'lime'}){
 return <View style={[s.badge,tone==='lime'&&s.badgeLime]}><Text style={[s.badgeText,tone==='lime'&&s.badgeTextLime]}>{children}</Text></View>
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:C.black},safe:{flex:1,width:'100%',maxWidth:L.consumerMaxWidth,alignSelf:'center'},
 header:{minHeight:86,paddingHorizontal:L.mobileGutter,paddingTop:14,paddingBottom:14,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.border},
 back:{width:34,height:34,borderRadius:R.sm,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',marginRight:12},
 backText:{color:C.white,fontSize:18},headerCopy:{flex:1,minWidth:0},eyebrow:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.5},title:{color:C.white,fontFamily:F.black,fontSize:24,lineHeight:26,letterSpacing:-.6,marginTop:3,flexShrink:1},trailing:{marginLeft:10},
 section:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.4,marginBottom:8},
 chip:{height:34,borderRadius:R.sm,borderWidth:1,borderColor:C.border,paddingHorizontal:12,alignItems:'center',justifyContent:'center',backgroundColor:C.black},
 chipActive:{backgroundColor:C.white,borderColor:C.white},chipText:{color:C.mutedStrong,fontFamily:F.bold,fontSize:11},chipTextActive:{color:C.black},
 filterStrip:{gap:7,paddingHorizontal:L.mobileGutter,paddingVertical:11},
 nav:{height:68,backgroundColor:'#090B09',borderTopWidth:1,borderTopColor:C.borderStrong,flexDirection:'row',paddingHorizontal:6},
 navItem:{flex:1,alignItems:'center',justifyContent:'center',gap:3,position:'relative'},navIconWrap:{width:30,height:30,borderRadius:2,alignItems:'center',justifyContent:'center'},navIconWrapActive:{backgroundColor:'#0F150B',borderWidth:1,borderColor:'#526F2B'},navText:{color:C.mutedStrong,fontFamily:F.semiBold,fontSize:8,letterSpacing:.2},navActive:{color:C.lime,fontFamily:F.extraBold},navIndicator:{position:'absolute',top:0,width:18,height:2,backgroundColor:C.lime},
 divider:{height:1,backgroundColor:C.border},
 badge:{alignSelf:'flex-start',borderRadius:R.xs,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:7,paddingVertical:4},
 badgeLime:{borderColor:'#526F2B',backgroundColor:'#11170D'},badgeText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.6},badgeTextLime:{color:C.lime}
});
