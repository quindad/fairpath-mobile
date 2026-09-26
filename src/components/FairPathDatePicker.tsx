import { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import {
  boundsForKind, daysInMonth, defaultYearFor, formatDateText, isDateWithin, monthsAllowed, parseDateText, yearsFor,
  type DateBounds, type DateKind
} from '@/core/forms/dates';

const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT=MONTHS.map(m=>m.slice(0,3).toUpperCase());
const WEEKDAYS=['S','M','T','W','T','F','S'];
type View_='year'|'month'|'day';
const YEAR_ROW=52;
const YEAR_COLS=4;

/**
 * The ONE FairPath date field. The value is always "MM/DD/YYYY" text.
 * Pick YEAR, then MONTH, then DAY: no month-by-month arrow tapping, so a birth year decades ago is three taps.
 * `kind` sets the rules (see core/forms/dates.ts): dob (past), past, future (today or later), any.
 * Bounds are enforced here (cells are disabled) and by the same helpers wherever the value is validated.
 */
export function FairPathDatePicker({label,value,onChange,kind='any',error,optional=false,minDate,maxDate}:{label:string;value:string;onChange:(value:string)=>void;kind?:DateKind;error?:string;optional?:boolean;minDate?:Date;maxDate?:Date}){
 const base=boundsForKind(kind);
 const bounds:DateBounds={min:minDate??base.min,max:maxDate??base.max};
 const selected=parseDateText(value);
 const [open,setOpen]=useState(false);
 const [view,setView]=useState<View_>('year');
 const startYear=selected?selected.getFullYear():defaultYearFor(kind,bounds);
 const [year,setYear]=useState<number>(startYear);
 const [month,setMonth]=useState<number|null>(selected?selected.getMonth():null);
 const [day,setDay]=useState<number|null>(selected?selected.getDate():null);
 const years=useMemo(()=>yearsFor(bounds,kind),[bounds.min.getTime(),bounds.max.getTime(),kind]); // eslint-disable-line react-hooks/exhaustive-deps
 const listRef=useRef<FlatList<number>|null>(null);

 function openPicker(){
  const s=parseDateText(value);
  setYear(s?s.getFullYear():defaultYearFor(kind,bounds));
  setMonth(s?s.getMonth():null);
  setDay(s?s.getDate():null);
  setView(s?'day':'year');
  setOpen(true);
 }
 function chooseYear(y:number){
  setYear(y);
  const allowed=monthsAllowed(y,bounds);
  const keptMonth=month!=null&&allowed.includes(month)?month:null;
  setMonth(keptMonth);
  if(keptMonth==null||day==null||day>daysInMonth(y,keptMonth))setDay(null);
  setView('month');
 }
 function chooseMonth(m:number){
  setMonth(m);
  if(day!=null&&day>daysInMonth(year,m))setDay(null);
  setView('day');
 }
 const chosen=month!=null&&day!=null?new Date(year,month,day):null;
 const chosenValid=chosen!=null&&isDateWithin(chosen,bounds);
 function confirm(){
  if(!chosen||!chosenValid)return;
  onChange(formatDateText(chosen));
  setOpen(false);
 }

 const dayCells=useMemo(()=>{
  if(month==null)return [] as (number|null)[];
  const first=new Date(year,month,1).getDay();
  return [...Array(first).fill(null),...Array.from({length:daysInMonth(year,month)},(_,i)=>i+1)] as (number|null)[];
 },[year,month]);
 const allowedMonths=monthsAllowed(year,bounds);
 const initialIndex=Math.max(0,years.indexOf(year));
 const longValue=selected?selected.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}):'';

 return <View style={s.wrap}>
  <View style={s.labelRow}><Text style={s.label}>{label}</Text><Text style={[s.tag,error?s.tagError:null]}>{optional?'OPTIONAL':'REQUIRED'}</Text></View>
  <Pressable accessibilityRole="button" accessibilityLabel={label+(value?', '+longValue:', select a date')} style={[s.field,error?s.fieldError:null]} onPress={openPicker}>
   <View style={{flex:1}}>
    {selected?<><Text style={s.value}>{longValue}</Text><Text style={s.valueSub}>{value}</Text></>:<Text style={s.placeholder}>Select a date</Text>}
   </View>
   <Lucide name="calendar-days" color={C.lime} size={16}/>
  </Pressable>
  {error?<Text style={s.error}>{error}</Text>:null}

  <Modal visible={open} transparent animationType="slide" onRequestClose={()=>setOpen(false)}>
   <View style={s.overlay}>
    <View style={s.sheet}>
     <View style={s.head}>
      <Text style={s.title}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close date picker" hitSlop={10} style={s.close} onPress={()=>setOpen(false)}><Lucide name="x" color={C.white} size={16}/></Pressable>
     </View>

     <View style={s.tabs}>
      {([['year','YEAR',String(year)],['month','MONTH',month!=null?MONTHS_SHORT[month]:'—'],['day','DAY',day!=null?String(day):'—']] as [View_,string,string][]).map(([k,l,v])=>
       <Pressable key={k} accessibilityRole="button" accessibilityLabel={l+' '+v} style={[s.tab,view===k&&s.tabOn]} onPress={()=>{if(k==='day'&&month==null)setView('month');else setView(k)}}>
        <Text style={[s.tabLabel,view===k&&s.tabLabelOn]}>{l}</Text><Text style={[s.tabValue,view===k&&s.tabValueOn]}>{v}</Text>
       </Pressable>)}
     </View>

     <View style={s.body}>
      {view==='year'?<FlatList
       ref={listRef}
       data={years}
       keyExtractor={y=>String(y)}
       numColumns={YEAR_COLS}
       getItemLayout={(_,row)=>({length:YEAR_ROW,offset:YEAR_ROW*row,index:row})}
       onLayout={()=>listRef.current?.scrollToOffset({offset:Math.max(0,Math.floor(initialIndex/YEAR_COLS)*YEAR_ROW-YEAR_ROW),animated:false})}
       showsVerticalScrollIndicator={false}
       renderItem={({item})=><Pressable accessibilityRole="button" accessibilityLabel={'Year '+item} style={[s.yearCell,item===year&&s.cellOn]} onPress={()=>chooseYear(item)}><Text style={[s.cellText,item===year&&s.cellTextOn]}>{item}</Text></Pressable>}
      />:null}

      {view==='month'?<View style={s.monthGrid}>
       {MONTHS.map((m,i)=>{const ok=allowedMonths.includes(i);return <Pressable key={m} accessibilityRole="button" accessibilityState={{disabled:!ok}} disabled={!ok} style={[s.monthCell,month===i&&s.cellOn,!ok&&s.cellOff]} onPress={()=>chooseMonth(i)}><Text style={[s.cellText,month===i&&s.cellTextOn,!ok&&s.cellTextOff]}>{m.toUpperCase()}</Text></Pressable>})}
      </View>:null}

      {view==='day'?<View>
       <View style={s.weekRow}>{WEEKDAYS.map((w,i)=><Text key={i} style={s.weekday}>{w}</Text>)}</View>
       <View style={s.dayGrid}>
        {dayCells.map((d,i)=>{
         if(d==null)return <View key={'b'+i} style={s.dayCell}/>;
         const ok=isDateWithin(new Date(year,month!,d),bounds);
         return <Pressable key={d} accessibilityRole="button" accessibilityState={{disabled:!ok,selected:day===d}} disabled={!ok} style={[s.dayCell,s.dayBtn,day===d&&s.cellOn,!ok&&s.cellOff]} onPress={()=>setDay(d)}><Text style={[s.cellText,day===d&&s.cellTextOn,!ok&&s.cellTextOff]}>{d}</Text></Pressable>;
        })}
       </View>
      </View>:null}
     </View>

     <View style={s.foot}>
      <Text style={s.footValue}>{chosen&&chosenValid?chosen.toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}):'Choose a year, month and day'}</Text>
      <Pressable accessibilityRole="button" style={[s.confirm,!chosenValid&&s.confirmOff]} disabled={!chosenValid} onPress={confirm}><Text style={[s.confirmText,!chosenValid&&s.confirmTextOff]}>SET DATE</Text></Pressable>
     </View>
    </View>
   </View>
  </Modal>
 </View>;
}

const s=StyleSheet.create({
 wrap:{marginTop:14},
 labelRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:7},
 label:{color:C.lime,fontFamily:F.extraBold,fontSize:8,letterSpacing:1},tag:{color:C.muted,fontFamily:F.extraBold,fontSize:6,letterSpacing:.7},tagError:{color:C.lime},
 field:{minHeight:52,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:12,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:10},fieldError:{borderColor:C.lime},
 value:{color:C.white,fontFamily:F.bold,fontSize:14},valueSub:{color:C.muted,fontSize:10,marginTop:2},placeholder:{color:C.muted,fontSize:13},
 error:{color:C.lime,fontSize:9,marginTop:5},
 overlay:{flex:1,backgroundColor:'rgba(0,0,0,.72)',justifyContent:'flex-end'},
 sheet:{backgroundColor:'#0B0D0B',borderTopWidth:1,borderColor:C.borderStrong,paddingBottom:30},
 head:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:16,paddingTop:16,paddingBottom:12},
 title:{color:C.white,fontFamily:F.black,fontSize:18,flex:1,marginRight:10},close:{width:34,height:34,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},
 tabs:{flexDirection:'row',borderTopWidth:1,borderBottomWidth:1,borderColor:C.borderStrong},
 tab:{flex:1,paddingVertical:10,alignItems:'center',borderRightWidth:1,borderRightColor:C.borderStrong},tabOn:{backgroundColor:'#10150C',borderBottomWidth:2,borderBottomColor:C.lime},
 tabLabel:{color:C.muted,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},tabLabelOn:{color:C.lime},tabValue:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:16,marginTop:3},tabValueOn:{color:C.white},
 body:{height:300,paddingHorizontal:12,paddingTop:10},
 yearCell:{flex:1,height:YEAR_ROW-8,margin:4,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
 monthGrid:{flexDirection:'row',flexWrap:'wrap'},monthCell:{width:'33.33%',height:64,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
 weekRow:{flexDirection:'row'},weekday:{flex:1,textAlign:'center',color:C.muted,fontFamily:F.extraBold,fontSize:9,paddingVertical:6},
 dayGrid:{flexDirection:'row',flexWrap:'wrap'},dayCell:{width:'14.2857%',height:40,alignItems:'center',justifyContent:'center'},dayBtn:{borderWidth:1,borderColor:'transparent'},
 cellOn:{backgroundColor:C.lime,borderColor:C.lime},cellOff:{opacity:.28},
 cellText:{color:C.white,fontFamily:F.bold,fontSize:14},cellTextOn:{color:C.black,fontFamily:F.extraBold},cellTextOff:{color:C.muted},
 foot:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingTop:12,borderTopWidth:1,borderTopColor:C.borderStrong},
 footValue:{flex:1,color:C.mutedStrong,fontSize:12},
 confirm:{height:44,paddingHorizontal:18,backgroundColor:C.lime,alignItems:'center',justifyContent:'center'},confirmOff:{backgroundColor:'#1A2114',borderWidth:1,borderColor:'#2C3823'},
 confirmText:{color:C.black,fontFamily:F.extraBold,fontSize:9,letterSpacing:1},confirmTextOff:{color:C.mutedStrong}
});
