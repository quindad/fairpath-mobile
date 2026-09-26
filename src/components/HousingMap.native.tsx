import { useEffect, useMemo, useRef, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { HousingCard } from '@/core/housing/housing-service';
import { HousingMapCard } from '@/components/HousingMapCard';

/** Fills its parent. Pins are selectable; the selected pin shows a preview with an OPEN HOME DETAILS action. */
export function HousingMap({homes,onOpen}:{homes:HousingCard[];onOpen:(home:HousingCard)=>void}){
 const located=useMemo(()=>homes.filter(h=>h.latitude!=null&&h.longitude!=null),[homes]);
 const ref=useRef<MapView>(null);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const selected=located.find(h=>h.id===selectedId)??null;
 const key=located.map(h=>h.id).join(',');

 useEffect(()=>{
  if(!located.length)return;
  const t=setTimeout(()=>{
   ref.current?.fitToCoordinates(located.map(h=>({latitude:Number(h.latitude),longitude:Number(h.longitude)})),{edgePadding:{top:60,right:50,bottom:190,left:50},animated:false});
  },150);
  return()=>clearTimeout(t);
 },[key]); // eslint-disable-line react-hooks/exhaustive-deps

 useEffect(()=>{if(selectedId&&!located.some(h=>h.id===selectedId))setSelectedId(null)},[key]); // eslint-disable-line react-hooks/exhaustive-deps

 const first=located[0];
 if(!first)return <View style={s.empty}><Text style={s.emptyTitle}>No mappable homes yet.</Text><Text style={s.emptyBody}>Listings without map coordinates stay in List view.</Text></View>;
 return <View style={s.wrap}>
  <MapView
   ref={ref}
   style={StyleSheet.absoluteFill}
   rotateEnabled={false}
   pitchEnabled={false}
   onPress={()=>setSelectedId(null)}
   initialRegion={{latitude:Number(first.latitude),longitude:Number(first.longitude),latitudeDelta:.3,longitudeDelta:.3}}
  >
   {located.map(h=><Marker
    key={h.id}
    coordinate={{latitude:Number(h.latitude),longitude:Number(h.longitude)}}
    pinColor={h.id===selectedId?C.white:C.lime}
    onPress={e=>{e.stopPropagation?.();setSelectedId(h.id)}}
   />)}
  </MapView>
  {selected?<HousingMapCard home={selected} onOpen={onOpen} onClose={()=>setSelectedId(null)}/>
   :<View style={s.note}><Text style={s.noteText}>Tap a pin to preview the home. Pins use the best location FairPath has.</Text></View>}
 </View>;
}

const s=StyleSheet.create({
 wrap:{flex:1,minHeight:260,borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,overflow:'hidden',backgroundColor:C.card},
 note:{position:'absolute',left:10,right:10,bottom:10,backgroundColor:'rgba(9,11,9,.92)',borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,paddingVertical:8},
 noteText:{color:C.mutedStrong,fontFamily:F.medium,fontSize:9,lineHeight:13},
 empty:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,paddingHorizontal:24},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:17},
 emptyBody:{color:C.muted,fontFamily:F.regular,fontSize:10,lineHeight:15,textAlign:'center',marginTop:6}
});
