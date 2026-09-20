import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';

const TYPES=['apartment','townhome','house','duplex'];
const BED_OPTIONS=['ANY','1+','2+','3+'];
const BATH_OPTIONS=['ANY','1+','2+'];

export default function HousingFilters(){
 const params=useLocalSearchParams<Record<string,string>>();
 const [minRent,setMinRent]=useState(params.minRent??'');
 const [maxRent,setMaxRent]=useState(params.maxRent??'');
 const [beds,setBeds]=useState(params.beds??'ANY');
 const [baths,setBaths]=useState(params.baths??'ANY');
 const [types,setTypes]=useState<string[]>(params.types?params.types.split(',').filter(Boolean):[]);
 const [fastTrack,setFastTrack]=useState(params.fastTrack==='1');
 const [pets,setPets]=useState(params.pets==='1');
 const [accessible,setAccessible]=useState(params.accessible==='1');

 const activeCount=useMemo(()=>[
  minRent,maxRent,beds!=='ANY',baths!=='ANY',types.length>0,fastTrack,pets,accessible
 ].filter(Boolean).length,[minRent,maxRent,beds,baths,types,fastTrack,pets,accessible]);

 function toggleType(type:string){setTypes(v=>v.includes(type)?v.filter(x=>x!==type):[...v,type])}

 function apply(){
  const q=new URLSearchParams();
  if(minRent)q.set('minRent',minRent);
  if(maxRent)q.set('maxRent',maxRent);
  if(beds!=='ANY')q.set('beds',beds);
  if(baths!=='ANY')q.set('baths',baths);
  if(types.length)q.set('types',types.join(','));
  if(fastTrack)q.set('fastTrack','1');
  if(pets)q.set('pets','1');
  if(accessible)q.set('accessible','1');
  router.replace(('/find-housing'+(q.toString()?'?'+q.toString():'')) as never);
 }

 function clear(){
  setMinRent('');setMaxRent('');setBeds('ANY');setBaths('ANY');setTypes([]);setFastTrack(false);setPets(false);setAccessible(false);
 }

 return <ScreenFrame>
  <PageHeader eyebrow="FAIRPATH HOUSING" title="Filters" backTo="/find-housing" alwaysBackTo/>
  <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
   <FilterSection label="MONTHLY RENT">
    <View style={s.moneyRow}>
     <InputBox label="MIN" value={minRent} onChangeText={setMinRent} placeholder="$0"/>
     <Text style={s.to}>TO</Text>
     <InputBox label="MAX" value={maxRent} onChangeText={setMaxRent} placeholder="No max"/>
    </View>
   </FilterSection>

   <FilterSection label="BEDROOMS"><ChoiceRow options={BED_OPTIONS} value={beds} onChange={setBeds}/></FilterSection>
   <FilterSection label="BATHROOMS"><ChoiceRow options={BATH_OPTIONS} value={baths} onChange={setBaths}/></FilterSection>

   <FilterSection label="PROPERTY TYPE">
    <View style={s.grid}>{TYPES.map(type=><Toggle key={type} label={type.toUpperCase()} active={types.includes(type)} onPress={()=>toggleType(type)}/>)}</View>
   </FilterSection>

   <FilterSection label="MORE">
    <Toggle label="FASTTRACK AVAILABLE" active={fastTrack} onPress={()=>setFastTrack(v=>!v)} icon="zap"/>
    <Toggle label="PETS ALLOWED / CONSIDERED" active={pets} onPress={()=>setPets(v=>!v)} icon="paw-print"/>
    <Toggle label="ACCESSIBILITY FEATURES" active={accessible} onPress={()=>setAccessible(v=>!v)} icon="accessibility"/>
   </FilterSection>

   <Pressable style={s.clear} onPress={clear}><Text style={s.clearText}>CLEAR ALL FILTERS</Text></Pressable>
   <Pressable style={s.apply} onPress={apply}><Text style={s.applyText}>SHOW MATCHING HOMES</Text><View style={s.count}><Text style={s.countText}>{activeCount}</Text></View></Pressable>
  </ScrollView>
 </ScreenFrame>;
}

function FilterSection({label,children}:{label:string;children:React.ReactNode}){return <View style={s.section}><Text style={s.sectionLabel}>{label}</Text>{children}</View>}
function InputBox({label,value,onChangeText,placeholder}:{label:string;value:string;onChangeText:(v:string)=>void;placeholder:string}){return <View style={s.inputBox}><Text style={s.inputLabel}>{label}</Text><TextInput value={value} onChangeText={onChangeText} keyboardType="numeric" placeholder={placeholder} placeholderTextColor={C.muted} style={s.input}/></View>}
function ChoiceRow({options,value,onChange}:{options:string[];value:string;onChange:(v:string)=>void}){return <View style={s.choiceRow}>{options.map(o=><Pressable key={o} style={[s.choice,value===o&&s.choiceActive]} onPress={()=>onChange(o)}><Text style={[s.choiceText,value===o&&s.choiceTextActive]}>{o}</Text></Pressable>)}</View>}
function Toggle({label,active,onPress,icon}:{label:string;active:boolean;onPress:()=>void;icon?:string}){return <Pressable style={[s.toggle,active&&s.toggleActive]} onPress={onPress}>{icon?<Lucide name={icon as any} color={active?C.lime:C.mutedStrong} size={14}/>:null}<Text style={[s.toggleText,active&&s.toggleTextActive]}>{label}</Text><View style={[s.check,active&&s.checkActive]}>{active?<Lucide name="check" color={C.black} size={12}/>:null}</View></Pressable>}

const s=StyleSheet.create({
 content:{paddingHorizontal:L.mobileGutter,paddingTop:6,paddingBottom:34},section:{paddingVertical:18,borderBottomWidth:1,borderBottomColor:C.borderStrong},sectionLabel:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1.2,marginBottom:11},
 moneyRow:{flexDirection:'row',alignItems:'center',gap:9},to:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},inputBox:{flex:1,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:12,paddingVertical:8},inputLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},input:{color:C.white,fontFamily:F.bold,fontSize:14,paddingVertical:5,paddingHorizontal:0},
 choiceRow:{flexDirection:'row',gap:7},choice:{flex:1,height:40,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},choiceActive:{borderColor:C.lime,backgroundColor:'#10150C'},choiceText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8},choiceTextActive:{color:C.lime},
 grid:{gap:8},toggle:{minHeight:44,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:9,marginBottom:8},toggleActive:{borderColor:'#526F2B',backgroundColor:'#10150C'},toggleText:{flex:1,color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.45},toggleTextActive:{color:C.white},check:{width:20,height:20,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},checkActive:{backgroundColor:C.lime,borderColor:C.lime},
 clear:{height:44,marginTop:18,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},clearText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},
 apply:{height:50,marginTop:9,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},applyText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},count:{minWidth:26,height:26,borderWidth:1,borderColor:'#222',alignItems:'center',justifyContent:'center'},countText:{color:C.black,fontFamily:F.extraBold,fontSize:9}
});