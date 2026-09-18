import { Linking } from 'react-native';

export function googleMapsSearchUrl(query:string){
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
export async function openGoogleMaps(query:string){
  const url=googleMapsSearchUrl(query);
  const supported=await Linking.canOpenURL(url);
  if(!supported) throw new Error('MAPS_UNAVAILABLE');
  await Linking.openURL(url);
}
