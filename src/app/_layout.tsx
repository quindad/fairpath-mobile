import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

void SplashScreen.preventAutoHideAsync();

const PUBLIC_BROWSE=(path:string)=>path==='/'||path==='/find-jobs'||path.startsWith('/job/')||path==='/find-housing'||path.startsWith('/housing/')||path==='/sign-in'||path==='/sign-up'||path==='/forgot-password'||path==='/reset-password';

export default function RootLayout() {
  const pathname=usePathname();
  const [authReady,setAuthReady]=useState(false);
  const [signedIn,setSignedIn]=useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(()=>{
    let active=true;
    supabase.auth.getUser().then(({data})=>{if(active){setSignedIn(Boolean(data.user));setAuthReady(true)}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{if(active){setSignedIn(Boolean(session?.user));setAuthReady(true)}});
    return()=>{active=false;subscription.unsubscribe()};
  },[]);

  useEffect(()=>{
    if(!authReady||signedIn||PUBLIC_BROWSE(pathname))return;
    router.replace(('/sign-in?returnTo='+encodeURIComponent(pathname)) as never);
  },[authReady,signedIn,pathname]);

  if ((!fontsLoaded && !fontError)||!authReady) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#090A09' },
        animation: 'fade',
      }}
    />
  );
}
