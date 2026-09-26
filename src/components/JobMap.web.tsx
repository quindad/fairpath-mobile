import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { Job } from '@/core/opportunities/opportunity-service';
import { JobMapCard, type MapJob } from '@/components/JobMapCard';

function safeJson(value:unknown){
 return JSON.stringify(value).replace(/</g,'\\u003c');
}

type Props={jobs:MapJob[];onOpenJob?:(job:Job)=>void;compact?:boolean;fill?:boolean};

/** Web map (Leaflet in an iframe). Pin clicks are posted to the page so the same selection card as native is used. */
export function JobMap({jobs,onOpenJob,compact=false,fill=false}:Props){
 const mapped=useMemo(()=>jobs.filter(j=>j.latitude!=null&&j.longitude!=null),[jobs]);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const selected=mapped.find(j=>j.id===selectedId)??null;
 const key=mapped.map(j=>j.id).join(',');

 useEffect(()=>{
  const onMessage=(e:MessageEvent)=>{
   const d=e.data as {fpSelectJob?:string}|null;
   if(d&&typeof d.fpSelectJob==='string')setSelectedId(d.fpSelectJob);
   if(d&&(d as {fpClear?:boolean}).fpClear)setSelectedId(null);
  };
  window.addEventListener('message',onMessage);
  return()=>window.removeEventListener('message',onMessage);
 },[]);

 const html=useMemo(()=>{
  const points=mapped.map(j=>({id:j.id,lat:j.latitude,lng:j.longitude}));
  if(!points.length)return '';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#090b09}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const jobs=${safeJson(points)};const map=L.map('map',{zoomControl:true,scrollWheelZoom:${compact?'false':'true'}});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);const markers=[];jobs.forEach(j=>{const icon=L.divIcon({className:'',html:'<div style="width:22px;height:22px;background:#a8f32c;border:3px solid #090b09;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,.45)"></div>',iconSize:[22,22],iconAnchor:[11,11]});const m=L.marker([j.lat,j.lng],{icon}).addTo(map);m.on('click',()=>parent.postMessage({fpSelectJob:j.id},'*'));markers.push(m)});map.on('click',()=>parent.postMessage({fpClear:true},'*'));if(jobs.length===1){map.setView([jobs[0].lat,jobs[0].lng],12)}else{map.fitBounds(L.latLngBounds(jobs.map(j=>[j.lat,j.lng])),{padding:[40,40]})}</script></body></html>`;
 },[key]); // eslint-disable-line react-hooks/exhaustive-deps

 if(!mapped.length)return <View style={[s.empty,fill&&s.emptyFill]}><Text style={s.emptyTitle}>No mappable jobs yet.</Text><Text style={s.emptyBody}>Remote jobs and listings without a usable location stay in List view.</Text></View>;
 const iframe=React.createElement('iframe' as any,{srcDoc:html,title:'FairPath Jobs Map',key,style:{width:'100%',height:'100%',border:'0',display:'block'}});
 return <View style={[s.wrap,compact&&s.wrapCompact,fill&&s.wrapFill]}>
  {iframe}
  {!compact&&selected?<JobMapCard job={selected} onOpen={onOpenJob} onClose={()=>setSelectedId(null)}/>:null}
  {!selected||compact?<View style={s.note}><Text style={s.noteText}>{compact?'Approximate work area · exact location may be shared by the employer':'Tap a pin to preview the job. City-level pins are approximate.'}</Text></View>:null}
 </View>;
}

const s=StyleSheet.create({
 wrap:{height:430,borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,overflow:'hidden',backgroundColor:C.card,position:'relative'},
 wrapCompact:{height:220},wrapFill:{height:undefined,flex:1,minHeight:260},
 note:{position:'absolute',left:10,right:10,bottom:10,backgroundColor:'rgba(9,11,9,.94)',borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,paddingVertical:8},
 noteText:{color:C.mutedStrong,fontFamily:F.medium,fontSize:9,lineHeight:13},
 empty:{minHeight:220,alignItems:'center',justifyContent:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,paddingHorizontal:24},emptyFill:{flex:1},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:17},
 emptyBody:{color:C.muted,fontFamily:F.regular,fontSize:10,lineHeight:15,textAlign:'center',marginTop:6}
});
