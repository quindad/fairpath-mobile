import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { FastTrackQuote, loadFastTrackQuote } from '@/core/opportunities/opportunity-service';
import { paymentsConfigured, prepareFastTrackPayment, waitForPaymentSettlement } from '@/core/payments/payments-service';
import { presentPaymentSheetFor } from '@/core/payments/payment-sheet';
import { formatCents } from '@/core/payments/payment-format';

type Phase = 'idle' | 'preparing' | 'confirming';

/**
 * FastTrack checkout. Everything shown here (price, discount, paid state) comes from the server:
 *  - the amount is quote_housing_fasttrack(...) (payment_products + server-evaluated FairPath+),
 *  - the app only asks the server to prepare a Stripe payment for THIS application,
 *  - "paid" is displayed only after the Stripe webhook has settled the order on the server.
 * Payment never changes the application's status; the member still reviews and submits it afterwards.
 */
export default function FastTrackCheckout(){
 const {id}=useLocalSearchParams<{id:string}>();
 const [quote,setQuote]=useState<FastTrackQuote|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [phase,setPhase]=useState<Phase>('idle');
 const [message,setMessage]=useState('');
 const busy=useRef(false);

 const load=useCallback(()=>{
  if(!id)return;
  setLoading(true);setError('');
  loadFastTrackQuote(id).then(setQuote).catch(()=>setError('FastTrack pricing could not be loaded. Check your connection and try again.')).finally(()=>setLoading(false));
 },[id]);
 useFocusEffect(useCallback(()=>{load()},[load]));

 async function pay(){
  if(!id||busy.current)return;
  busy.current=true;setMessage('');setPhase('preparing');
  try{
   const prepared=await prepareFastTrackPayment(id);
   if(prepared.status==='already_paid'){load();return}
   if(prepared.status==='not_configured'||prepared.status==='error'){setMessage(prepared.message);return}
   if(prepared.status==='processing'){await settle(prepared.transactionId);return}

   const sheet=await presentPaymentSheetFor(prepared.payment);
   if(sheet.status==='canceled'){setMessage('Payment cancelled. You were not charged.');return}
   if(sheet.status==='error'){setMessage(sheet.message);return}
   await settle(prepared.payment.transaction_id);
  }finally{busy.current=false;setPhase('idle')}
 }

 // The sheet closing is NOT proof of payment. Wait for the server (Stripe webhook) to record it.
 async function settle(transactionId:string){
  setPhase('confirming');
  const result=await waitForPaymentSettlement(transactionId);
  if(result==='succeeded'){setMessage('Payment confirmed.');load();return}
  if(result==='failed'){setMessage('The payment was declined. You were not charged. Try another payment method.');return}
  if(result==='canceled'){setMessage('The payment was cancelled. You were not charged.');return}
  setMessage('We have not received confirmation yet. This can take a minute. Leave this screen open or check Payments — you will not be charged twice.');
 }

 const paid=quote?.status==='paid'||quote?.status==='waived';
 const configured=paymentsConfigured();
 const back=id?'/housing-apply/'+id:'/housing-applications';

 return <ScreenFrame><PageHeader eyebrow="FAIRPATH FASTTRACK" title="FastTrack checkout" backTo={back}/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   {loading?<Text style={s.state}>Loading FastTrack price…</Text>:error?<>
    <Text style={s.error}>{error}</Text>
    <Pressable style={s.retry} onPress={load}><Text style={s.retryText}>TRY AGAIN</Text></Pressable>
   </>:quote?<>
    <View style={s.hero}><InlineBadge tone="lime">FASTTRACK</InlineBadge><Text style={s.price}>{formatCents(quote.amount_due_cents)}</Text><Text style={s.sub}>ONE APPLICATION</Text></View>
    <View style={s.breakdown}>
     <Row label="FastTrack application" value={formatCents(quote.base_amount_cents)}/>
     <Row label="FairPath+ discount" value={quote.discount_cents?'- '+formatCents(quote.discount_cents):formatCents(0)}/>
     <View style={s.total}><Text style={s.totalLabel}>TOTAL DUE</Text><Text style={s.totalValue}>{formatCents(quote.amount_due_cents)}</Text></View>
    </View>
    <Text style={s.priceNote}>This price is set by FairPath's servers for your account. It cannot be changed from this screen.</Text>
    <View style={s.notice}><Lucide name="shield-check" color={C.lime} size={16}/><Text style={s.noticeText}>Paying for FastTrack does not approve your application. Property owners make their own decisions, and you still review and submit the application yourself.</Text></View>

    {paid?<>
     <View style={s.paid}><Lucide name="circle-check-big" color={C.lime} size={18}/><Text style={s.paidText}>{quote.status==='waived'?'FASTTRACK FEE WAIVED':'PAYMENT CONFIRMED'}</Text></View>
     <Pressable style={s.primary} onPress={()=>router.replace(back as never)}><Text style={s.primaryText}>RETURN TO MY APPLICATION</Text><Lucide name="arrow-right" color={C.black} size={16}/></Pressable>
    </>:!quote.payment_enforced?<View style={s.dev}>
     <Text style={s.devTitle}>NO PAYMENT IS REQUIRED YET</Text>
     <Text style={s.devBody}>FairPath is not collecting the FastTrack fee in this build, so you can submit your application without paying. Nothing will be charged.</Text>
     {configured?<Pressable style={[s.secondary]} onPress={()=>void pay()} disabled={phase!=='idle'}><Text style={s.secondaryText}>{phase==='idle'?'TEST THE PAYMENT SHEET':'WORKING…'}</Text></Pressable>:null}
    </View>:configured?<>
     <Pressable accessibilityRole="button" style={[s.primary,phase!=='idle'&&s.primaryOff]} onPress={()=>void pay()} disabled={phase!=='idle'}>
      <Text style={s.primaryText}>{phase==='preparing'?'PREPARING…':phase==='confirming'?'CONFIRMING PAYMENT…':'PAY '+formatCents(quote.amount_due_cents)}</Text><Lucide name="lock" color={C.black} size={15}/>
     </Pressable>
     <Text style={s.methods}>Pay with a card, or Apple Pay / Google Pay when your device supports it. Card details go directly to Stripe; FairPath never sees or stores them.</Text>
    </>:<View style={s.pending}><Text style={s.pendingTitle}>PAYMENTS ARE NOT CONNECTED</Text><Text style={s.pendingBody}>The server requires payment, but card payments are not configured in this build. Nothing was charged.</Text></View>}

    {message?<Text style={s.message}>{message}</Text>:null}
    <Pressable style={s.link} onPress={()=>router.push('/payments' as never)}><Text style={s.linkText}>VIEW PAYMENT HISTORY</Text></Pressable>
   </>:null}
  </ScrollView>
 </ScreenFrame>
}
function Row({label,value}:{label:string;value:string}){return <View style={s.row}><Text style={s.rowLabel}>{label}</Text><Text style={s.rowValue}>{value}</Text></View>}
const s=StyleSheet.create({
 content:{padding:L.mobileGutter,paddingBottom:40},state:{color:C.mutedStrong},error:{color:C.danger},
 retry:{height:44,backgroundColor:C.lime,alignItems:'center',justifyContent:'center',marginTop:14},retryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},
 hero:{borderBottomWidth:1,borderBottomColor:C.borderStrong,paddingBottom:18},price:{color:C.white,fontFamily:F.black,fontSize:38,marginTop:12},sub:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1,marginTop:2},
 breakdown:{marginTop:18},row:{height:42,borderBottomWidth:1,borderBottomColor:C.border,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},rowLabel:{color:C.mutedStrong,fontSize:10},rowValue:{color:C.white,fontFamily:F.extraBold,fontSize:10},
 total:{height:54,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},totalLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},totalValue:{color:C.white,fontFamily:F.black,fontSize:20},
 priceNote:{color:C.muted,fontSize:9,lineHeight:14,marginTop:2},
 notice:{flexDirection:'row',gap:10,borderWidth:1,borderColor:'#526F2B',backgroundColor:'#0F150B',padding:13,marginTop:16},noticeText:{color:C.mutedStrong,fontSize:10,lineHeight:15,flex:1},
 paid:{flexDirection:'row',gap:10,alignItems:'center',marginTop:18},paidText:{color:C.lime,fontFamily:F.extraBold,fontSize:10,letterSpacing:1},
 primary:{height:52,backgroundColor:C.lime,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginTop:18},primaryOff:{opacity:.6},primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:10,letterSpacing:.9},
 secondary:{height:44,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center',marginTop:12},secondaryText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},
 methods:{color:C.muted,fontSize:9,lineHeight:14,marginTop:10},
 dev:{borderWidth:1,borderColor:C.borderStrong,padding:14,marginTop:18},devTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},devBody:{color:C.mutedStrong,fontSize:10,lineHeight:16,marginTop:6},
 pending:{borderWidth:1,borderColor:C.lime,padding:14,marginTop:18},pendingTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},pendingBody:{color:C.mutedStrong,fontSize:10,lineHeight:16,marginTop:6},
 message:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginTop:14},
 link:{marginTop:22,alignItems:'center',paddingVertical:8},linkText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9}
});
