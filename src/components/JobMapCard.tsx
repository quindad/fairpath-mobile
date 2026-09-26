import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { Job } from '@/core/opportunities/opportunity-service';

export type MapJob=Job&{distance_miles?:number|null};

/** Selected-pin summary shared by every JobMap implementation (native, web, fallback). */
export function JobMapCard({job,onOpen,onClose}:{job:MapJob;onOpen?:(job:Job)=>void;onClose?:()=>void}){
 const place=job.location_text||[job.city,job.state].filter(Boolean).join(', ')||'Location not listed';
 const pay=job.pay_min!=null?'$'+Number(job.pay_min).toLocaleString()+(job.pay_max?' – $'+Number(job.pay_max).toLocaleString():'')+' / '+(job.pay_period||'period'):null;
 return <View style={s.card} testID="job-map-card">
  <View style={s.top}>
   <View style={s.copy}>
    <Text style={s.title} numberOfLines={2}>{job.title}</Text>
    <Text style={s.company} numberOfLines={1}>{job.company_name}</Text>
   </View>
   {onClose?<Pressable accessibilityRole="button" accessibilityLabel="Close job preview" hitSlop={10} style={s.close} onPress={onClose}><Lucide name="x" color={C.mutedStrong} size={15}/></Pressable>:null}
  </View>
  <Text style={s.meta} numberOfLines={1}>{place}{job.distance_miles!=null?' · '+(job.distance_miles<10?job.distance_miles.toFixed(1):Math.round(job.distance_miles))+' mi':''}</Text>
  {pay?<Text style={s.pay}>{pay}</Text>:null}
  {onOpen?<Pressable accessibilityRole="button" style={s.open} onPress={()=>onOpen(job)}>
   <Text style={s.openText}>OPEN JOB DETAILS</Text><Lucide name="arrow-right" color={C.black} size={14}/>
  </Pressable>:null}
 </View>;
}

const s=StyleSheet.create({
 card:{position:'absolute',left:10,right:10,bottom:10,backgroundColor:'rgba(9,11,9,.97)',borderWidth:1,borderColor:'#526F2B',padding:12},
 top:{flexDirection:'row',alignItems:'flex-start',gap:10},copy:{flex:1,minWidth:0},
 title:{color:C.white,fontFamily:F.extraBold,fontSize:16,lineHeight:19},company:{color:C.mutedStrong,fontFamily:F.bold,fontSize:11,marginTop:2},
 close:{width:28,height:28,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.borderStrong},
 meta:{color:C.muted,fontSize:11,marginTop:8},pay:{color:C.white,fontFamily:F.extraBold,fontSize:13,marginTop:5},
 open:{height:40,marginTop:11,backgroundColor:C.lime,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},openText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9}
});
