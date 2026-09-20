import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View } from 'react-native';
import type { HousingListing } from '@/core/opportunities/opportunity-service';

export function HousingMap({homes,onOpen}:{homes:HousingListing[];onOpen:(home:HousingListing)=>void}){
 const located=homes.filter(h=>h.latitude!=null&&h.longitude!=null);
 if(!located.length)return <View style={s.empty}/>;
 const first=located[0];
 return <MapView style={s.map} initialRegion={{latitude:Number(first.latitude),longitude:Number(first.longitude),latitudeDelta:.12,longitudeDelta:.12}}>
  {located.map(h=><Marker key={h.id} coordinate={{latitude:Number(h.latitude),longitude:Number(h.longitude)}} title={h.title} description={'$'+Number(h.rent_monthly).toLocaleString()+'/mo'} onCalloutPress={()=>onOpen(h)}/>)}
 </MapView>
}
const s=StyleSheet.create({map:{height:360,marginHorizontal:18,marginTop:8},empty:{height:0}});