import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';

const TYPES=['apartment','townhome','house','duplex','condo','room'];
const BED_OPTIONS=['ANY','STUDIO','1+','2+','3+','4+','5+'];
const BATH_OPTIONS=['ANY','1+','1.5+','2+','2.5+','3+','4+'];

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
 const [garage,setGarage]=useState(params.garage==='1');
 const [parking,setParking]=useState(params.parking==='1');
 const [furnished,setFurnished]=useState(params.furnished==='1');
 const [basement,setBasement]=useState(params.basement==='1');
 const [yard,setYard]=useState(params.yard==='1');
 const [balcony,setBalcony]=useState(params.balcony==='1');
 const [laundry,setLaundry]=useState(params.laundry==='1');
 const [centralAir,setCentralAir]=useState(params.centralAir==='1');
 const [moveInReady,setMoveInReady]=useState(params.moveInReady==='1');
 const [minSqft,setMinSqft]=useState(params.minSqft??'');
 const [minWalk,setMinWalk]=useState(params.minWalk??'');

 const activeCount=useMemo(()=>[
  minRent,maxRent,beds!=='ANY',baths!=='ANY',types.length>0,fastTrack,pets,accessible,garage,parking,furnished,basement,yard,balcony,laundry,centralAir,moveInReady,minSqft,minWalk
 ].filter(Boolean).length,[minRent,maxRent,beds,baths,types,fastTrack,pets,accessible,garage,parking,furnished,basement,yard,balcony,laundry,centralAir,moveInReady,minSqft,minWalk]);

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
  if(garage)q.set('garage','1'); if(parking)q.set('parking','1'); if(furnished)q.set('furnished','1'); if(basement)q.set('basement','1');
  if(yard)q.set('yard','1'); if(balcony)q.set('balcony','1'); if(laundry)q.set('laundry','1'); if(centralAir)q.set('centralAir','1');
  if(moveInReady)q.set('moveInReady','1'); if(minSqft)q.set('minSqft',minSqft); if(minWalk)q.set('minWalk',minWalk);
  router.replace(('/find-housing'+(q.toString()?'?'+q.toString():'')) as never);
 }

 function clear(){
  setMinRent('');setMaxRent('');setBeds('ANY');setBaths('ANY');setTypes([]);setFastTrack(false);setPets(false);setAccessible(false);
  setGarage(false);setParking(false);setFurnished(false);setBasement(false);setYard(false);setBalcony(false);setLaundry(false);setCentralAir(false);setMoveInReady(false);setMinSqft('');setMinWalk('');
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

   <FilterSection label="HOME">
    <View style={s.moneyRow}><InputBox label="MIN SQ FT" value={minSqft} onChangeText={setMinSqft} placeholder="Any"/><InputBox label="MIN WALK SCORE" value={minWalk} onChangeText={setMinWalk} placeholder="Any"/></View>
    <Toggle label="GARAGE" active={garage} onPress={()=>setGarage(v=>!v)} icon="warehouse"/>
    <Toggle label="OFF-STREET PARKING" active={parking} onPress={()=>setParking(v=>!v)} icon="car"/>
    <Toggle label="FURNISHED" active={furnished} onPress={()=>setFurnished(v=>!v)} icon="sofa"/>
    <Toggle label="BASEMENT" active={basement} onPress={()=>setBasement(v=>!v)} icon="panel-bottom"/>
    <Toggle label="YARD / OUTDOOR SPACE" active={yard} onPress={()=>setYard(v=>!v)} icon="trees"/>
    <Toggle label="BALCONY / PATIO" active={balcony} onPress={()=>setBalcony(v=>!v)} icon="sun"/>
    <Toggle label="LAUNDRY" active={laundry} onPress={()=>setLaundry(v=>!v)} icon="washing-machine"/>
    <Toggle label="CENTRAL AIR" active={centralAir} onPress={()=>setCentralAir(v=>!v)} icon="snowflake"/>
    <Toggle label="MOVE-IN READY" active={moveInReady} onPress={()=>setMoveInReady(v=>!v)} icon="key-round"/>
   </FilterSection>

   <FilterSection label="NEIGHBORHOOD & SCHOOLS">
    <Text style={s.helper}>Walk, transit and bike scores will appear when verified provider data is available. Nearby schools will be shown on each home with source attribution — FairPath will not invent a neighborhood rating.</Text>
   </FilterSection>

   <FilterSection label="FAIRPATH & ACCESS">
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
 helper:{color:C.mutedStrong,fontSize:11,lineHeight:17,marginBottom:4},grid:{gap:8},toggle:{minHeight:44,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:11,flexDirection:'row',alignItems:'center',gap:9,marginBottom:8},toggleActive:{borderColor:'#526F2B',backgroundColor:'#10150C'},toggleText:{flex:1,color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.45},toggleTextActive:{color:C.white},check:{width:20,height:20,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},checkActive:{backgroundColor:C.lime,borderColor:C.lime},
 clear:{height:44,marginTop:18,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},clearText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:8,letterSpacing:.9},
 apply:{height:50,marginTop:9,backgroundColor:C.lime,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},applyText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:.9},count:{minWidth:26,height:26,borderWidth:1,borderColor:'#222',alignItems:'center',justifyContent:'center'},countText:{color:C.black,fontFamily:F.extraBold,fontSize:9}
});