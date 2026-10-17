import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';

/** Universal discovery: eligibility-specific support is opt-in inside each search, never a separate user identity. */
export const DISCOVERY_AUDIENCE_MESSAGE='Opportunities for everyone. Choose the filters that fit your needs.';
const rows=[['Jobs','Explore jobs for everyone. Use veteran-friendly and second-chance filters when useful.','/find-jobs'],['Housing','Explore rentals for everyone. Filter for felony-friendly and veteran-friendly listings.','/find-housing'],['Resources','Find benefits, rights information, documents and support for your next step.','/resources']] as const;
export default function Find(){
 return <ScreenFrame><PageHeader eyebrow="DISCOVER" title="Find what comes next" onBack={false}/>
 <ScrollView contentContainerStyle={s.list}><Text style={s.audience}>{DISCOVERY_AUDIENCE_MESSAGE}</Text>{rows.map(([title,body,route],i)=><Pressable accessibilityRole="button" key={title} style={s.row} onPress={()=>router.push(route as never)}><View style={s.number}><Text style={s.numberText}>{String(i+1).padStart(2,'0')}</Text></View><View style={s.copy}><Text style={s.title}>{title}</Text><Text style={s.body}>{body}</Text></View><Text style={s.arrow}>→</Text></Pressable>)}</ScrollView>
 </ScreenFrame>
}
const s=StyleSheet.create({audience:{color:C.mutedStrong,fontSize:13,lineHeight:19,paddingBottom:18},list:{paddingHorizontal:L.mobileGutter,paddingTop:6,paddingBottom:20},row:{minHeight:118,borderBottomWidth:1,borderBottomColor:C.border,flexDirection:'row',alignItems:'center'},number:{width:36},numberText:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},copy:{flex:1,paddingRight:12},title:{color:C.white,fontFamily:F.black,fontSize:24,letterSpacing:-.5},body:{color:C.mutedStrong,fontSize:12,lineHeight:18,marginTop:5},arrow:{color:C.lime,fontSize:21}});
