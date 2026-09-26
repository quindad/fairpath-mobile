import { useEffect, useMemo, useRef, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { Job } from '@/core/opportunities/opportunity-service';
import { JobMapCard, type MapJob } from '@/components/JobMapCard';

type Props={jobs:MapJob[];onOpenJob?:(job:Job)=>void;compact?:boolean;fill?:boolean};

/**
 * compact: small static preview (job detail). fill: fills its parent (Find Jobs map mode).
 * Pins are selectable; the selected pin shows a card with an OPEN JOB DETAILS action.
 */
export function JobMap({jobs,onOpenJob,compact=false,fill=false}:Props){
 const mapped=useMemo(()=>jobs.filter(j=>j.latitude!=null&&j.longitude!=null),[jobs]);
 const ref=useRef<MapView>(null);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const selected=mapped.find(j=>j.id===selectedId)??null;
 const key=mapped.map(j=>j.id).join(',');

 useEffect(()=>{
  if(compact||!mapped.length)return;
  const t=setTimeout(()=>{
   ref.current?.fitToCoordinates(mapped.map(j=>({latitude:j.latitude!,longitude:j.longitude!})),{edgePadding:{top:60,right:50,bottom:170,left:50},animated:false});
  },150);
  return()=>clearTimeout(t);
 },[key,compact]); // eslint-disable-line react-hooks/exhaustive-deps

 useEffect(()=>{if(selectedId&&!mapped.some(j=>j.id===selectedId))setSelectedId(null)},[key]); // eslint-disable-line react-hooks/exhaustive-deps

 const first=mapped[0];
 if(!first)return <View style={[s.empty,fill&&s.emptyFill]}><Text style={s.emptyTitle}>No mappable jobs yet.</Text><Text style={s.emptyBody}>Remote jobs and listings without a usable location stay in List view.</Text></View>;
 return <View style={[s.wrap,compact&&s.wrapCompact,fill&&s.wrapFill]}>
  <MapView
   ref={ref}
   style={StyleSheet.absoluteFill}
   scrollEnabled={!compact}
   zoomEnabled={!compact}
   rotateEnabled={false}
   pitchEnabled={false}
   onPress={()=>setSelectedId(null)}
   initialRegion={{latitude:first.latitude!,longitude:first.longitude!,latitudeDelta:compact?.08:.3,longitudeDelta:compact?.08:.3}}
  >
   {mapped.map(j=><Marker
    key={j.id}
    coordinate={{latitude:j.latitude!,longitude:j.longitude!}}
    pinColor={j.id===selectedId?C.white:C.lime}
    onPress={e=>{e.stopPropagation?.();setSelectedId(j.id)}}
   />)}
  </MapView>
  {!compact&&selected?<JobMapCard job={selected} onOpen={onOpenJob} onClose={()=>setSelectedId(null)}/>:null}
  {!selected||compact?<View style={s.note}><Text style={s.noteText}>{compact?'Approximate work area · exact location may be shared by the employer':'Tap a pin to preview the job. City-level pins are approximate.'}</Text></View>:null}
 </View>;
}

const s=StyleSheet.create({
 wrap:{height:430,borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,overflow:'hidden',backgroundColor:C.card},
 wrapCompact:{height:220},wrapFill:{height:undefined,flex:1,minHeight:260},
 note:{position:'absolute',left:10,right:10,bottom:10,backgroundColor:'rgba(9,11,9,.92)',borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,paddingVertical:8},
 noteText:{color:C.mutedStrong,fontFamily:F.medium,fontSize:9,lineHeight:13},
 empty:{minHeight:220,alignItems:'center',justifyContent:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,paddingHorizontal:24},emptyFill:{flex:1},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:17},
 emptyBody:{color:C.muted,fontFamily:F.regular,fontSize:10,lineHeight:15,textAlign:'center',marginTop:6}
});
