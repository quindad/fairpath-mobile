import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { HousingListing } from '@/core/opportunities/opportunity-service';

export function HousingMap({homes,onOpen}:{homes:HousingListing[];onOpen:(home:HousingListing)=>void}){
 const located=homes.filter(h=>h.latitude!=null&&h.longitude!=null);
 return <View style={s.wrap}>
  <View style={s.head}><Text style={s.label}>MAP VIEW</Text><Text style={s.count}>{located.length} LOCATED</Text></View>
  {located.length===0?<Text style={s.empty}>Map coordinates are not available for the homes in this result set.</Text>:located.slice(0,20).map(h=><Pressable key={h.id} style={s.row} onPress={()=>onOpen(h)}><View style={s.pin}/><View style={s.copy}><Text style={s.title}>{h.title}</Text><Text style={s.meta}>{[h.city,h.state].filter(Boolean).join(', ')} · {'$'+Number(h.rent_monthly).toLocaleString()+'/mo'}</Text></View><Text style={s.open}>OPEN →</Text></Pressable>)}
  <Text style={s.note}>On web this is a coordinate-backed area list. Native builds use the interactive map.</Text>
 </View>
}
const s=StyleSheet.create({wrap:{borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',padding:12,marginHorizontal:18,marginTop:8},head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:8,borderBottomWidth:1,borderBottomColor:C.border},label:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},count:{color:C.muted,fontFamily:F.extraBold,fontSize:7},row:{minHeight:52,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:C.border},pin:{width:10,height:10,borderRadius:5,backgroundColor:C.lime},copy:{flex:1},title:{color:C.white,fontFamily:F.extraBold,fontSize:10},meta:{color:C.mutedStrong,fontSize:8,marginTop:3},open:{color:C.lime,fontFamily:F.extraBold,fontSize:7},empty:{color:C.mutedStrong,fontSize:10,lineHeight:15,paddingVertical:18},note:{color:C.muted,fontSize:7.5,lineHeight:12,marginTop:9}});