import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { Job } from '@/core/opportunities/opportunity-service';

export function JobMap({jobs,onOpenJob,compact=false}:{jobs:Job[];onOpenJob?:(job:Job)=>void;compact?:boolean}){
 const located=jobs.filter(j=>j.latitude!=null&&j.longitude!=null);
 return <View style={[s.wrap,compact&&s.compact]}>
  <View style={s.head}><Text style={s.label}>LOCATION VIEW</Text><Text style={s.count}>{located.length} LOCATED</Text></View>
  {located.length===0?<Text style={s.empty}>Exact or approximate map coordinates are not available for these jobs.</Text>:located.slice(0,compact?1:12).map(j=><Pressable key={j.id} disabled={!onOpenJob} style={s.row} onPress={()=>onOpenJob?.(j)}>
   <View style={s.pin}/><View style={s.copy}><Text style={s.title}>{j.title}</Text><Text style={s.meta}>{j.location_text||[j.city,j.state].filter(Boolean).join(', ')||'Location'}</Text></View>{onOpenJob?<Text style={s.open}>OPEN →</Text>:null}
  </Pressable>)}
  <Text style={s.note}>Interactive geographic map rendering is being kept separate from location data so approximate coordinates are not presented as exact addresses.</Text>
 </View>
}
const s=StyleSheet.create({wrap:{borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',padding:12,minHeight:140},compact:{minHeight:100},head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:8,borderBottomWidth:1,borderBottomColor:C.border},label:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},count:{color:C.muted,fontFamily:F.extraBold,fontSize:6.5,letterSpacing:.7},row:{minHeight:48,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:C.border},pin:{width:9,height:9,borderRadius:5,backgroundColor:C.lime},copy:{flex:1},title:{color:C.white,fontFamily:F.extraBold,fontSize:10},meta:{color:C.muted,fontSize:8,marginTop:2},open:{color:C.lime,fontFamily:F.extraBold,fontSize:7},empty:{color:C.mutedStrong,fontSize:10,lineHeight:15,paddingVertical:16},note:{color:C.muted,fontSize:7.5,lineHeight:12,marginTop:9}});
