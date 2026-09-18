import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader, BottomNav } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';

const rows=[['Jobs','Search all jobs, FairPath matches and verified second-chance opportunities.','/find-jobs'],['Housing','Search rentals, FastTrack listings, 3D tours and compatible housing.','/find-housing'],['Resources','Find benefits, rights information, documents and reentry support.','/resources']] as const;
export default function Find(){
 return <ScreenFrame><PageHeader eyebrow="DISCOVER" title="Find what comes next" onBack={false}/>
 <ScrollView contentContainerStyle={s.list}>{rows.map(([title,body,route],i)=><Pressable key={title} style={s.row} onPress={()=>router.push(route as never)}><View style={s.number}><Text style={s.numberText}>{String(i+1).padStart(2,'0')}</Text></View><View style={s.copy}><Text style={s.title}>{title}</Text><Text style={s.body}>{body}</Text></View><Text style={s.arrow}>→</Text></Pressable>)}</ScrollView>
 <BottomNav/></ScreenFrame>
}
const s=StyleSheet.create({list:{paddingHorizontal:L.mobileGutter,paddingTop:6,paddingBottom:20},row:{minHeight:118,borderBottomWidth:1,borderBottomColor:C.border,flexDirection:'row',alignItems:'center'},number:{width:36},numberText:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},copy:{flex:1,paddingRight:12},title:{color:C.white,fontFamily:F.black,fontSize:24,letterSpacing:-.5},body:{color:C.mutedStrong,fontSize:12,lineHeight:18,marginTop:5},arrow:{color:C.lime,fontSize:21}});
