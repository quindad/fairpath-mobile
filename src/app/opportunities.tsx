import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, Linking } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader, InlineBadge, SharpChip, FilterStrip } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { BENEFIT_TYPE_LABELS, DOMAIN_LABELS, EconomicOpportunity, groupByDomain, loadMyEconomicOpportunities } from '@/core/economic-opportunities/economic-opportunities-service';

export default function OpportunitiesScreen(){
 const [opportunities,setOpportunities]=useState<EconomicOpportunity[]>([]);
 const [homeState,setHomeState]=useState<string|null>(null);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [domainFilter,setDomainFilter]=useState<string|null>(null);

 const load=useCallback(()=>{
  setLoading(true);setError('');
  loadMyEconomicOpportunities()
   .then(({opportunities,homeState})=>{setOpportunities(opportunities);setHomeState(homeState)})
   .catch(e=>setError(e?.message==='SIGNED_OUT'?'Sign in to see your opportunities.':'Opportunities could not be loaded.'))
   .finally(()=>setLoading(false));
 },[]);
 useFocusEffect(useCallback(()=>{load()},[load]));

 const domainCounts=useMemo(()=>groupByDomain(opportunities),[opportunities]);
 const visible=useMemo(()=>domainFilter?opportunities.filter(o=>o.program_domain===domainFilter):opportunities,[opportunities,domainFilter]);

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH" title="Your opportunities" backTo="/home"/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   {loading?<State text="Finding opportunities…"/>:error?<State text={error}/>:<>
    <Text style={s.count}>{opportunities.length} {opportunities.length===1?'OPPORTUNITY':'OPPORTUNITIES'} FOUND</Text>
    {!homeState?<View style={s.noticeCard}><Lucide name="map-pin" color={C.lime} size={15}/><Text style={s.noticeText}>Add your current address to see opportunities specific to your state. You're only seeing federal programs right now.</Text></View>:null}

    {domainCounts.length>1?<FilterStrip>
     <SharpChip label={'ALL · '+opportunities.length} active={!domainFilter} onPress={()=>setDomainFilter(null)}/>
     {domainCounts.map(d=><SharpChip key={d.domain} label={d.label.toUpperCase()+' · '+d.count} active={domainFilter===d.domain} onPress={()=>setDomainFilter(d.domain)}/>)}
    </FilterStrip>:null}

    {!visible.length?<View style={s.state}><Lucide name="search" color={C.mutedStrong} size={20}/><Text style={s.stateTitle}>NO VERIFIED PROGRAMS YET</Text><Text style={s.stateBody}>FairPath hasn't verified a program covering your jurisdiction in this category yet. This list grows as more states and programs are researched - it's never a sign that nothing exists.</Text></View>
     :<View style={s.list}>{visible.map(o=><OpportunityCard key={o.id} o={o}/>)}</View>}
   </>}
  </ScrollView>
 </ScreenFrame>;
}

function OpportunityCard({o}:{o:EconomicOpportunity}){
 const [open,setOpen]=useState(false);
 const valueText = o.max_value ? 'Up to $'+o.max_value.toLocaleString() : o.min_value ? 'From $'+o.min_value.toLocaleString() : 'Amount varies';
 return <Pressable style={s.card} onPress={()=>setOpen(v=>!v)}>
  <View style={s.cardTop}>
   <InlineBadge>{(DOMAIN_LABELS[o.program_domain]??o.program_domain).toUpperCase()}</InlineBadge>
   <Text style={s.status}>POTENTIAL MATCH</Text>
  </View>
  <Text style={s.title}>{o.program_name}</Text>
  <Text style={s.sub}>{BENEFIT_TYPE_LABELS[o.benefit_type]??o.benefit_type} · {o.jurisdiction_level==='federal'?'Federal':o.jurisdiction_state} · {valueText}</Text>
  {open?<View style={s.detail}>
   <Text style={s.detailBody}>FairPath matched this because its jurisdiction covers where you live. This is not an eligibility decision - FairPath has not evaluated your specific facts against this program's actual rules yet.</Text>
   {o.requires_member_documentation?<Text style={s.detailLine}>• You may need to provide documentation to apply.</Text>:null}
   {o.requires_government_certification?<Text style={s.detailLine}>• This program requires government certification before it can be claimed.</Text>:null}
   {o.requires_employer_application?<Text style={s.detailLine}>• An employer application is part of this program - FairPath cannot submit this for you.</Text>:null}
   {o.source_url?<Pressable style={s.sourceLink} onPress={()=>Linking.openURL(o.source_url!)}><Lucide name="external-link" color={C.lime} size={12}/><Text style={s.sourceLinkText}>View official source</Text></Pressable>:null}
  </View>:null}
 </Pressable>;
}

function State({text}:{text:string}){return <View style={s.state}><Text style={s.stateBody}>{text}</Text></View>}

const s=StyleSheet.create({
 content:{padding:L.mobileGutter,paddingBottom:40},
 count:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.1,marginBottom:4},
 noticeCard:{flexDirection:'row',gap:9,alignItems:'flex-start',backgroundColor:C.surface,borderWidth:1,borderColor:C.borderStrong,borderRadius:4,padding:12,marginBottom:14},
 noticeText:{flex:1,color:C.mutedStrong,fontSize:10,lineHeight:15},
 list:{marginTop:14,gap:10},
 card:{backgroundColor:C.surface,borderWidth:1,borderColor:C.borderStrong,borderLeftWidth:3,borderLeftColor:C.lime,borderRadius:4,padding:14},
 cardTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
 status:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:.8},
 title:{color:C.white,fontFamily:F.extraBold,fontSize:14,marginTop:9},
 sub:{color:C.mutedStrong,fontSize:10,marginTop:4,lineHeight:15},
 detail:{marginTop:12,paddingTop:12,borderTopWidth:1,borderTopColor:C.borderStrong,gap:6},
 detailBody:{color:C.mutedStrong,fontSize:10,lineHeight:15},
 detailLine:{color:C.mutedStrong,fontSize:10,lineHeight:15},
 sourceLink:{flexDirection:'row',alignItems:'center',gap:5,marginTop:4},
 sourceLinkText:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:.6},
 state:{paddingVertical:48,alignItems:'center',gap:10},
 stateTitle:{color:C.white,fontFamily:F.extraBold,fontSize:11,letterSpacing:.6},
 stateBody:{color:C.mutedStrong,fontSize:10,lineHeight:16,textAlign:'center',paddingHorizontal:20},
});
