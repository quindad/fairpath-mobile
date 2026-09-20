import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, FilterStrip, SharpChip, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import {
  MARKETPLACE_CATEGORIES,
  MarketplaceItem,
  MarketplaceQuota,
  isMarketplaceItemSaved,
  loadMarketplace,
  loadMarketplaceQuota,
  loadSavedMarketplaceIds,
  saveMarketplaceItem,
  unsaveMarketplaceItem,
} from '@/core/marketplace/marketplace-service';

export default function Marketplace(){
 const [query,setQuery]=useState('');
 const [location,setLocation]=useState('');
 const [category,setCategory]=useState('');
 const [safeOnly,setSafeOnly]=useState(false);
 const [sort,setSort]=useState<'newest'|'oldest'>('newest');
 const [items,setItems]=useState<MarketplaceItem[]>([]);
 const [saved,setSaved]=useState<Record<string,boolean>>({});
 const [quota,setQuota]=useState<MarketplaceQuota|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');

 const run=useCallback(async(nextCategory=category)=>{
  setLoading(true);setError('');
  try{
   const rows=await loadMarketplace({search:query,category:nextCategory,location,safePickup:safeOnly,sort});
   setItems(rows);
   try{const ids=await loadSavedMarketplaceIds();setSaved(Object.fromEntries(ids.map(id=>[id,true])))}catch{}
   try{setQuota(await loadMarketplaceQuota())}catch{setQuota(null)}
  }catch{setError('Marketplace could not load. Check your connection and try again.')}
  finally{setLoading(false)}
 },[query,location,category,safeOnly,sort]);

 useFocusEffect(useCallback(()=>{void run()},[run]));
 const visible=useMemo(()=>items,[items]);

 async function toggleSave(item:MarketplaceItem){
  const current=Boolean(saved[item.id]);
  try{
   if(current)await unsaveMarketplaceItem(item.id);else await saveMarketplaceItem(item.id);
   setSaved(v=>({...v,[item.id]:!current}));
  }catch{router.push(('/sign-up?returnTo='+encodeURIComponent('/marketplace')) as never)}
 }

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH MARKETPLACE" title="Free Marketplace"/>
  <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
   <View style={s.hero}>
    <Text style={s.heroTitle}>Good stuff. Free. Local.</Text>
    <Text style={s.heroBody}>Claim useful items from people and organizations in your community. FairPath keeps claimant selection anonymous, protects private pickup details, and verifies pickup.</Text>
    <View style={s.heroActions}>
     <Pressable style={s.primarySmall} onPress={()=>router.push('/marketplace-list-item' as never)}><Lucide name="plus" color={C.black} size={14}/><Text style={s.primarySmallText}>LIST A FREE ITEM</Text></Pressable>
     <Pressable style={s.outlineSmall} onPress={()=>router.push('/marketplace-claims' as never)}><Text style={s.outlineSmallText}>MY CLAIMS</Text></Pressable>
    </View>
   </View>

   {quota?<View style={s.quota}>
    <View><Text style={s.quotaLabel}>{quota.plan==='fairpath_plus'?'FAIRPATH+ MARKETPLACE':'FREE PLAN MARKETPLACE'}</Text><Text style={s.quotaTitle}>{quota.remaining} claim{quota.remaining===1?'':'s'} left this month</Text></View>
    <View style={s.quotaCount}><Text style={s.quotaBig}>{quota.used}</Text><Text style={s.quotaOf}> / {quota.monthly_limit}</Text></View>
   </View>:<Pressable style={s.quotaGuest} onPress={()=>router.push('/plus' as never)}><Text style={s.quotaLabel}>CLAIM LIMITS</Text><Text style={s.quotaGuestText}>Free members get 1 claim/month. FairPath+ gets 7.</Text><Lucide name="arrow-right" color={C.lime} size={14}/></Pressable>}

   <View style={s.searchCard}>
    <View style={s.searchRow}><Lucide name="search" color={C.mutedStrong} size={15}/><TextInput value={query} onChangeText={setQuery} onSubmitEditing={()=>void run()} style={s.input} placeholder="Search furniture, electronics, kids items…" placeholderTextColor={C.muted}/></View>
    <View style={s.searchRow}><Lucide name="map-pin" color={C.mutedStrong} size={15}/><TextInput value={location} onChangeText={setLocation} onSubmitEditing={()=>void run()} style={s.input} placeholder="City, state or ZIP" placeholderTextColor={C.muted}/></View>
    <Pressable style={s.searchBtn} onPress={()=>void run()}><Text style={s.searchBtnText}>SEARCH MARKETPLACE</Text><Lucide name="arrow-right" color={C.black} size={15}/></Pressable>
   </View>

   <View style={s.quickLinks}>
    <Pressable style={s.quick} onPress={()=>router.push('/saved-marketplace' as never)}><Lucide name="bookmark" color={C.lime} size={14}/><Text style={s.quickText}>SAVED</Text></Pressable>
    <Pressable style={s.quick} onPress={()=>router.push('/marketplace-my-listings' as never)}><Lucide name="package" color={C.lime} size={14}/><Text style={s.quickText}>MY LISTINGS</Text></Pressable>
    <Pressable style={s.quick} onPress={()=>setSafeOnly(v=>!v)}><Lucide name="shield-check" color={safeOnly?C.black:C.lime} size={14}/><Text style={[s.quickText,safeOnly&&s.quickTextOn]}>SAFE PICKUP</Text></Pressable>
    <Pressable style={s.quick} onPress={()=>setSort(v=>v==='newest'?'oldest':'newest')}><Lucide name="arrow-up-down" color={C.lime} size={14}/><Text style={s.quickText}>{sort==='newest'?'NEWEST':'OLDEST'}</Text></Pressable>
   </View>

   <FilterStrip>
    <SharpChip label="All" active={!category} onPress={()=>{setCategory('');void run('')}}/>
    {MARKETPLACE_CATEGORIES.map(x=><SharpChip key={x} label={x} active={category===x} onPress={()=>{setCategory(x);void run(x)}}/>)}
   </FilterStrip>

   <View style={s.resultsHead}><View><Text style={s.results}>{loading?'LOADING':visible.length+' AVAILABLE'}</Text><Text style={s.resultsSub}>Free items only · local pickup · claim required</Text></View></View>
   {error?<Text style={s.error}>{error}</Text>:null}
   {!loading&&!error&&visible.length===0?<View style={s.empty}><Lucide name="package-open" color={C.mutedStrong} size={26}/><Text style={s.emptyTitle}>Nothing matches yet.</Text><Text style={s.emptyBody}>Try another category or location, or list something useful for somebody else.</Text></View>:null}

   <View style={s.grid}>{visible.map(item=>{
    const photo=item.marketplace_media?.slice().sort((a,b)=>a.sort_order-b.sort_order)[0]?.url??'';
    return <Pressable key={item.id} style={s.card} onPress={()=>router.push(('/market-item/'+item.id) as never)}>
     <View style={s.media}>
      {photo?<Image source={{uri:photo}} style={s.photo}/>:<View style={s.noPhoto}><Lucide name="image-off" color={C.mutedStrong} size={23}/><Text style={s.noPhotoText}>NO PHOTO</Text></View>}
      <Pressable style={[s.saveBtn,saved[item.id]&&s.saveBtnOn]} onPress={e=>{e.stopPropagation?.();void toggleSave(item)}}><Lucide name={saved[item.id]?'bookmark-check':'bookmark'} color={saved[item.id]?C.black:C.white} size={14}/></Pressable>
      {item.featured?<View style={s.featured}><Text style={s.featuredText}>FEATURED</Text></View>:null}
     </View>
     <View style={s.cardBody}>
      <View style={s.topline}><Text style={s.free}>FREE</Text>{item.safe_pickup?<InlineBadge tone="lime">SAFE PICKUP</InlineBadge>:null}</View>
      <Text style={s.itemTitle} numberOfLines={2}>{item.title}</Text>
      <Text style={s.location}>{item.pickup_area||item.city+', '+item.state}</Text>
      <Text style={s.condition}>{item.condition||'Condition not listed'}{item.quantity>1?' · Qty '+item.quantity:''}</Text>
     </View>
    </Pressable>
   })}</View>

   <View style={s.safety}>
    <Lucide name="shield" color={C.lime} size={17}/>
    <View style={{flex:1}}><Text style={s.safetyTitle}>FAIRPATH MARKETPLACE SAFETY</Text><Text style={s.safetyBody}>Exact pickup details stay private until a claim is approved. Claimants are shown anonymously during selection, and pickup is verified with a code.</Text></View>
   </View>
  </ScrollView>
 </ScreenFrame>
}

const s=StyleSheet.create({
 page:{paddingHorizontal:L.mobileGutter,paddingBottom:40},
 hero:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},heroTitle:{color:C.white,fontFamily:F.black,fontSize:27,letterSpacing:-.7},heroBody:{color:C.mutedStrong,fontSize:10,lineHeight:16,marginTop:7,maxWidth:520},
 heroActions:{flexDirection:'row',gap:8,marginTop:14},primarySmall:{height:40,backgroundColor:C.lime,paddingHorizontal:12,flexDirection:'row',gap:7,alignItems:'center'},primarySmallText:{color:C.black,fontFamily:F.extraBold,fontSize:8,letterSpacing:.7},outlineSmall:{height:40,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:12,justifyContent:'center'},outlineSmallText:{color:C.white,fontFamily:F.extraBold,fontSize:8,letterSpacing:.7},
 quota:{minHeight:70,borderBottomWidth:1,borderBottomColor:C.borderStrong,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},quotaLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},quotaTitle:{color:C.white,fontFamily:F.extraBold,fontSize:15,marginTop:5},quotaCount:{flexDirection:'row',alignItems:'baseline'},quotaBig:{color:C.white,fontFamily:F.black,fontSize:27},quotaOf:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:10},quotaGuest:{minHeight:72,borderBottomWidth:1,borderBottomColor:C.borderStrong,justifyContent:'center',paddingRight:28,position:'relative'},quotaGuestText:{color:C.white,fontFamily:F.extraBold,fontSize:12,marginTop:5},
 searchCard:{paddingVertical:14,borderBottomWidth:1,borderBottomColor:C.borderStrong},searchRow:{height:46,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:11,marginBottom:7},input:{flex:1,color:C.white,fontSize:11,paddingVertical:0},searchBtn:{height:46,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:13},searchBtnText:{color:C.black,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},
 quickLinks:{flexDirection:'row',flexWrap:'wrap',gap:7,paddingVertical:12},quick:{minHeight:36,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:10,flexDirection:'row',alignItems:'center',gap:6},quickText:{color:C.white,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7},quickTextOn:{color:C.black},
 resultsHead:{paddingVertical:13,borderBottomWidth:1,borderBottomColor:C.border},results:{color:C.white,fontFamily:F.extraBold,fontSize:10,letterSpacing:.8},resultsSub:{color:C.muted,fontSize:8.5,marginTop:3},error:{color:C.danger,fontSize:10,paddingVertical:12},
 empty:{paddingVertical:34,alignItems:'flex-start'},emptyTitle:{color:C.white,fontFamily:F.black,fontSize:19,marginTop:10},emptyBody:{color:C.muted,fontSize:10,lineHeight:16,marginTop:5,maxWidth:320},
 grid:{flexDirection:'row',flexWrap:'wrap',marginHorizontal:-5,paddingTop:10},card:{width:'50%',paddingHorizontal:5,paddingBottom:18},media:{aspectRatio:1.08,backgroundColor:'#0A0C0A',borderWidth:1,borderColor:C.borderStrong,position:'relative',overflow:'hidden'},photo:{width:'100%',height:'100%'},noPhoto:{flex:1,alignItems:'center',justifyContent:'center'},noPhotoText:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8,marginTop:6},saveBtn:{position:'absolute',right:7,top:7,width:31,height:31,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#080A08DD',alignItems:'center',justifyContent:'center'},saveBtnOn:{backgroundColor:C.lime,borderColor:C.lime},featured:{position:'absolute',left:0,bottom:0,backgroundColor:C.lime,paddingHorizontal:7,paddingVertical:4},featuredText:{color:C.black,fontFamily:F.extraBold,fontSize:6,letterSpacing:.7},
 cardBody:{paddingTop:8},topline:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:5},free:{color:C.lime,fontFamily:F.black,fontSize:15},itemTitle:{color:C.white,fontFamily:F.extraBold,fontSize:13,lineHeight:16,marginTop:4},location:{color:C.mutedStrong,fontSize:9,marginTop:5},condition:{color:C.muted,fontSize:8,marginTop:4},
 safety:{borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0F150B',padding:13,flexDirection:'row',gap:10,marginTop:8},safetyTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.9},safetyBody:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:5}
});
