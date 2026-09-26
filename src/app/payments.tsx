import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader, InlineBadge } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadMyPayments, type MyPayment } from '@/core/payments/payments-service';
import { formatCents, paymentPurposeLabel, paymentStatusLabel, receiptRef } from '@/core/payments/payment-format';

/** Payment history. Deliberately separate from application status history: a payment is never an approval. */
export default function Payments(){
 const [rows,setRows]=useState<MyPayment[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const load=useCallback(()=>{
  setLoading(true);setError('');
  loadMyPayments().then(setRows).catch(e=>setError(e instanceof Error&&e.message==='SIGNED_OUT'?'Sign in to see your payments.':'Payments could not be loaded.')).finally(()=>setLoading(false));
 },[]);
 useFocusEffect(useCallback(()=>{load()},[load]));

 return <ScreenFrame><PageHeader eyebrow="FAIRPATH" title="Payments" backTo="/me"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <Text style={s.intro}>Receipts for FairPath services you paid for. Payment status is separate from your application status. FairPath+ membership billing is handled by the App Store or Google Play.</Text>
   {loading?<Text style={s.state}>Loading payments…</Text>:error?<>
    <Text style={s.error}>{error}</Text><Pressable style={s.retry} onPress={load}><Text style={s.retryText}>TRY AGAIN</Text></Pressable>
   </>:rows.length===0?<View style={s.empty}><Text style={s.emptyTitle}>NO PAYMENTS YET</Text><Text style={s.emptyBody}>When you pay for a FairPath service, your receipt appears here.</Text></View>
   :rows.map(p=><View key={p.id} style={s.card}>
    <View style={s.top}><InlineBadge tone={p.status==='succeeded'?'lime':undefined}>{paymentStatusLabel(p.status)}</InlineBadge><Text style={s.date}>{new Date(p.created_at).toLocaleDateString()}</Text></View>
    <Text style={s.title}>{paymentPurposeLabel(p.purpose)}</Text>
    <Text style={s.amount}>{formatCents(p.amount_cents,p.currency)}</Text>
    <Text style={s.ref}>REFERENCE {receiptRef(p.id)}{p.succeeded_at?' · PAID '+new Date(p.succeeded_at).toLocaleString():''}</Text>
    {p.failure_code&&p.status==='failed'?<Text style={s.fail}>Declined ({p.failure_code.replaceAll('_',' ')}). You were not charged.</Text>:null}
    {p.refunds.map(r=><Text key={r.id} style={s.refund}>REFUND {formatCents(r.amount_cents,p.currency)} · {new Date(r.created_at).toLocaleDateString()}</Text>)}
    {p.purpose==='housing_fasttrack'?<Pressable style={s.link} onPress={()=>router.push(('/housing-application/'+p.purpose_ref) as never)}><Text style={s.linkText}>VIEW APPLICATION</Text></Pressable>:null}
   </View>)}
  </ScrollView>
 </ScreenFrame>
}
const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingBottom:40},intro:{color:C.mutedStrong,fontSize:11,lineHeight:17,paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.border},
 state:{color:C.mutedStrong,paddingVertical:30},error:{color:C.danger,paddingVertical:20},retry:{height:44,backgroundColor:C.lime,alignItems:'center',justifyContent:'center'},retryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},
 empty:{paddingVertical:30},emptyTitle:{color:C.white,fontFamily:F.black,fontSize:18},emptyBody:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginTop:6},
 card:{paddingVertical:16,borderBottomWidth:1,borderBottomColor:C.borderStrong},top:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},date:{color:C.muted,fontSize:9},
 title:{color:C.white,fontFamily:F.extraBold,fontSize:15,marginTop:10},amount:{color:C.white,fontFamily:F.black,fontSize:24,marginTop:4},ref:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8,marginTop:6},
 fail:{color:C.danger,fontSize:10,marginTop:6},refund:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8,marginTop:6},
 link:{marginTop:10},linkText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9}
});
