import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { notify } from '@/core/ui/notify';
import * as DocumentPicker from 'expo-document-picker';
import { Lucide } from '@react-native-vector-icons/lucide';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';
import {
  deleteHousingApplicationDocument,
  HousingApplicationDocument,
  loadHousingApplicationDocuments,
  uploadHousingApplicationDocument,
} from '@/core/opportunities/opportunity-service';

const TYPES:HousingApplicationDocument['document_type'][]=['identity','income','employment','housing_history','other'];
const LABEL:Record<HousingApplicationDocument['document_type'],string>={
 identity:'IDENTITY',
 income:'INCOME',
 employment:'EMPLOYMENT',
 housing_history:'HOUSING HISTORY',
 other:'OTHER',
};

export function HousingApplicationDocuments({applicationId,readOnly=false,requiredTypes=[],onDocumentsChange}:{applicationId:string;readOnly?:boolean;requiredTypes?:HousingApplicationDocument['document_type'][];onDocumentsChange?:(rows:HousingApplicationDocument[])=>void}){
 const [rows,setRows]=useState<HousingApplicationDocument[]>([]);
 const [kind,setKind]=useState<HousingApplicationDocument['document_type']>('income');
 const [loading,setLoading]=useState(true);
 const [uploading,setUploading]=useState(false);

 function applyRows(next:HousingApplicationDocument[]){setRows(next);onDocumentsChange?.(next)}
 async function load(){setLoading(true);try{applyRows(await loadHousingApplicationDocuments(applicationId))}catch{}finally{setLoading(false)}}
 useEffect(()=>{void load()},[applicationId]);

 async function pick(){
  if(uploading||readOnly)return;
  const result=await DocumentPicker.getDocumentAsync({multiple:false,copyToCacheDirectory:true,type:['application/pdf','image/jpeg','image/png','image/heic','image/heif']});
  if(result.canceled)return;
  const asset=result.assets[0];
  if((asset.size??0)>10*1024*1024){notify('File too large','Use a file smaller than 10 MB.');return}
  setUploading(true);
  try{
   const response=await fetch(asset.uri);
   const bytes=await response.arrayBuffer();
   const doc=await uploadHousingApplicationDocument({applicationId,documentType:kind,fileName:asset.name,mimeType:asset.mimeType,sizeBytes:asset.size,bytes});
   applyRows([doc,...rows]);
  }catch{notify('Upload failed','The document was not added. Please try again.')}
  finally{setUploading(false)}
 }

 async function remove(doc:HousingApplicationDocument){
  notify('Remove document?','This removes the uploaded file from this application.',[
   {text:'Keep',style:'cancel'},
   {text:'Remove',style:'destructive',onPress:async()=>{try{await deleteHousingApplicationDocument(doc);applyRows(rows.filter(x=>x.id!==doc.id))}catch{notify('Could not remove','Please try again.')}}}
  ]);
 }

 return <View style={s.wrap}>
  <View style={s.head}><View><Text style={s.kicker}>APPLICATION DOCUMENTS</Text><Text style={s.title}>{readOnly?'Submitted files':'Add supporting files'}</Text></View><Text style={s.count}>{rows.length}</Text></View>
  {requiredTypes.length?<View style={s.requiredBox}><Text style={s.requiredTitle}>REQUIRED FOR THIS PROPERTY</Text><Text style={s.requiredText}>{requiredTypes.map(x=>LABEL[x]).join(' · ')}</Text></View>:null}
  {!readOnly?<><Text style={s.help}>PDF, JPG, PNG, HEIC · max 10 MB. Do not upload Social Security cards, bank passwords, or unrelated sensitive records.</Text>
  <View style={s.types}>{TYPES.map(x=><Pressable key={x} style={[s.type,kind===x&&s.typeOn]} onPress={()=>setKind(x)}><Text style={[s.typeText,kind===x&&s.typeTextOn]}>{LABEL[x]}</Text></Pressable>)}</View>
  <Pressable style={[s.upload,uploading&&s.disabled]} onPress={()=>void pick()} disabled={uploading}><Text style={s.uploadText}>{uploading?'UPLOADING…':'CHOOSE FILE'}</Text><Lucide name="upload" color={C.black} size={15}/></Pressable></>:null}

  {loading?<Text style={s.empty}>Loading documents…</Text>:rows.length===0?<Text style={s.empty}>No documents uploaded.</Text>:rows.map(doc=><View key={doc.id} style={s.row}>
   <View style={s.icon}><Lucide name="file-text" color={C.lime} size={14}/></View>
   <View style={s.copy}><Text style={s.name} numberOfLines={1}>{doc.file_name}</Text><Text style={s.meta}>{LABEL[doc.document_type]} · {doc.status.toUpperCase()}{doc.size_bytes?' · '+formatSize(doc.size_bytes):''}</Text>{doc.rejection_reason?<Text style={s.reject}>{doc.rejection_reason}</Text>:null}</View>
   {!readOnly&&doc.status==='uploaded'?<Pressable style={s.remove} onPress={()=>remove(doc)}><Lucide name="trash-2" color={C.mutedStrong} size={14}/></Pressable>:null}
  </View>)}
 </View>
}
function formatSize(bytes:number){if(bytes<1024)return bytes+' B';if(bytes<1024*1024)return Math.round(bytes/1024)+' KB';return (bytes/1024/1024).toFixed(1)+' MB'}
const s=StyleSheet.create({wrap:{borderWidth:1,borderColor:C.borderStrong,padding:13,marginTop:18},head:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start'},kicker:{color:C.lime,fontFamily:F.extraBold,fontSize:7,letterSpacing:1},title:{color:C.white,fontFamily:F.black,fontSize:17,marginTop:4},count:{color:C.lime,fontFamily:F.black,fontSize:18},requiredBox:{borderLeftWidth:2,borderLeftColor:C.lime,paddingLeft:9,marginTop:10},requiredTitle:{color:C.lime,fontFamily:F.extraBold,fontSize:6.5,letterSpacing:.8},requiredText:{color:C.white,fontSize:9,marginTop:4},help:{color:C.muted,fontSize:8.5,lineHeight:13,marginTop:7},types:{flexDirection:'row',flexWrap:'wrap',gap:6,marginTop:11},type:{minHeight:34,borderWidth:1,borderColor:C.borderStrong,paddingHorizontal:9,alignItems:'center',justifyContent:'center'},typeOn:{borderColor:C.lime,backgroundColor:'#10150C'},typeText:{color:C.mutedStrong,fontFamily:F.extraBold,fontSize:6.5},typeTextOn:{color:C.lime},upload:{height:44,backgroundColor:C.lime,flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:12,marginTop:10},disabled:{opacity:.55},uploadText:{color:C.black,fontFamily:F.extraBold,fontSize:8,letterSpacing:.8},empty:{color:C.muted,fontSize:9,paddingVertical:14},row:{minHeight:52,borderTopWidth:1,borderTopColor:C.border,flexDirection:'row',alignItems:'center',gap:8},icon:{width:24,alignItems:'center'},copy:{flex:1,minWidth:0},name:{color:C.white,fontFamily:F.extraBold,fontSize:10},meta:{color:C.muted,fontSize:7.5,marginTop:3},reject:{color:C.danger,fontSize:8,marginTop:3},remove:{width:34,height:34,alignItems:'center',justifyContent:'center'}});
