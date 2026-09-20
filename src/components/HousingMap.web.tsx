import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import type { HousingListing } from '@/core/opportunities/opportunity-service';

export function HousingMap({homes,onOpen}:{homes:HousingListing[];onOpen:(home:HousingListing)=>void}){
 const located=homes.filter(h=>h.latitude!=null&&h.longitude!=null);
 if(!located.length)return <View style={s.wrap}><Text style={s.empty}>No map coordinates are available for these results yet.</Text></View>;
 const lats=located.map(h=>Number(h.latitude)),lngs=located.map(h=>Number(h.longitude));
 const minLat=Math.min(...lats),maxLat=Math.max(...lats),minLng=Math.min(...lngs),maxLng=Math.max(...lngs);
 const latPad=Math.max(.03,(maxLat-minLat)*.18),lngPad=Math.max(.03,(maxLng-minLng)*.18);
 const first=located[0];
 const src='https://www.openstreetmap.org/export/embed.html?bbox='+encodeURIComponent([minLng-lngPad,minLat-latPad,maxLng+lngPad,maxLat+latPad].join(','))+'&layer=mapnik&marker='+encodeURIComponent(Number(first.latitude)+','+Number(first.longitude));
 return <View style={s.wrap}>
  <View style={s.head}><Text style={s.label}>MAP VIEW</Text><Text style={s.count}>{located.length} HOMES MAPPED</Text></View>
  <View style={s.map}>{React.createElement('iframe' as any,{src,title:'FairPath housing map',style:{width:'100%',height:'100%',border:0},loading:'lazy'})}</View>
  <Text style={s.note}>Map by OpenStreetMap. Select a home below to open its FairPath listing.</Text>
  {located.slice(0,12).map(h=><Pressable key={h.id} style={s.row} onPress={()=>onOpen(h)}><View style={s.pin}/><View style={s.copy}><Text style={s.title}>{h.title}</Text><Text style={s.meta}>{[h.city,h.state].filter(Boolean).join(', ')} · {'$'+Number(h.rent_monthly).toLocaleString()+'/mo'}</Text></View><Text style={s.open}>OPEN →</Text></Pressable>)}
 </View>
}
const s=StyleSheet.create({wrap:{borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',padding:12,marginTop:8},head:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:8},label:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},count:{color:C.muted,fontFamily:F.extraBold,fontSize:7},map:{height:360,borderWidth:1,borderColor:C.borderStrong,overflow:'hidden'},row:{minHeight:52,flexDirection:'row',alignItems:'center',gap:9,borderBottomWidth:1,borderBottomColor:C.border},pin:{width:10,height:10,borderRadius:5,backgroundColor:C.lime},copy:{flex:1},title:{color:C.white,fontFamily:F.extraBold,fontSize:10},meta:{color:C.mutedStrong,fontSize:8,marginTop:3},open:{color:C.lime,fontFamily:F.extraBold,fontSize:7},empty:{color:C.mutedStrong,fontSize:10,lineHeight:15,paddingVertical:18},note:{color:C.muted,fontSize:7.5,lineHeight:12,marginVertical:9}});
