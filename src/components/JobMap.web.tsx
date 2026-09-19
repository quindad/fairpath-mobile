import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { Job } from '@/core/opportunities/opportunity-service';

function safeJson(value:unknown){
 return JSON.stringify(value).replace(/</g,'\\u003c');
}

export function JobMap({jobs}:{jobs:Job[];onOpenJob:(job:Job)=>void}){
 const mapped=jobs.filter(j=>j.latitude!=null&&j.longitude!=null);
 if(!mapped.length)return <View style={s.empty}><Text style={s.emptyTitle}>No mappable jobs yet.</Text><Text style={s.emptyBody}>Remote jobs and listings without a usable location stay in List view.</Text></View>;
 const points=mapped.map(j=>({id:j.id,title:j.title,company:j.company_name,lat:j.latitude,lng:j.longitude,precision:j.location_precision}));
 const center=points[0];
 const html=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#090b09}.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#0b0d0b;color:#fff}.fp-title{font:700 14px Arial;margin-bottom:3px}.fp-company{font:12px Arial;color:#a5aaa5}.fp-link{display:inline-block;margin-top:8px;color:#a8f32c;font:700 11px Arial;text-decoration:none}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const jobs=${safeJson(points)};const map=L.map('map',{zoomControl:true}).setView([${center.lat},${center.lng}],11);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(map);jobs.forEach(j=>{const icon=L.divIcon({className:'',html:'<div style="width:20px;height:20px;background:#a8f32c;border:3px solid #090b09;border-radius:50%;box-shadow:0 1px 6px rgba(0,0,0,.45)"></div>',iconSize:[20,20],iconAnchor:[10,10]});L.marker([j.lat,j.lng],{icon}).addTo(map).bindPopup('<div class="fp-title">'+j.title+'</div><div class="fp-company">'+j.company+'</div><a class="fp-link" target="_parent" href="/job/'+j.id+'">VIEW JOB →</a>')});</script></body></html>`;
 const iframe=React.createElement('iframe' as any,{srcDoc:html,title:'FairPath Jobs Map',style:{width:'100%',height:'430px',border:'0',display:'block'}});
 return <View style={s.wrap}>{iframe}<View style={s.note}><Text style={s.noteText}>Pins use the best location FairPath has. City-level pins are approximate.</Text></View></View>;
}

const s=StyleSheet.create({
 wrap:{height:430,borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,overflow:'hidden',backgroundColor:C.card,position:'relative'},
 note:{position:'absolute',left:10,right:10,bottom:10,backgroundColor:'rgba(9,11,9,.94)',borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,paddingVertical:8},
 noteText:{color:C.mutedStrong,fontFamily:F.medium,fontSize:9,lineHeight:13},
 empty:{minHeight:220,alignItems:'center',justifyContent:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,paddingHorizontal:24},
 emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:17},
 emptyBody:{color:C.muted,fontFamily:F.regular,fontSize:10,lineHeight:15,textAlign:'center',marginTop:6}
});