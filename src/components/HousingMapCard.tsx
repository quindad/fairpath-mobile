import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { HousingCard } from '@/core/housing/housing-service';

/** Selected-pin preview shared by every HousingMap implementation (native, web, fallback). */
export function HousingMapCard({home,onOpen,onClose}:{home:HousingCard;onOpen:(home:HousingCard)=>void;onClose:()=>void}){
 const facts=[home.bedrooms!=null?(Number(home.bedrooms)===0?'Studio':home.bedrooms+' bd'):null,home.bathrooms!=null?home.bathrooms+' ba':null,home.square_feet?home.square_feet.toLocaleString()+' sq ft':null].filter(Boolean).join(' · ');
 const place=[home.city,home.state,home.postal_code].filter(Boolean).join(', ');
 return <View style={s.card} testID="housing-map-card">
  <View style={s.top}>
   <View style={s.copy}>
    <Text style={s.price}>{'$'+Number(home.rent_monthly).toLocaleString()}<Text style={s.per}> / month</Text></Text>
    <Text style={s.title} numberOfLines={2}>{home.title}</Text>
   </View>
   <Pressable accessibilityRole="button" accessibilityLabel="Close home preview" hitSlop={10} style={s.close} onPress={onClose}><Lucide name="x" color={C.mutedStrong} size={15}/></Pressable>
  </View>
  {facts?<Text style={s.meta}>{facts}</Text>:null}
  <Text style={s.meta} numberOfLines={1}>{place}{home.distance_miles!=null?' · '+(home.distance_miles<10?home.distance_miles.toFixed(1):Math.round(home.distance_miles))+' mi':''}{home.fasttrack_enabled?' · FastTrack':''}</Text>
  <Pressable accessibilityRole="button" style={s.open} onPress={()=>onOpen(home)}>
   <Text style={s.openText}>OPEN HOME DETAILS</Text><Lucide name="arrow-right" color={C.black} size={14}/>
  </Pressable>
 </View>;
}

const s=StyleSheet.create({
 card:{position:'absolute',left:10,right:10,bottom:10,backgroundColor:'rgba(9,11,9,.97)',borderWidth:1,borderColor:'#526F2B',padding:12},
 top:{flexDirection:'row',alignItems:'flex-start',gap:10},copy:{flex:1,minWidth:0},
 price:{color:C.white,fontFamily:F.black,fontSize:20},per:{color:C.muted,fontFamily:F.regular,fontSize:11},
 title:{color:C.mutedStrong,fontFamily:F.bold,fontSize:12,marginTop:2},
 close:{width:28,height:28,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:C.borderStrong},
 meta:{color:C.muted,fontSize:11,marginTop:6},
 open:{height:40,marginTop:11,backgroundColor:C.lime,paddingHorizontal:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},openText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9}
});
