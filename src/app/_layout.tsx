import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NotifyHost } from '@/components/NotifyHost';
import { PaymentsProvider } from '@/components/PaymentsProvider';
import { isPublicRoute } from '@/core/auth/public-routes';
import { ThemeProvider, useFairPathTheme } from '@/core/theme/ThemeProvider';

void SplashScreen.preventAutoHideAsync();

const PUBLIC_BROWSE=isPublicRoute;

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
    // The Lucide icon set otherwise lazy-loads its own font the first time an icon renders, via its internal dynamic
    // loader — on web that path logs "Failed to load font Lucide" (see @react-native-vector-icons/common's
    // dynamic-font-loading.js). Loading it here, up front with every other app font, avoids that path entirely.
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Lucide: require('@react-native-vector-icons/lucide/fonts/Lucide.ttf'),
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
    <ThemeProvider>
      <PaymentsProvider>
        <ThemedStack />
        <NotifyHost />
      </PaymentsProvider>
    </ThemeProvider>
  );
}

function ThemedStack() {
  const { tokens } = useFairPathTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.background },
        animation: 'fade',
      }}
    />
  );
}
