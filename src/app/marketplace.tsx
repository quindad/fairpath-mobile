import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenFrame, PageHeader, FilterStrip, SharpChip } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L, FairPathRadius as R } from '@/constants/fairpath';
import { loadMarketplace, saveMarketplace, type MarketplaceItem } from '@/core/opportunities/opportunity-service';
import { demoMarketplaceImage } from '@/core/demo/demo-media';

const categories=['All','Furniture','Clothing','Electronics','Home','Kids'];
export default function Marketplace(){
 const [query,setQuery]=useState(''); const [category,setCategory]=useState('All'); const [items,setItems]=useState<MarketplaceItem[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
 async function run(nextCategory=category){setLoading(true);setError('');try{setItems(await loadMarketplace(query,nextCategory==='All'?'':nextCategory));}catch{setError('Marketplace could not load. Try again.')}finally{setLoading(false)}}
 useEffect(()=>{loadMarketplace().then(setItems).catch(()=>setError('Marketplace could not load.')).finally(()=>setLoading(false));},[]);
 const visible=useMemo(()=>items,[items]);
 function selectCategory(next:string){setCategory(next);void run(next)}
 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH MARKETPLACE" title="Marketplace"/>
  <View style={s.searchBlock}><View style={s.searchRow}><TextInput value={query} onChangeText={setQuery} onSubmitEditing={()=>run()} style={s.input} placeholder="Search free items" placeholderTextColor={C.muted}/><Pressable style={s.searchBtn} onPress={()=>run()}><Text style={s.searchBtnText}>SEARCH</Text></Pressable></View></View>
  <FilterStrip>{categories.map(x=><SharpChip key={x} label={x} active={category===x} onPress={()=>selectCategory(x)}/>)}</FilterStrip>
  <ScrollView contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
   <View style={s.resultsTop}><View><Text style={s.results}>{loading?'LOADING':String(visible.length)+' ITEMS'}</Text><Text style={s.subline}>Free local items · claim required</Text></View><Pressable style={s.sellBtn} onPress={()=>router.push('/plus' as never)}><Text style={s.sellBtnText}>LIST ITEM</Text></Pressable></View>
   {error?<Text style={s.error}>{error}</Text>:null}
   {!loading&&visible.length===0?<View style={s.empty}><Text style={s.emptyTitle}>Nothing available here yet.</Text><Text style={s.emptyBody}>Try another category or search term.</Text></View>:null}
   <View style={s.grid}>{visible.map(i=>{const photo=i.marketplace_media?.sort((a,b)=>a.sort_order-b.sort_order)[0]?.url || demoMarketplaceImage(i.category);return <Pressable key={i.id} style={s.card} onPress={()=>router.push(('/market-item/'+i.id) as never)}>
    <View style={s.media}>{photo?<Image source={{uri:photo}} style={s.photo}/>:<View style={s.noPhoto}><Text style={s.noPhotoCategory}>{i.category.toUpperCase()}</Text><Text style={s.noPhotoText}>NO PHOTO</Text></View>}<Pressable style={s.saveBtn} onPress={(e)=>{e.stopPropagation?.();void saveMarketplace(i.id)}}><Text style={s.saveText}>♡</Text></Pressable></View>
    <View style={s.body}><Text style={s.price}>{i.is_free?'FREE':'$'+Number(i.price).toLocaleString()}</Text><Text style={s.itemTitle} numberOfLines={2}>{i.title}</Text><Text style={s.location}>{i.city+', '+i.state}</Text><View style={s.metaRow}><Text style={s.condition}>{i.condition||'Condition not listed'}</Text>{i.safe_pickup?<Text style={s.safe}>SAFE PICKUP</Text>:null}</View></View>
   </Pressable>})}</View>
  </ScrollView>
 </ScreenFrame>
}
const s=StyleSheet.create({
 searchBlock:{paddingHorizontal:L.mobileGutter,paddingTop:14,paddingBottom:4},searchRow:{height:48,flexDirection:'row',borderWidth:1,borderColor:C.border,backgroundColor:C.surface},input:{flex:1,color:C.white,fontSize:14,paddingHorizontal:12},searchBtn:{paddingHorizontal:14,justifyContent:'center',borderLeftWidth:1,borderLeftColor:C.border},searchBtnText:{color:C.lime,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},
 list:{paddingHorizontal:L.mobileGutter,paddingBottom:28},resultsTop:{minHeight:54,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},results:{color:C.muted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.1},subline:{color:C.muted,fontSize:10,marginTop:3},
 sellBtn:{height:30,borderRadius:R.xs,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:9,justifyContent:'center'},sellBtnText:{color:C.white,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},
 grid:{flexDirection:'row',flexWrap:'wrap',marginHorizontal:-5},card:{width:'50%',paddingHorizontal:5,paddingBottom:16},media:{aspectRatio:1.18,backgroundColor:C.surface,borderWidth:1,borderColor:C.border,position:'relative',overflow:'hidden'},photo:{width:'100%',height:'100%'},noPhoto:{flex:1,alignItems:'center',justifyContent:'center'},noPhotoCategory:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.2},noPhotoText:{color:'#5F655F',fontSize:8,marginTop:5,letterSpacing:1},
 saveBtn:{position:'absolute',right:7,top:7,width:30,height:30,borderRadius:R.sm,backgroundColor:'#090A09DD',borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},saveText:{color:C.white,fontSize:18},
 body:{paddingTop:8},price:{color:C.lime,fontFamily:F.black,fontSize:15},itemTitle:{color:C.white,fontFamily:F.bold,fontSize:13,lineHeight:16,marginTop:3},location:{color:C.muted,fontSize:10,marginTop:5},
 metaRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:7},condition:{color:C.mutedStrong,fontSize:9},safe:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7,letterSpacing:.6},
 empty:{borderTopWidth:1,borderTopColor:C.border,paddingVertical:28},emptyTitle:{color:C.white,fontFamily:F.extraBold,fontSize:18},emptyBody:{color:C.muted,fontSize:13,lineHeight:20,marginTop:7},error:{color:C.danger,fontSize:12,paddingVertical:12}
});
