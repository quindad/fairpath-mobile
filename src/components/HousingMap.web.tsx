import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { HousingCard } from '@/core/housing/housing-service';
import { HousingMapCard } from '@/components/HousingMapCard';

function safeJson(value:unknown){
 return JSON.stringify(value).replace(/</g,'\\u003c');
}

/** Web map (Leaflet in an iframe). Pin clicks are posted to the page so the same preview card as native is used. */
export function HousingMap({homes,onOpen}:{homes:HousingCard[];onOpen:(home:HousingCard)=>void}){
 const located=useMemo(()=>homes.filter(h=>h.latitude!=null&&h.longitude!=null),[homes]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const selected=located.find(h=>h.id===selectedId)??null;
 const key=located.map(h=>h.id).join(',');

 useEffect(()=>{
  const onMessage=(e:MessageEvent)=>{
   const d=e.data as {fpSelectHome?:string;fpClear?:boolean}|null;
   if(d&&typeof d.fpSelectHome==='string')setSelectedId(d.fpSelectHome);
   if(d&&d.fpClear)setSelectedId(null);
  };
  window.addEventListener('message',onMessage);
  return()=>window.removeEventListener('message',onMessage);
 },[]);

 const html=useMemo(()=>{
  const points=located.map(h=>({id:h.id,lat:Number(h.latitude),lng:Number(h.longitude)}));
  if(!points.length)return '';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#090b09}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const homes=${safeJson(points)};const map=L.map('map',{zoomControl:true});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);homes.forEach(h=>{const icon=L.divIcon({className:'',html:'<div style="width:22px;height:22px;background:#a8f32c;border:3px solid #090b09;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,.45)"></div>',iconSize:[22,22],iconAnchor:[11,11]});L.marker([h.lat,h.lng],{icon}).addTo(map).on('click',()=>parent.postMessage({fpSelectHome:h.id},'*'))});map.on('click',()=>parent.postMessage({fpClear:true},'*'));if(homes.length===1){map.setView([homes[0].lat,homes[0].lng],13)}else{map.fitBounds(L.latLngBounds(homes.map(h=>[h.lat,h.lng])),{padding:[40,40]})}</script></body></html>`;
 },[key]); // eslint-disable-line react-hooks/exhaustive-deps

 if(!located.length)return <View style={s.empty}><Text style={s.emptyTitle}>No mappable homes yet.</Text><Text style={s.emptyBody}>Listings without map coordinates stay in List view.</Text></View>;
 const iframe=React.createElement('iframe' as any,{srcDoc:html,title:'FairPath housing map',key,style:{width:'100%',height:'100%',border:'0',display:'block'}});
 return <View style={s.wrap}>
  {iframe}
  {selected?<HousingMapCard home={selected} onOpen={onOpen} onClose={()=>setSelectedId(null)}/>
   :<View style={s.note}><Text style={s.noteText}>Tap a pin to preview the home. Map by OpenStreetMap.</Text></View>}
 </View>;
}

const s=StyleSheet.create({
 wrap:{flex:1,minHeight:260,borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,overflow:'hidden',backgroundColor:C.card,position:'relative'},
 note:{position:'absolute',left:10,right:10,bottom:10,backgroundColor:'rgba(9,11,9,.94)',borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,paddingVertical:8},
 noteText:{color:C.mutedStrong,fontFamily:F.medium,fontSize:9,lineHeight:13},
 empty:{flex:1,minHeight:220,alignItems:'center',justifyContent:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,paddingHorizontal:24},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:17},
 emptyBody:{color:C.muted,fontFamily:F.regular,fontSize:10,lineHeight:15,textAlign:'center',marginTop:6}
});
