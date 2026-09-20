import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { MarketplaceItem, loadSavedMarketplaceItems, unsaveMarketplaceItem } from '@/core/marketplace/marketplace-service';

export default function SavedMarketplace(){
 const [rows,setRows]=useState<MarketplaceItem[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const load=useCallback(()=>{setLoading(true);setError('');loadSavedMarketplaceItems().then(setRows).catch(e=>setError(e?.message==='SIGNED_OUT'?'Sign in to see saved Marketplace items.':'Saved items could not be loaded.')).finally(()=>setLoading(false))},[]);
 useFocusEffect(useCallback(()=>{load()},[load]));
 async function remove(id:string){try{await unsaveMarketplaceItem(id);setRows(v=>v.filter(x=>x.id!==id))}catch{}}
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH MARKETPLACE" title="Saved items" backTo="/marketplace"/><ScrollView contentContainerStyle={s.content}>
  {loading?<Text style={s.state}>Loading saved items…</Text>:error?<Text style={s.error}>{error}</Text>:rows.length===0?<View style={s.empty}><Lucide name="bookmark" color={C.mutedStrong} size={26}/><Text style={s.emptyTitle}>No saved items yet.</Text><Text style={s.emptyBody}>Bookmark useful Marketplace items and they will show up here.</Text><Pressable style={s.primary} onPress={()=>router.replace('/marketplace' as never)}><Text style={s.primaryText}>BROWSE MARKETPLACE</Text></Pressable></View>:rows.map(item=>{const photo=item.marketplace_media?.slice().sort((a,b)=>a.sort_order-b.sort_order)[0]?.url??'';return <Pressable key={item.id} style={s.row} onPress={()=>router.push(('/market-item/'+item.id) as never)}>
   <View style={s.media}>{photo?<Image source={{uri:photo}} style={s.photo}/>:<View style={s.noPhoto}><Lucide name="image-off" color={C.mutedStrong} size={18}/></View>}</View>
   <View style={s.copy}><Text style={s.free}>FREE</Text><Text style={s.title} numberOfLines={2}>{item.title}</Text><Text style={s.meta}>{item.pickup_area||item.city+', '+item.state}</Text><Text style={s.meta}>{item.condition||'Condition not listed'}</Text></View>
   <Pressable style={s.remove} onPress={e=>{e.stopPropagation?.();void remove(item.id)}}><Lucide name="bookmark-x" color={C.mutedStrong} size={15}/></Pressable>
  </Pressable>})}
 </ScrollView></ScreenFrame>
}
const s=StyleSheet.create({content:{paddingHorizontal:L.mobileGutter,paddingBottom:40},state:{color:C.mutedStrong,paddingVertical:24},error:{color:C.danger,paddingVertical:24},row:{minHeight:112,borderBottomWidth:1,borderBottomColor:C.borderStrong,flexDirection:'row',gap:11,alignItems:'center',paddingVertical:11},media:{width:92,height:90,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A'},photo:{width:'100%',height:'100%'},noPhoto:{flex:1,alignItems:'center',justifyContent:'center'},copy:{flex:1,minWidth:0},free:{color:C.lime,fontFamily:F.black,fontSize:13},title:{color:C.white,fontFamily:F.extraBold,fontSize:14,lineHeight:17,marginTop:3},meta:{color:C.muted,fontSize:8.5,marginTop:4},remove:{width:34,height:34,alignItems:'center',justifyContent:'center'},empty:{paddingVertical:36},emptyTitle:{color:C.white,fontFamily:F.black,fontSize:21,marginTop:12},emptyBody:{color:C.muted,fontSize:10,lineHeight:16,marginTop:5,maxWidth:310},primary:{height:46,backgroundColor:C.lime,alignItems:'center',justifyContent:'center',marginTop:18},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8}});