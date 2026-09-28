import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { notify } from '@/core/ui/notify';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { getMarketCoverage, isLowCoverage, joinEarlyAccess, type MarketCoverage } from '@/core/coverage/coverage-service';
import { isZip } from '@/core/opportunities/opportunity-service';

const NATIONAL_TOOLS: [string, string, string][] = [
 ['Explore Resources', 'Food, housing help, ID, transportation and more, wherever you are.', '/resources'],
 ['Build your resume', 'Create a clean, ATS-friendly resume in minutes.', '/resume-studio'],
 ['Review your credit', 'Upload a report and start preparing disputes.', '/credit'],
 ['Explore Record Relief', 'See what expungement or sealing may apply to your case.', '/record-relief'],
 ['Ask FairPath AI', 'Get next steps based on what you have already built.', '/fairpath-ai'],
 ['Complete your Opportunity Profile', 'The more it knows, the faster you move once your market opens.', '/opportunity-profile'],
];

export default function EarlyAccess(){
 const params=useLocalSearchParams<{zip?:string;referral?:string}>();
 const [zip,setZip]=useState(typeof params.zip==='string'?params.zip:'');
 const [coverage,setCoverage]=useState<MarketCoverage|null>(null);
 const [checking,setChecking]=useState(false);
 const [consent,setConsent]=useState(true);
 const [joining,setJoining]=useState(false);
 const [joined,setJoined]=useState(false);

 useEffect(()=>{ if(isZip(zip)) void check(zip); },[]); // eslint-disable-line react-hooks/exhaustive-deps

 async function check(z:string){
  if(!isZip(z)){ notify('Enter a valid ZIP','FairPath needs a 5-digit ZIP code to check coverage.'); return; }
  setChecking(true); setCoverage(null); setJoined(false);
  try{ setCoverage(await getMarketCoverage(z)); }
  catch{ notify('Could not check coverage','Please try again.'); }
  finally{ setChecking(false); }
 }

 async function join(){
  if(!isZip(zip)||joining) return;
  setJoining(true);
  try{
   const r=await joinEarlyAccess(zip, consent, typeof params.referral==='string'?params.referral:null);
   setJoined(true);
   if(r.alreadyEnrolled) notify('Already on the list', 'FairPath already has you down for this ZIP — you\'ll hear from us as soon as your market opens.');
  }catch(e){
   if(e instanceof Error && e.message==='SIGNED_OUT'){ router.push(('/sign-up?returnTo='+encodeURIComponent('/early-access?zip='+zip)) as never); return; }
   notify('Could not join Early Access','Please try again.');
  }finally{ setJoining(false); }
 }

 const showLowCoverage = coverage && isLowCoverage(coverage.status);
 const showFullCoverage = coverage && !isLowCoverage(coverage.status);

 return <ScreenFrame><PageHeader eyebrow="FAIRPATH IS EXPANDING" title="Early Access" backTo="/find-jobs"/>
  <FormScrollView contentContainerStyle={s.content}>
   <Text style={s.label}>YOUR ZIP CODE</Text>
   <View style={s.zipRow}>
    <TextInput style={s.zipInput} value={zip} onChangeText={setZip} keyboardType="number-pad" maxLength={5} placeholder="43215" placeholderTextColor={C.muted}/>
    <Pressable style={s.checkBtn} onPress={()=>void check(zip)} disabled={checking}><Text style={s.checkBtnText}>{checking?'CHECKING…':'CHECK'}</Text></Pressable>
   </View>

   {showFullCoverage?<View style={s.fullCard}>
    <Lucide name="check-circle-2" color={C.lime} size={22}/>
    <Text style={s.fullTitle}>FairPath is active in {coverage.marketLabel ?? 'your area'}.</Text>
    <Text style={s.fullBody}>You do not need Early Access here — head back and search normally.</Text>
    <Pressable style={s.primary} onPress={()=>router.push('/find-jobs')}><Text style={s.primaryText}>SEARCH JOBS</Text></Pressable>
   </View>:null}

   {showLowCoverage&&!joined?<View style={s.card}>
    <Text style={s.cardEyebrow}>FAIRPATH IS BUILDING IN YOUR AREA</Text>
    <Text style={s.cardTitle}>{coverage.marketLabel ? 'We\'re still building coverage in '+coverage.marketLabel+'.' : 'We don\'t have enough verified opportunities near '+zip+' yet.'}</Text>
    <Text style={s.cardBody}>{coverage.statusNote ?? 'FairPath is actively adding employers, housing partners and local resources. That does not mean nothing is here for you today.'}</Text>
    {coverage.earlyAccessBenefitDays?<View style={s.benefit}><Lucide name="gift" color={C.lime} size={14}/><Text style={s.benefitText}>Join now and get {coverage.earlyAccessBenefitDays} days of FairPath+ free the moment this market opens.</Text></View>:null}
    <View style={s.consentRow}>
     <Switch value={consent} onValueChange={setConsent} trackColor={{false:C.borderStrong,true:C.lime}} thumbColor={C.white}/>
     <Text style={s.consentText}>Notify me when FairPath launches here</Text>
    </View>
    <Pressable style={s.primary} onPress={()=>void join()} disabled={joining}>
     <Text style={s.primaryText}>{joining?'JOINING…':'JOIN EARLY ACCESS'}</Text>
     <Lucide name="arrow-right" color={C.black} size={15}/>
    </Pressable>
   </View>:null}

   {joined?<View style={s.successCard}>
    <Lucide name="check-circle-2" color={C.lime} size={26}/>
    <Text style={s.successTitle}>YOU'RE ON THE LIST</Text>
    <Text style={s.successBody}>FairPath will notify you the moment verified opportunities are ready in your area. Nothing else changes about your account.</Text>
   </View>:null}

   {(showLowCoverage||joined)?<>
    <Text style={s.sectionLabel}>KEEP GOING — THESE WORK EVERYWHERE</Text>
    {NATIONAL_TOOLS.map(([title,body,href])=><Pressable key={href} style={s.toolRow} onPress={()=>router.push(href as never)}>
     <View style={s.toolCopy}><Text style={s.toolTitle}>{title}</Text><Text style={s.toolBody}>{body}</Text></View>
     <Lucide name="arrow-right" color={C.lime} size={16}/>
    </Pressable>)}
   </>:null}
  </FormScrollView>
 </ScreenFrame>;
}

const s=StyleSheet.create({
 content:{padding:L.mobileGutter,paddingBottom:48},
 label:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1,marginBottom:7},
 zipRow:{flexDirection:'row',gap:8},
 zipInput:{flex:1,height:48,borderWidth:1,borderColor:C.borderStrong,color:C.white,paddingHorizontal:12,fontSize:15,fontFamily:F.extraBold},
 checkBtn:{height:48,paddingHorizontal:16,backgroundColor:C.white+'12',borderWidth:1,borderColor:C.borderStrong,justifyContent:'center'},
 checkBtnText:{color:C.white,fontFamily:F.extraBold,fontSize:9,letterSpacing:.6},
 card:{marginTop:22,borderWidth:1,borderColor:C.borderStrong,backgroundColor:'#0A0C0A',padding:16},
 cardEyebrow:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1,marginBottom:8},
 cardTitle:{color:C.white,fontFamily:F.extraBold,fontSize:16,lineHeight:22,marginBottom:8},
 cardBody:{color:C.mutedStrong,fontSize:12,lineHeight:18},
 benefit:{flexDirection:'row',alignItems:'center',gap:8,marginTop:14,padding:10,borderWidth:1,borderColor:C.lime+'55',backgroundColor:'#10150C'},
 benefitText:{color:C.lime,fontSize:11,fontFamily:F.extraBold,flex:1,lineHeight:15},
 consentRow:{flexDirection:'row',alignItems:'center',gap:10,marginTop:16},
 consentText:{color:C.mutedStrong,fontSize:11,flex:1},
 primary:{height:50,backgroundColor:C.lime,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:18},
 primaryText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.8},
 fullCard:{marginTop:22,borderWidth:1,borderColor:C.lime+'55',backgroundColor:'#0A0C0A',padding:18,alignItems:'flex-start',gap:8},
 fullTitle:{color:C.white,fontFamily:F.extraBold,fontSize:15,lineHeight:21},
 fullBody:{color:C.mutedStrong,fontSize:12,lineHeight:17},
 successCard:{marginTop:22,borderWidth:1,borderColor:C.lime+'55',backgroundColor:'#0A0C0A',padding:20,alignItems:'flex-start',gap:8},
 successTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:13,letterSpacing:1},
 successBody:{color:C.mutedStrong,fontSize:12,lineHeight:18},
 sectionLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:8,letterSpacing:1,marginTop:30,marginBottom:10},
 toolRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',minHeight:56,borderBottomWidth:1,borderBottomColor:C.border,paddingVertical:10},
 toolCopy:{flex:1,paddingRight:12},
 toolTitle:{color:C.white,fontFamily:F.extraBold,fontSize:12},
 toolBody:{color:C.mutedStrong,fontSize:10,marginTop:3,lineHeight:14},
});
