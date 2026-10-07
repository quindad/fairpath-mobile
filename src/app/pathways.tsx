import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { FormScrollView } from '@/components/FormScrollView';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { PATHWAYS, type PathwayId } from '@/core/pathways/pathway-registry';

const COPY: Record<PathwayId,{headline:string;body:string;action:string;route:string}> = {
 reentry:{headline:'Move forward without becoming a label.',body:'Fair-chance work, reentry resources, record-relief tools and practical next steps. Record information stays private unless you deliberately use an authorized workflow.',action:'OPEN REENTRY TOOLS',route:'/resources'},
 veterans:{headline:'Turn service into the next mission.',body:'Translate military experience, organize transition goals and connect skills to civilian work without automatically disclosing veteran identity.',action:'OPEN VETERAN PATH',route:'/veterans'},
 housing_stability:{headline:'Find a place. Keep a place.',body:'Search housing and bring stability resources forward when the problem is bigger than finding a listing.',action:'OPEN HOUSING',route:'/find-housing'},
 food:{headline:'Help for what you need today.',body:'Find food, essentials and nearby resources without mixing urgent needs into your employment profile.',action:'FIND RESOURCES',route:'/resources'},
 giving:{headline:'Good is an action.',body:'Marketplace and community-support tools connect useful goods and help to real needs without turning private hardship into a public profile.',action:'OPEN MARKETPLACE',route:'/marketplace'},
 safety_recovery:{headline:'Private help when safety comes first.',body:'Reach safety and recovery resources without exposing this pathway to employers, housing providers or donors.',action:'OPEN SAFETY',route:'/safety'},
};
const statusLabel=(s:string)=>s==='live'?'LIVE':s==='in_development'?'IN DEVELOPMENT':'BUILDING NEXT';

export default function PathwaysScreen(){
 return <ScreenFrame><PageHeader eyebrow="YOUR FAIRPATH" title="Choose your path" backTo="/home" alwaysBackTo/>
  <FormScrollView contentContainerStyle={s.content}>
   <Text style={s.lede}>One FairPath. Different needs. Turn toward the part of life you need to move forward — your pathway does not become a public label.</Text>
   <View style={s.rule}/>
   {PATHWAYS.map((p,i)=>{const x=COPY[p.id];return <Pressable key={p.id} style={s.card} onPress={()=>router.push(x.route as never)} accessibilityRole="link">
    <View style={s.cardTop}><Text style={s.num}>{String(i+1).padStart(2,'0')}</Text><Text style={[s.status,p.status==='live'&&s.statusLive]}>{statusLabel(p.status)}</Text></View>
    <Text style={s.name}>{p.name}</Text><Text style={s.headline}>{x.headline}</Text><Text style={s.body}>{x.body}</Text>
    <View style={s.actionRow}><Text style={s.action}>{x.action}</Text><Text style={s.arrow}>→</Text></View>
   </Pressable>})}
   <View style={s.cross}><Text style={s.crossLabel}>WORKS ACROSS EVERY PATH</Text><Text style={s.crossTitle}>Academy + Entrepreneurship</Text><Text style={s.body}>Learning and business-building are systems you can use across pathways. They are not separate identities you have to join.</Text><View style={s.crossActions}><Pressable onPress={()=>router.push('/academy' as never)}><Text style={s.action}>ACADEMY →</Text></Pressable><Pressable onPress={()=>router.push('/entrepreneurship' as never)}><Text style={s.action}>ENTREPRENEURSHIP →</Text></Pressable></View></View>
  </FormScrollView>
 </ScreenFrame>
}
const s={content:{paddingHorizontal:L.mobileGutter,paddingBottom:48},lede:{color:C.mutedStrong,fontFamily:F.medium,fontSize:14,lineHeight:22,maxWidth:560},rule:{height:1,backgroundColor:C.borderStrong,marginTop:22},card:{paddingVertical:22,borderBottomWidth:1,borderBottomColor:C.borderStrong},cardTop:{flexDirection:'row' as const,justifyContent:'space-between' as const,alignItems:'center' as const},num:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.2},status:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:8,paddingVertical:5},statusLive:{color:C.lime,borderColor:'#526F2B'},name:{color:C.lime,fontFamily:F.extraBold,fontSize:10,letterSpacing:1.3,marginTop:17,textTransform:'uppercase' as const},headline:{color:C.white,fontFamily:F.black,fontSize:25,lineHeight:28,letterSpacing:-.7,marginTop:7,maxWidth:520},body:{color:C.mutedStrong,fontFamily:F.regular,fontSize:12,lineHeight:19,marginTop:9,maxWidth:560},actionRow:{flexDirection:'row' as const,justifyContent:'space-between' as const,alignItems:'center' as const,marginTop:16},action:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},arrow:{color:C.lime,fontSize:18},cross:{marginTop:28,borderLeftWidth:3,borderLeftColor:C.lime,backgroundColor:'#10150C',padding:18},crossLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2},crossTitle:{color:C.white,fontFamily:F.black,fontSize:21,marginTop:7},crossActions:{flexDirection:'row' as const,gap:22,marginTop:18,flexWrap:'wrap' as const}};
