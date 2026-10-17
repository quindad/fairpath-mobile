import { Linking } from 'react-native';
import { hasValidCoordinates } from '@/core/location/map-data';

export function googleMapsSearchUrl(query:string){
  return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
export async function openGoogleMaps(query:string){
  const url=googleMapsSearchUrl(query);
  const supported=await Linking.canOpenURL(url);
  if(!supported) throw new Error('MAPS_UNAVAILABLE');
  await Linking.openURL(url);
}

export function googleMapsDirectionsUrl(destination:{latitude?:number|null;longitude?:number|null;query?:string|null}){
  const value=hasValidCoordinates(destination)
    ? `${Number(destination.latitude)},${Number(destination.longitude)}`
    : destination.query?.trim();
  if(!value)throw new Error('MAP_DESTINATION_UNAVAILABLE');
  return 'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(value);
}

export async function openGoogleMapsDirections(destination:{latitude?:number|null;longitude?:number|null;query?:string|null}){
  const url=googleMapsDirectionsUrl(destination);
  if(!await Linking.canOpenURL(url))throw new Error('MAPS_UNAVAILABLE');
  await Linking.openURL(url);
}
