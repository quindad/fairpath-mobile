import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { FAIRPATH_PLUS_PRODUCT } from '@/core/membership/plus-config';
import { MEMBERSHIP_BENEFITS } from '@/core/membership/fairpath-plus';
import { describePlus, isExpiringSoon, usePlusStatus } from '@/core/membership/plus-access';
import { getBillingProvider } from '@/core/billing/billing-provider';
import { loadFastTrackPricing } from '@/core/payments/payments-service';
import { formatCents } from '@/core/payments/payment-format';

/**
 * FairPath+ screen. The member's status comes from the server (usePlusStatus -> my_fairpath_plus_status).
 * Complimentary access (e.g. correctional transition) needs no payment method and never charges at the end.
 * Paid subscriptions go through the platform store boundary, which is honest about not being connected yet.
 */
export default function Plus(){
 const {status,loading,reload}=usePlusStatus();
 const view=describePlus(status);
 const plus=MEMBERSHIP_BENEFITS.filter(x=>x.plan==='plus');
 const provider=getBillingProvider();
 const [pricing,setPricing]=useState<{base:number;discount:number;currency:string}|null>(null);
 const [notice,setNotice]=useState('');
 useEffect(()=>{loadFastTrackPricing().then(p=>{if(p)setPricing({base:p.base_amount_cents,discount:p.plus_discount_cents,currency:p.currency})})},[]);

 async function subscribe(){
  const r=await provider.purchasePlus();
  setNotice(r.status==='not_configured'||r.status==='error'?r.message:r.status==='cancelled'?'':'Purchase received. Waiting for FairPath to verify it with the store.');
  reload();
 }
 async function restore(){
  const r=await provider.restorePurchases();
  setNotice(r.status==='not_configured'||r.status==='error'?r.message:'Checking your purchases…');
  reload();
 }

 return <ScreenFrame><PageHeader eyebrow="MEMBERSHIP" title="FairPath+"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <View style={[s.status,view.tone==='complimentary'||view.tone==='active'?s.statusOn:null,isExpiringSoon(status)&&s.statusSoon]}>
    <Text style={s.statusLabel}>{loading?'CHECKING…':view.tone==='complimentary'?'COMPLIMENTARY ACCESS':view.tone==='active'?'ACTIVE':view.tone==='expired'?'ENDED':'YOUR PLAN'}</Text>
    <Text style={s.statusTitle}>{loading?'Loading your membership…':view.headline}</Text>
    {!loading?<Text style={s.statusBody}>{view.detail}</Text>:null}
   </View>

   <View style={s.hero}>
    <Text style={s.mark}>+</Text>
    <Text style={s.title}>More tools. More opportunity. A stronger you.</Text>
    <View style={s.priceRow}><Text style={s.price}>{'$'+FAIRPATH_PLUS_PRODUCT.displayPriceUsd}</Text><Text style={s.month}> / {FAIRPATH_PLUS_PRODUCT.period}</Text></View>
    <Text style={s.sub}>Keep core matching and resources free. Upgrade when you want FairPath to do more of the work with you.</Text>
   </View>

   {pricing&&pricing.discount>0?<View style={s.value}><Text style={s.valueTop}>FASTTRACK HOUSING</Text><Text style={s.valueBig}>{formatCents(pricing.base-pricing.discount,pricing.currency)} with Plus</Text><Text style={s.valueSmall}>Standard FastTrack price {formatCents(pricing.base,pricing.currency)} · save {formatCents(pricing.discount,pricing.currency)} on each eligible application.</Text></View>:null}

   <View style={s.list}>{plus.map(x=><View key={x.id} style={s.row}><Text style={s.check}>✓</Text><View style={s.copy}><Text style={s.rowTitle}>{x.title}</Text><Text style={s.rowBody}>{x.description}</Text></View></View>)}</View>

   <View style={s.market}><Text style={s.marketTitle}>7 Marketplace claims / month</Text><Text style={s.marketBody}>Free FairPath accounts include 1 Marketplace claim each month. FairPath+ raises that allowance to 7 while keeping Marketplace items free.</Text><Pressable onPress={()=>router.push('/marketplace' as never)}><Text style={s.marketLink}>OPEN FREE MARKETPLACE →</Text></Pressable></View>

   {view.showSubscribe&&!loading?<>
    <Pressable accessibilityRole="button" style={[s.cta,!provider.configured&&s.ctaDisabled]} onPress={()=>void subscribe()}>
     <Text style={s.ctaText}>{provider.configured?'SUBSCRIBE TO FAIRPATH+':'SUBSCRIBE · NOT CONNECTED YET'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" style={s.restore} onPress={()=>void restore()}><Text style={s.restoreText}>RESTORE PURCHASES</Text></Pressable>
    <Text style={s.note}>{provider.configured?'You choose whether to subscribe. Nothing is charged until you confirm in the store.':'Store subscriptions are not connected in this build, so this cannot charge you. Your account keeps working on the free plan.'}</Text>
   </>:null}
   {notice?<Text style={s.notice}>{notice}</Text>:null}

   <Pressable onPress={()=>router.push('/fairpath-ai' as never)}><Text style={s.back}>Explore FairPath AI →</Text></Pressable>
  </ScrollView>
 </ScreenFrame>
}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingBottom:36},
 status:{borderWidth:1,borderColor:C.borderStrong,padding:14,marginTop:14},statusOn:{borderColor:'#526F2B',backgroundColor:'#0F150B'},statusSoon:{borderColor:C.lime},
 statusLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1},statusTitle:{color:C.white,fontFamily:F.black,fontSize:20,marginTop:6},statusBody:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginTop:6},
 hero:{paddingVertical:22},mark:{color:C.lime,fontFamily:F.extraBold,fontSize:44},title:{color:C.white,fontFamily:F.extraBold,fontSize:28,lineHeight:31,maxWidth:330},
 priceRow:{flexDirection:'row',alignItems:'baseline',marginTop:15},price:{color:C.lime,fontFamily:F.extraBold,fontSize:38},month:{color:C.mutedStrong,fontFamily:F.medium,fontSize:13},
 sub:{color:C.mutedStrong,fontFamily:F.regular,fontSize:12,lineHeight:18,marginTop:8},
 value:{backgroundColor:C.card,borderWidth:1,borderColor:C.border,padding:15},valueTop:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},valueBig:{color:C.white,fontFamily:F.bold,fontSize:20,marginTop:5},valueSmall:{color:C.muted,fontSize:10,lineHeight:15,marginTop:4},
 list:{marginTop:12},row:{flexDirection:'row',paddingVertical:13,borderBottomWidth:1,borderBottomColor:C.border},check:{color:C.lime,fontFamily:F.extraBold,fontSize:16,width:28},copy:{flex:1},rowTitle:{color:C.white,fontFamily:F.bold,fontSize:13},rowBody:{color:C.muted,fontSize:10,lineHeight:15,marginTop:3},
 market:{paddingVertical:16},marketTitle:{color:C.white,fontFamily:F.bold,fontSize:15},marketBody:{color:C.muted,fontSize:10,lineHeight:15,marginTop:4},marketLink:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.7,marginTop:10},
 cta:{height:48,backgroundColor:C.lime,alignItems:'center',justifyContent:'center'},ctaDisabled:{opacity:.55},ctaText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:.5},
 restore:{height:40,alignItems:'center',justifyContent:'center',marginTop:6},restoreText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},
 note:{color:C.muted,fontSize:9,textAlign:'center',marginTop:6,lineHeight:14},notice:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginTop:10,textAlign:'center'},
 back:{color:C.lime,fontFamily:F.bold,fontSize:10,textAlign:'center',marginTop:18}
});
