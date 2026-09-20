import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import {
 MarketplaceItem, MarketplaceQuota, isMarketplaceItemSaved, loadMarketplaceItem, loadMarketplaceViewerState,
 requestMarketplaceClaim, saveMarketplaceItem, unsaveMarketplaceItem
} from '@/core/marketplace/marketplace-service';

export default function MarketItem(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [item,setItem]=useState<MarketplaceItem|null>(null);
 const [quota,setQuota]=useState<MarketplaceQuota|null>(null);
 const [claim,setClaim]=useState<{id:string;status:string;pickup_deadline:string|null}|null>(null);
 const [isOwner,setIsOwner]=useState(false);
 const [saved,setSaved]=useState(false);
 const [message,setMessage]=useState('');
 const [loading,setLoading]=useState(true);
 const [claiming,setClaiming]=useState(false);
 const [error,setError]=useState('');
 const [galleryIndex,setGalleryIndex]=useState(0);
 const [galleryWidth,setGalleryWidth]=useState(0);
 const galleryRef=useRef<ScrollView|null>(null);

 const load=useCallback(async()=>{
  if(!id)return;setLoading(true);setError('');
  try{
   const [listing,state]=await Promise.all([loadMarketplaceItem(id),loadMarketplaceViewerState(id)]);
   setItem(listing);setQuota(state.quota);setClaim(state.claim);setIsOwner(state.isOwner);setSaved(state.saved);
  }catch{setError('This Marketplace item could not be loaded.')}
  finally{setLoading(false)}
 },[id]);
 useFocusEffect(useCallback(()=>{void load()},[load]));

 async function toggleSave(){
  if(!item)return;
  try{if(saved)await unsaveMarketplaceItem(item.id);else await saveMarketplaceItem(item.id);setSaved(v=>!v)}
  catch{router.push(('/sign-up?returnTo='+encodeURIComponent('/market-item/'+item.id)) as never)}
 }

 async function requestClaim(){
  if(!item||claiming)return;
  setClaiming(true);
  try{
   const created=await requestMarketplaceClaim(item.id,message);
   setClaim(created as any);
   const nextQuota=await loadMarketplaceViewerState(item.id);setQuota(nextQuota.quota);
   Alert.alert('Claim requested','Your request is in. The donor sees an anonymous claim—not your name, race, or profile photo. If selected, you will get private pickup details and a 48-hour pickup window.',[
    {text:'View claim',onPress:()=>router.push(('/marketplace-claim/'+created.id) as never)}
   ]);
  }catch(e){
   const code=e instanceof Error?e.message:'';
   if(code==='SIGNED_OUT'){router.push(('/sign-up?returnTo='+encodeURIComponent('/market-item/'+item.id)) as never)}
   else if(code==='CLAIM_LIMIT_REACHED')Alert.alert('Monthly claim limit reached',quota?.plan==='fairpath_plus'?'You have used all 7 FairPath+ Marketplace claims this month.':'Free members get 1 Marketplace claim each month. FairPath+ includes 7.',[
    {text:'Not now',style:'cancel'},{text:'View FairPath+',onPress:()=>router.push('/plus' as never)}
   ]);
   else if(code==='OWN_ITEM')Alert.alert('This is your listing','You cannot claim your own item.');
   else if(code==='ITEM_UNAVAILABLE')Alert.alert('Item unavailable','This item is no longer accepting new claims.');
   else Alert.alert('Could not request claim','Please try again.');
  }finally{setClaiming(false)}
 }

 if(loading)return <ScreenFrame><PageHeader eyebrow="FAIRPATH MARKETPLACE" title="Item"/><Text style={s.state}>Loading item…</Text></ScreenFrame>;
 if(error||!item)return <ScreenFrame><PageHeader eyebrow="FAIRPATH MARKETPLACE" title="Item"/><Text style={s.error}>{error||'Item not found.'}</Text></ScreenFrame>;

 const photos=item.marketplace_media?.slice().sort((a,b)=>a.sort_order-b.sort_order).map(x=>x.url)??[];
 const unavailable=item.status!=='available';

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH MARKETPLACE" title="Item details" backTo="/marketplace" trailing={
   !isOwner?<Pressable style={[s.save,saved&&s.saveOn]} onPress={()=>void toggleSave()}><Lucide name={saved?'bookmark-check':'bookmark'} color={saved?C.black:C.white} size={14}/></Pressable>:undefined
  }/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.gallery} onLayout={e=>setGalleryWidth(e.nativeEvent.layout.width)}>
    {photos.length&&galleryWidth>0?<ScrollView ref={galleryRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={e=>setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x/galleryWidth))}>
     {photos.map((url,index)=><Image key={url+index} source={{uri:url}} style={[s.hero,{width:galleryWidth}]}/>)}
    </ScrollView>:<View style={s.noPhoto}><Lucide name="image-off" color={C.mutedStrong} size={32}/><Text style={s.noPhotoTitle}>NO PHOTOS PROVIDED</Text></View>}
    {photos.length?<View style={s.photoCount}><Text style={s.photoCountText}>{galleryIndex+1} / {photos.length}</Text></View>:null}
   </View>
   {photos.length>1?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbs}>{photos.map((url,index)=><Pressable key={'t'+url+index} style={[s.thumbWrap,galleryIndex===index&&s.thumbOn]} onPress={()=>{setGalleryIndex(index);galleryRef.current?.scrollTo({x:index*galleryWidth,animated:true})}}><Image source={{uri:url}} style={s.thumb}/></Pressable>)}</ScrollView>:null}

   <View style={s.intro}>
    <View style={s.badges}><InlineBadge tone="lime">FREE</InlineBadge>{item.safe_pickup?<InlineBadge tone="lime">SAFE PICKUP</InlineBadge>:null}{item.seller_type==='organization'?<InlineBadge>ORGANIZATION</InlineBadge>:null}</View>
    <Text style={s.title}>{item.title}</Text>
    <Text style={s.meta}>{[item.condition,item.quantity>1?'Qty '+item.quantity:null,item.pickup_area||item.city+', '+item.state].filter(Boolean).join(' · ')}</Text>
   </View>

   <Section label="ABOUT THIS ITEM"><Text style={s.body}>{item.description||'No description provided.'}</Text></Section>
   <Section label="PICKUP AREA">
    <View style={s.infoRow}><Lucide name="map-pin" color={C.lime} size={15}/><View style={{flex:1}}><Text style={s.infoTitle}>{item.pickup_area||item.city+', '+item.state}</Text><Text style={s.infoBody}>The exact pickup address stays private until your claim is approved.</Text></View></View>
    {item.safe_pickup?<View style={s.infoRow}><Lucide name="shield-check" color={C.lime} size={15}/><View style={{flex:1}}><Text style={s.infoTitle}>Safe pickup enabled</Text><Text style={s.infoBody}>Use the listed pickup instructions and verify completion with the FairPath pickup code.</Text></View></View>:null}
   </Section>

   <Section label="HOW CLAIMING WORKS">
    <Step n="1" title="REQUEST" body="Request the item. Free members get 1 Marketplace claim each month; FairPath+ gets 7."/>
    <Step n="2" title="ANONYMOUS SELECTION" body="The donor sees an anonymous claim ID. FairPath does not show your name, race, or profile photo during selection."/>
    <Step n="3" title="48-HOUR PICKUP" body="If approved, private pickup details unlock and your 48-hour pickup window starts."/>
    <Step n="4" title="VERIFY" body="At pickup, give the donor your FairPath code. The donor verifies it to complete the handoff."/>
   </Section>

   {isOwner?<View style={s.ownerBox}><Text style={s.ownerLabel}>YOUR LISTING</Text><Text style={s.ownerTitle}>Manage claim requests and pickup.</Text><Pressable style={s.primary} onPress={()=>router.push(('/marketplace-manage/'+item.id) as never)}><Text style={s.primaryText}>MANAGE LISTING</Text><Lucide name="arrow-right" color={C.black} size={15}/></Pressable></View>
   :claim?<View style={s.claimBox}><Text style={s.claimLabel}>YOUR CLAIM</Text><Text style={s.claimTitle}>{claim.status.replaceAll('_',' ').toUpperCase()}</Text><Text style={s.claimBody}>{claim.status==='requested'?'Your claim is waiting for anonymous donor selection.':claim.status==='approved'||claim.status==='ready'?'Pickup details are available in your claim workspace.':'Open your claim for the latest status.'}</Text><Pressable style={s.primary} onPress={()=>router.push(('/marketplace-claim/'+claim.id) as never)}><Text style={s.primaryText}>OPEN MY CLAIM</Text><Lucide name="arrow-right" color={C.black} size={15}/></Pressable></View>
   :unavailable?<View style={s.unavailable}><Text style={s.unavailableTitle}>NOT ACCEPTING CLAIMS</Text><Text style={s.unavailableBody}>This item is currently reserved, claimed, or removed.</Text></View>
   :<View style={s.claimForm}>
    <View style={s.claimTop}><View><Text style={s.claimLabel}>REQUEST THIS ITEM</Text><Text style={s.claimQuota}>{quota?quota.remaining+' of '+quota.monthly_limit+' claims left this month':'Sign in to request'}</Text></View><Lucide name="gift" color={C.lime} size={22}/></View>
    <Text style={s.messageLabel}>OPTIONAL NOTE TO DONOR</Text>
    <TextInput value={message} onChangeText={setMessage} style={s.message} multiline maxLength={500} textAlignVertical="top" placeholder="Keep it short. Do not include sensitive personal information." placeholderTextColor={C.muted}/>
    <Pressable style={[s.primary,claiming&&s.disabled]} onPress={()=>void requestClaim()} disabled={claiming}><Text style={s.primaryText}>{claiming?'REQUESTING…':'REQUEST CLAIM'}</Text><Lucide name="arrow-right" color={C.black} size={15}/></Pressable>
   </View>}

   {!isOwner?<Pressable style={s.report} onPress={()=>router.push(('/marketplace-report/'+item.id) as never)}><Lucide name="flag" color={C.mutedStrong} size={13}/><Text style={s.reportText}>REPORT LISTING OR SAFETY CONCERN</Text><Lucide name="arrow-right" color={C.mutedStrong} size={13}/></Pressable>:null}
  </ScrollView>
 </ScreenFrame>
}

function Section({label,children}:{label:string;children:React.ReactNode}){return <View style={s.section}><Text style={s.sectionLabel}>{label}</Text>{children}</View>}
function Step({n,title,body}:{n:string;title:string;body:string}){return <View style={s.step}><View style={s.stepN}><Text style={s.stepNText}>{n}</Text></View><View style={{flex:1}}><Text style={s.stepTitle}>{title}</Text><Text style={s.stepBody}>{body}</Text></View></View>}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:14,paddingBottom:40},state:{color:C.mutedStrong,padding:L.mobileGutter},error:{color:C.danger,padding:L.mobileGutter},
 save:{width:34,height:34,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},saveOn:{backgroundColor:C.lime,borderColor:C.lime},
 gallery:{height:260,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',position:'relative',overflow:'hidden'},hero:{height:258},noPhoto:{flex:1,alignItems:'center',justifyContent:'center'},noPhotoTitle:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8,marginTop:8},photoCount:{position:'absolute',right:8,bottom:8,backgroundColor:'#080A08DD',borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:8,paddingVertical:5},photoCountText:{color:C.white,fontFamily:F.extraBold,fontSize:7},thumbs:{gap:7,paddingVertical:8},thumbWrap:{width:64,height:48,borderWidth:1,borderColor:C.borderStrong,opacity:.6},thumbOn:{borderColor:C.lime,opacity:1},thumb:{width:'100%',height:'100%'},
 intro:{paddingVertical:17,borderBottomWidth:1,borderBottomColor:C.borderStrong},badges:{flexDirection:'row',gap:6,flexWrap:'wrap'},title:{color:C.white,fontFamily:F.black,fontSize:27,lineHeight:30,marginTop:10},meta:{color:C.mutedStrong,fontSize:10,marginTop:7},
 section:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.border},sectionLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7.5,letterSpacing:1.1,marginBottom:10},body:{color:C.mutedStrong,fontSize:11,lineHeight:18},
 infoRow:{flexDirection:'row',gap:10,paddingVertical:8},infoTitle:{color:C.white,fontFamily:F.extraBold,fontSize:10},infoBody:{color:C.muted,fontSize:9,lineHeight:14,marginTop:3},
 step:{flexDirection:'row',gap:10,paddingVertical:8},stepN:{width:24,height:24,borderWidth:1,borderColor:'#526F2B',alignItems:'center',justifyContent:'center'},stepNText:{color:C.lime,fontFamily:F.black,fontSize:9},stepTitle:{color:C.white,fontFamily:F.extraBold,fontSize:9,letterSpacing:.5},stepBody:{color:C.muted,fontSize:8.5,lineHeight:13,marginTop:3},
 claimForm:{paddingTop:18},claimTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},claimLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},claimQuota:{color:C.white,fontFamily:F.extraBold,fontSize:13,marginTop:5},messageLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7,marginTop:16,marginBottom:6},message:{minHeight:100,borderWidth:1,borderColor:C.borderStrong,color:C.white,padding:11,fontSize:10},
 primary:{height:48,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:13,marginTop:12},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:8.5,letterSpacing:.8},disabled:{opacity:.55},
 claimBox:{borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0F150B',padding:14,marginTop:18},claimTitle:{color:C.white,fontFamily:F.black,fontSize:19,marginTop:5},claimBody:{color:C.mutedStrong,fontSize:9,lineHeight:14,marginTop:6},ownerBox:{borderWidth:1,borderColor:C.lime,padding:14,marginTop:18},ownerLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},ownerTitle:{color:C.white,fontFamily:F.black,fontSize:18,marginTop:5},
 unavailable:{borderWidth:1,borderColor:C.borderStrong,padding:14,marginTop:18},unavailableTitle:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},unavailableBody:{color:C.muted,fontSize:9,marginTop:5},
 report:{height:46,borderTopWidth:1,borderTopColor:C.border,marginTop:18,flexDirection:'row',alignItems:'center',gap:8},reportText:{flex:1,color:C.mutedStrong,fontFamily:F.extraBold,fontSize:7,letterSpacing:.7}
});
