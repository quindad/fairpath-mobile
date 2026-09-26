import { Redirect, useLocalSearchParams } from 'expo-router';

/** Filters now live in the Find Housing filter sheet. This keeps old deep links working. */
export default function HousingFiltersRedirect(){
 const params=useLocalSearchParams<Record<string,string>>();
 const q=new URLSearchParams();
 for(const [k,v] of Object.entries(params))if(typeof v==='string'&&v)q.set(k,v);
 return <Redirect href={('/find-housing'+(q.toString()?'?'+q.toString():'')) as never}/>;
}
