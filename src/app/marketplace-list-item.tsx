import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { notify } from '@/core/ui/notify';
import * as DocumentPicker from 'expo-document-picker';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { MARKETPLACE_CATEGORIES, MARKETPLACE_CONDITIONS, createMarketplaceItem, setMarketplaceItemAvailability, uploadMarketplacePhoto } from '@/core/marketplace/marketplace-service';
import { formatUsPhone } from '@/core/forms/formatters';

type Picked={name:string;uri:string;mimeType?:string|null;size?:number|null};

export default function MarketplaceListItem(){
 const [title,setTitle]=useState('');
 const [description,setDescription]=useState('');
 const [category,setCategory]=useState('');
 const [condition,setCondition]=useState('');
 const [quantity,setQuantity]=useState('1');
 const [city,setCity]=useState('');
 const [state,setState]=useState('');
 const [postal,setPostal]=useState('');
 const [pickupArea,setPickupArea]=useState('');
 const [safePickup,setSafePickup]=useState(true);
 const [sellerType,setSellerType]=useState<'individual'|'organization'>('individual');
 const [locationName,setLocationName]=useState('');
 const [address1,setAddress1]=useState('');
 const [address2,setAddress2]=useState('');
 const [pickupCity,setPickupCity]=useState('');
 const [pickupState,setPickupState]=useState('');
 const [pickupPostal,setPickupPostal]=useState('');
 const [instructions,setInstructions]=useState('');
 const [contactPhone,setContactPhone]=useState('');
 const [photos,setPhotos]=useState<Picked[]>([]);
 const [saving,setSaving]=useState(false);

 async function pickPhotos(){
  const result=await DocumentPicker.getDocumentAsync({multiple:true,copyToCacheDirectory:true,type:['image/jpeg','image/png','image/heic','image/heif','image/webp']});
  if(result.canceled)return;
  const remaining=20-photos.length;
  const next=result.assets.slice(0,remaining).filter(x=>(x.size??0)<=12*1024*1024).map(x=>({name:x.name,uri:x.uri,mimeType:x.mimeType,size:x.size}));
  setPhotos(v=>[...v,...next].slice(0,20));
  const rejected=result.assets.filter(x=>(x.size??0)>12*1024*1024).length;
  if(rejected)notify('Some photos were skipped','Marketplace photos must be 12 MB or smaller.');
 }

 function validate(){
  if(title.trim().length<3)return 'Add a clear item title.';
  if(description.trim().length<10)return 'Add a short description so people know what they are claiming.';
  if(!category)return 'Choose a category.';
  if(!condition)return 'Choose the item condition.';
  if(!city.trim()||state.trim().length<2)return 'Add the public city and state.';
  if(!pickupCity.trim()||pickupState.trim().length<2)return 'Add the private pickup city and state.';
  return '';
 }

 async function publish(){
  if(saving)return;
  const problem=validate();if(problem){notify('Finish the listing',problem);return}
  setSaving(true);
  try{
   const itemId=await createMarketplaceItem({
    title,description,category,condition,quantity:Number(quantity)||1,city,state,postal_code:postal,pickup_area:pickupArea,safe_pickup:safePickup,seller_type:sellerType,
    location_name:locationName,address_line1:address1,address_line2:address2,pickup_city:pickupCity,pickup_state:pickupState,pickup_postal_code:pickupPostal,instructions,contact_phone:contactPhone
   });
   let uploaded=0;
   for(let i=0;i<photos.length;i++){
    try{const response=await fetch(photos[i].uri);const bytes=await response.arrayBuffer();await uploadMarketplacePhoto(itemId,{name:photos[i].name,mimeType:photos[i].mimeType,bytes},i);uploaded++}catch{}
   }
   await setMarketplaceItemAvailability(itemId,true);
   notify('Item listed','Your free item is now available in FairPath Marketplace.'+(photos.length&&uploaded<photos.length?' '+uploaded+' of '+photos.length+' photos uploaded.':''),[
    {text:'View listing',onPress:()=>router.replace(('/market-item/'+itemId) as never)}
   ]);
  }catch(e){
   if(e instanceof Error&&e.message==='SIGNED_OUT'){router.replace(('/sign-up?returnTo='+encodeURIComponent('/marketplace-list-item')) as never);return}
   notify('Could not list item','Please review the listing and try again.');
  }finally{setSaving(false)}
 }

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH MARKETPLACE" title="List a free item" backTo="/marketplace"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={s.intro}><Text style={s.introTitle}>Give it forward.</Text><Text style={s.introBody}>FairPath Marketplace is for free items. No selling, bidding, or hidden fees. Claimants are anonymous while you choose, and exact pickup details stay private until approval.</Text></View>

   <Label text="ITEM TITLE"/><TextInput value={title} onChangeText={setTitle} style={s.field} maxLength={100} placeholder="Example: Solid wood dining table" placeholderTextColor={C.muted}/>
   <Label text="DESCRIPTION"/><TextInput value={description} onChangeText={setDescription} style={s.area} multiline maxLength={1500} textAlignVertical="top" placeholder="Condition, dimensions, what is included, anything useful to know." placeholderTextColor={C.muted}/>

   <Label text="CATEGORY"/><View style={s.chips}>{MARKETPLACE_CATEGORIES.map(x=><Chip key={x} label={x} active={category===x} onPress={()=>setCategory(x)}/>)}</View>
   <Label text="CONDITION"/><View style={s.chips}>{MARKETPLACE_CONDITIONS.map(x=><Chip key={x} label={x} active={condition===x} onPress={()=>setCondition(x)}/>)}</View>

   <View style={s.two}><View style={{flex:1}}><Label text="QUANTITY"/><TextInput value={quantity} onChangeText={v=>setQuantity(v.replace(/D/g,'').slice(0,2))} style={s.field} keyboardType="number-pad"/></View><View style={{flex:1}}><Label text="LISTING TYPE"/><View style={s.inlineChoices}><Chip label="Individual" active={sellerType==='individual'} onPress={()=>setSellerType('individual')}/><Chip label="Organization" active={sellerType==='organization'} onPress={()=>setSellerType('organization')}/></View></View></View>

   <Text style={s.sectionTitle}>PUBLIC LOCATION</Text><Text style={s.sectionHelp}>People see only this approximate area before approval.</Text>
   <View style={s.two}><TextInput value={city} onChangeText={setCity} style={[s.field,{flex:1}]} placeholder="City" placeholderTextColor={C.muted}/><TextInput value={state} onChangeText={v=>setState(v.toUpperCase().slice(0,2))} style={[s.field,{width:78}]} placeholder="OH" placeholderTextColor={C.muted}/></View>
   <TextInput value={postal} onChangeText={v=>setPostal(v.replace(/D/g,'').slice(0,5))} style={s.field} keyboardType="number-pad" placeholder="ZIP (optional)" placeholderTextColor={C.muted}/>
   <TextInput value={pickupArea} onChangeText={setPickupArea} style={s.field} placeholder="Pickup area label, e.g. Easton / Downtown" placeholderTextColor={C.muted}/>

   <Text style={s.sectionTitle}>PRIVATE PICKUP DETAILS</Text><Text style={s.sectionHelp}>Only the approved claimant can unlock these details.</Text>
   <TextInput value={locationName} onChangeText={setLocationName} style={s.field} placeholder="Location name (optional)" placeholderTextColor={C.muted}/>
   <TextInput value={address1} onChangeText={setAddress1} style={s.field} placeholder="Street address (optional until pickup)" placeholderTextColor={C.muted}/>
   <TextInput value={address2} onChangeText={setAddress2} style={s.field} placeholder="Apt / suite / unit (optional)" placeholderTextColor={C.muted}/>
   <View style={s.two}><TextInput value={pickupCity} onChangeText={setPickupCity} style={[s.field,{flex:1}]} placeholder="Pickup city" placeholderTextColor={C.muted}/><TextInput value={pickupState} onChangeText={v=>setPickupState(v.toUpperCase().slice(0,2))} style={[s.field,{width:78}]} placeholder="OH" placeholderTextColor={C.muted}/></View>
   <TextInput value={pickupPostal} onChangeText={v=>setPickupPostal(v.replace(/D/g,'').slice(0,5))} style={s.field} keyboardType="number-pad" placeholder="Pickup ZIP (optional)" placeholderTextColor={C.muted}/>
   <TextInput value={instructions} onChangeText={setInstructions} style={s.areaSmall} multiline textAlignVertical="top" maxLength={800} placeholder="Pickup instructions: where to park, who to ask for, public meetup point, etc." placeholderTextColor={C.muted}/>
   <TextInput value={formatUsPhone(contactPhone)} onChangeText={v=>setContactPhone(formatUsPhone(v))} style={s.field} keyboardType="phone-pad" maxLength={14} placeholder="Pickup contact phone (optional)" placeholderTextColor={C.muted}/>

   <Pressable style={[s.toggle,safePickup&&s.toggleOn]} onPress={()=>setSafePickup(v=>!v)}><View style={[s.box,safePickup&&s.boxOn]}>{safePickup?<Lucide name="check" color={C.black} size={12}/>:null}</View><View style={{flex:1}}><Text style={s.toggleTitle}>SAFE PICKUP</Text><Text style={s.toggleBody}>Use a well-lit/public pickup point when possible and complete the handoff with FairPath verification.</Text></View></Pressable>

   <Text style={s.sectionTitle}>PHOTOS</Text><Text style={s.sectionHelp}>Up to 20 photos · JPG, PNG, HEIC or WebP · 12 MB each.</Text>
   <Pressable style={s.photoButton} onPress={()=>void pickPhotos()} disabled={photos.length>=20}><Lucide name="images" color={C.lime} size={16}/><Text style={s.photoButtonText}>{photos.length?photos.length+' PHOTO'+(photos.length===1?'':'S')+' SELECTED':'CHOOSE PHOTOS'}</Text><Text style={s.photoCount}>{photos.length}/20</Text></Pressable>
   {photos.length?<View style={s.fileList}>{photos.map((p,i)=><View key={p.uri+i} style={s.fileRow}><Text style={s.fileName} numberOfLines={1}>{i+1}. {p.name}</Text><Pressable onPress={()=>setPhotos(v=>v.filter((_,idx)=>idx!==i))}><Lucide name="x" color={C.mutedStrong} size={14}/></Pressable></View>)}</View>:null}

   <View style={s.rules}><Lucide name="shield-alert" color={C.lime} size={17}/><View style={{flex:1}}><Text style={s.rulesTitle}>MARKETPLACE RULES</Text><Text style={s.rulesBody}>Free useful goods only. No weapons, drugs, alcohol, prescription medication, stolen/counterfeit goods, unsafe products, or discriminatory claim selection. Do not put private pickup details in the public description.</Text></View></View>

   <Pressable style={[s.publish,saving&&s.disabled]} disabled={saving} onPress={()=>void publish()}><Text style={s.publishText}>{saving?'PUBLISHING…':'PUBLISH FREE ITEM'}</Text><Lucide name="arrow-right" color={C.black} size={16}/></Pressable>
  </ScrollView>
 </ScreenFrame>
}

function Label({text}:{text:string}){return <Text style={s.label}>{text}</Text>}
function Chip({label,active,onPress}:{label:string;active:boolean;onPress:()=>void}){return <Pressable style={[s.chip,active&&s.chipOn]} onPress={onPress}><Text style={[s.chipText,active&&s.chipTextOn]}>{label.toUpperCase()}</Text></Pressable>}

const s=StyleSheet.create({
 content:{padding:L.mobileGutter,paddingBottom:44},intro:{paddingBottom:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},introTitle:{color:C.white,fontFamily:F.black,fontSize:28},introBody:{color:C.mutedStrong,fontSize:10,lineHeight:16,marginTop:7,maxWidth:520},
 label:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1,marginTop:16,marginBottom:6},field:{minHeight:46,borderWidth:1,borderColor:C.borderStrong,color:C.white,paddingHorizontal:11,fontSize:11,marginBottom:7},area:{minHeight:130,borderWidth:1,borderColor:C.borderStrong,color:C.white,padding:11,fontSize:11},areaSmall:{minHeight:96,borderWidth:1,borderColor:C.borderStrong,color:C.white,padding:11,fontSize:11,marginBottom:7},
 chips:{flexDirection:'row',flexWrap:'wrap',gap:6},chip:{minHeight:36,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:9,alignItems:'center',justifyContent:'center'},chipOn:{backgroundColor:C.lime,borderColor:C.lime},chipText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:6.5},chipTextOn:{color:C.black},
 two:{flexDirection:'row',gap:8},inlineChoices:{flexDirection:'row',gap:5,flexWrap:'wrap'},
 sectionTitle:{color:C.white,fontFamily:F.black,fontSize:17,marginTop:23},sectionHelp:{color:C.muted,fontSize:9,lineHeight:14,marginTop:4,marginBottom:9},
 toggle:{borderWidth:1,borderColor:C.borderStrong,padding:11,flexDirection:'row',gap:9,marginTop:8},toggleOn:{borderColor:'#526F2B',backgroundColor:'#0F150B'},box:{width:20,height:20,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},boxOn:{backgroundColor:C.lime,borderColor:C.lime},toggleTitle:{color:C.white,fontFamily:F.extraBold,fontSize:8,letterSpacing:.7},toggleBody:{color:C.muted,fontSize:8.5,lineHeight:13,marginTop:3},
 photoButton:{height:48,borderWidth:1,borderColor:C.borderStrong,flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:11},photoButtonText:{flex:1,color:C.white,fontFamily:F.extraBold,fontSize:8,letterSpacing:.7},photoCount:{color:C.lime,fontFamily:F.extraBold,fontSize:8},fileList:{borderBottomWidth:1,borderBottomColor:C.borderStrong},fileRow:{height:38,flexDirection:'row',alignItems:'center',gap:8,borderBottomWidth:1,borderBottomColor:C.border},fileName:{flex:1,color:C.mutedStrong,fontSize:8.5},
 rules:{borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0F150B',padding:13,flexDirection:'row',gap:10,marginTop:22},rulesTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:.9},rulesBody:{color:C.mutedStrong,fontSize:8.5,lineHeight:13,marginTop:4},
 publish:{height:52,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,marginTop:14},publishText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},disabled:{opacity:.55}
});
