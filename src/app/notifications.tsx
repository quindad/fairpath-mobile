import { StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { Lucide } from '@react-native-vector-icons/lucide';

export default function Notifications(){
 return <ScreenFrame><PageHeader eyebrow="FAIRPATH" title="Notifications"/><View style={s.content}><View style={s.icon}><Lucide name="bell" color={C.lime} size={20}/></View><Text style={s.title}>You’re all caught up.</Text><Text style={s.body}>Job, housing, Marketplace and FairPath updates will appear here when notification delivery is connected.</Text></View></ScreenFrame>
}
const s=StyleSheet.create({content:{paddingHorizontal:L.mobileGutter,paddingTop:36},icon:{width:42,height:42,borderWidth:1,borderColor:C.borderStrong,alignItems:'center',justifyContent:'center'},title:{color:C.white,fontFamily:F.extraBold,fontSize:22,marginTop:18},body:{color:C.muted,fontFamily:F.regular,fontSize:11,lineHeight:18,marginTop:7,maxWidth:330}});