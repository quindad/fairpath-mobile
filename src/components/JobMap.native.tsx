import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { Job } from '@/core/opportunities/opportunity-service';

export function JobMap({jobs,onOpenJob}:{jobs:Job[];onOpenJob:(job:Job)=>void}){
 const mapped=jobs.filter(j=>j.latitude!=null&&j.longitude!=null);
 const first=mapped[0];
 if(!first)return <View style={s.empty}><Text style={s.emptyTitle}>No mappable jobs yet.</Text><Text style={s.emptyBody}>Remote jobs and listings without a usable location stay in List view.</Text></View>;
 return <View style={s.wrap}>
  <MapView
   style={StyleSheet.absoluteFill}
   initialRegion={{latitude:first.latitude!,longitude:first.longitude!,latitudeDelta:.18,longitudeDelta:.18}}
  >
   {mapped.map(j=><Marker
    key={j.id}
    coordinate={{latitude:j.latitude!,longitude:j.longitude!}}
    title={j.title}
    description={j.company_name}
    pinColor={C.lime}
    onCalloutPress={()=>onOpenJob(j)}
   />)}
  </MapView>
  <View style={s.note}><Text style={s.noteText}>Pins use the best location FairPath has. City-level pins are approximate.</Text></View>
 </View>;
}

const s=StyleSheet.create({
 wrap:{height:430,borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,overflow:'hidden',backgroundColor:C.card},
 note:{position:'absolute',left:10,right:10,bottom:10,backgroundColor:'rgba(9,11,9,.92)',borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,paddingVertical:8},
 noteText:{color:C.mutedStrong,fontFamily:F.medium,fontSize:9,lineHeight:13},
 empty:{minHeight:220,alignItems:'center',justifyContent:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,paddingHorizontal:24},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:17},
 emptyBody:{color:C.muted,fontFamily:F.regular,fontSize:10,lineHeight:15,textAlign:'center',marginTop:6}
});