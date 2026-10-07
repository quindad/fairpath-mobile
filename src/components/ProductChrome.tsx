import { router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FairPathFonts as F, FairPathLayout as L, FairPathRadius as R } from '@/constants/fairpath';
import { ForcedDarkScope, useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import { isThemedRoute } from '@/core/theme/themed-routes';
import type { ThemeTokens } from '@/core/theme/tokens';

/**
 * Shared chrome, fully on semantic theme tokens. Legacy screens (routes not in THEMED_ROUTES) are wrapped in a
 * forced-dark scope by ScreenFrame, so these components look exactly as before for them.
 */

/** True while a ScreenFrame is already rendering the global nav, so a stray nested <BottomNav/> renders nothing. */
const NavProvided=createContext(false);

/**
 * Every screen renders inside ScreenFrame, and ScreenFrame is the ONLY place the
 * global bottom navigation is mounted. Anything rendered inside it that is
 * pinned to the bottom must sit in normal flow above the nav (never
 * position:'absolute' with bottom:0, which lands behind the nav).
 */
export function ScreenFrame({children,showNav=true}:{children:React.ReactNode;showNav?:boolean}){
  const pathname=usePathname();
  const frame=<Frame showNav={showNav}>{children}</Frame>;
  return isThemedRoute(pathname)?frame:<ForcedDarkScope>{frame}</ForcedDarkScope>;
}
function Frame({children,showNav}:{children:React.ReactNode;showNav:boolean}){
  const s=useThemedStyles(styles);
  const {tokens}=useFairPathTheme();
  return <View style={s.screen}><StatusBar style={tokens.scheme==='dark'?'light':'dark'}/><SafeAreaView style={s.safe}><NavProvided.Provider value={showNav}>{children}</NavProvided.Provider>{showNav?<BottomNavBar/>:null}</SafeAreaView></View>;
}
export function safeBack(fallback='/home'){
  if(router.canGoBack())router.back();
  else router.replace(fallback as never);
}
export function PageHeader({eyebrow,title,onBack=true,backTo='/home',alwaysBackTo=false,trailing}:{eyebrow:string;title:string;onBack?:boolean|(()=>void);backTo?:string;alwaysBackTo?:boolean;trailing?:React.ReactNode}){
  const s=useThemedStyles(styles);
  const goBack=()=>typeof onBack==='function'?onBack():alwaysBackTo?router.replace(backTo as never):safeBack(backTo);
  return <View style={s.header}>{onBack?<FairBackButton onPress={goBack}/>:null}<View style={s.headerCopy}><Text style={s.eyebrow}>{eyebrow}</Text><Text style={s.title}>{title}</Text></View>{trailing?<View style={s.trailing}>{trailing}</View>:null}</View>;
}
/**
 * The one FairPath back control (PageHeader and the auth/onboarding screens all use it).
 * It never decides where to go: callers pass router.back()/replace logic, so history and the
 * Jobs/Housing search state behind it are untouched.
 */
export function FairBackButton({onPress,label='Go back'}:{onPress:()=>void;label?:string}){
  const s=useThemedStyles(styles);
  const {tokens}=useFairPathTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={{top:8,bottom:8,left:8,right:14}} onPress={onPress} style={({pressed})=>[s.back,pressed&&s.backPressed]}><Lucide name="chevron-left" color={tokens.text} size={20}/></Pressable>;
}
export function SectionTitle({children}:{children:React.ReactNode}){const s=useThemedStyles(styles);return <Text style={s.section}>{children}</Text>}
export function SharpChip({label,active,onPress}:{label:string;active?:boolean;onPress?:()=>void}){
  const s=useThemedStyles(styles);
  return <Pressable onPress={onPress} style={[s.chip,active&&s.chipActive]}><Text style={[s.chipText,active&&s.chipTextActive]}>{label}</Text></Pressable>;
}
export function FilterStrip({children}:{children:React.ReactNode}){const s=useThemedStyles(styles);return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterStrip}>{children}</ScrollView>}
/** Guarded public export: renders nothing when a ScreenFrame already provides the nav. */
export function BottomNav(){
 const provided=useContext(NavProvided);
 return provided?null:<BottomNavBar/>;
}
function BottomNavBar(){
 const s=useThemedStyles(styles);
 const {tokens}=useFairPathTheme();
 const pathname=usePathname();
 const items:[string,string,string][]=[['house','Home','/home'],['search','Explore','/explore'],['bot','AI','/fairpath-ai'],['list-checks','My Path','/my-path'],['user','Profile','/me']];
 return <View style={s.nav} accessibilityRole="tablist" accessibilityLabel="Primary navigation" testID="primary-nav">{items.map(([icon,label,route])=>{const active=pathname===route||(route==='/explore'&&/job|housing|academy|veterans|marketplace|market|resources|find|record-relief/.test(pathname))||(route==='/fairpath-ai'&&(pathname.includes('fairpath-ai')||pathname.includes('credit-tools')));return <Pressable key={label} style={s.navItem} onPress={()=>router.replace(route as never)}><View style={[s.navIconWrap,active&&s.navIconWrapActive]}><Lucide name={icon as any} color={active?tokens.accentText:tokens.textSecondary} size={17}/></View><Text style={[s.navText,active&&s.navActive]}>{label}</Text>{active?<View style={s.navIndicator}/>:null}</Pressable>})}</View>
}
export function Divider(){const s=useThemedStyles(styles);return <View style={s.divider}/>}
export function InlineBadge({children,tone='default'}:{children:React.ReactNode;tone?:'default'|'lime'}){
 const s=useThemedStyles(styles);
 return <View style={[s.badge,tone==='lime'&&s.badgeLime]}><Text style={[s.badgeText,tone==='lime'&&s.badgeTextLime]}>{children}</Text></View>
}
const styles=(t:ThemeTokens)=>({
 screen:{flex:1,backgroundColor:t.background},safe:{flex:1,width:'100%' as const,maxWidth:L.consumerMaxWidth,alignSelf:'center' as const},
 header:{minHeight:86,paddingHorizontal:L.mobileGutter,paddingTop:14,paddingBottom:14,flexDirection:'row' as const,alignItems:'center' as const,borderBottomWidth:1,borderBottomColor:t.border},
 back:{width:40,height:40,borderRadius:2,borderWidth:1,borderColor:t.borderStrong,backgroundColor:t.input,alignItems:'center' as const,justifyContent:'center' as const,marginRight:12},backPressed:{borderColor:t.accentBorder,backgroundColor:t.accentSubtle},
 headerCopy:{flex:1,minWidth:0},eyebrow:{color:t.accentText,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.5},title:{color:t.text,fontFamily:F.black,fontSize:24,lineHeight:26,letterSpacing:-.6,marginTop:3,flexShrink:1},trailing:{marginLeft:10},
 section:{color:t.textMuted,fontFamily:F.extraBold,fontSize:9,letterSpacing:1.4,marginBottom:8},
 chip:{height:34,borderRadius:R.sm,borderWidth:1,borderColor:t.border,paddingHorizontal:12,alignItems:'center' as const,justifyContent:'center' as const,backgroundColor:t.background},
 chipActive:{backgroundColor:t.inverse,borderColor:t.inverse},chipText:{color:t.textSecondary,fontFamily:F.bold,fontSize:11},chipTextActive:{color:t.onInverse},
 filterStrip:{gap:7,paddingHorizontal:L.mobileGutter,paddingVertical:11},
 nav:{height:68,backgroundColor:t.navBackground,borderTopWidth:1,borderTopColor:t.borderStrong,flexDirection:'row' as const,paddingHorizontal:6},
 navItem:{flex:1,alignItems:'center' as const,justifyContent:'center' as const,gap:3,position:'relative' as const},navIconWrap:{width:30,height:30,borderRadius:2,alignItems:'center' as const,justifyContent:'center' as const},navIconWrapActive:{backgroundColor:t.accentSubtle,borderWidth:1,borderColor:t.accentBorder},navText:{color:t.textSecondary,fontFamily:F.semiBold,fontSize:8,letterSpacing:.2},navActive:{color:t.accentText,fontFamily:F.extraBold},navIndicator:{position:'absolute' as const,top:0,width:18,height:2,backgroundColor:t.accent},
 divider:{height:1,backgroundColor:t.border},
 badge:{alignSelf:'flex-start' as const,borderRadius:R.xs,borderWidth:1,borderColor:t.borderStrong,paddingHorizontal:7,paddingVertical:4},
 badgeLime:{borderColor:t.accentBorder,backgroundColor:t.accentSubtle},badgeText:{color:t.textSecondary,fontFamily:F.extraBold,fontSize:8,letterSpacing:.6},badgeTextLime:{color:t.accentText}
});
