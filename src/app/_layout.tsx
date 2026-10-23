import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold, useFonts } from '@expo-google-fonts/manrope';
import { router, Stack, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { notificationTapId, planNotificationTap } from '@/core/notifications/notification-tap';
import { syncPushRegistration } from '@/core/notifications/push-registration';

import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { NotifyHost } from '@/components/NotifyHost';
import { PaymentsProvider } from '@/components/PaymentsProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { isPublicRoute } from '@/core/auth/public-routes';
import { resolveNextRouteForSignedInUser } from '@/core/auth/post-auth-route';
import { isOnboardingFlowRoute } from '@/core/legal/onboarding-route-exemptions';
import { ThemeProvider, useFairPathTheme } from '@/core/theme/ThemeProvider';
import { captureException } from '@/core/observability/error-monitor';

// Catches JS errors OUTSIDE React's render cycle (rejected promises, async callbacks) that ErrorBoundary can't
// see, since componentDidCatch only fires for errors thrown during render/lifecycle/constructors.
if (typeof ErrorUtils !== 'undefined') {
  const prevHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    captureException(error, { isFatal: Boolean(isFatal), source: 'global-handler' });
    prevHandler?.(error, isFatal);
  });
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

void SplashScreen.preventAutoHideAsync();

const PUBLIC_BROWSE=isPublicRoute;

export default function RootLayout() {
  const pathname=usePathname();
  const pathnameRef=useRef(pathname);
  pathnameRef.current=pathname;
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
    router.replace(('/join?returnTo='+encodeURIComponent(pathname)) as never);
  },[authReady,signedIn,pathname]);

  // A signed-in user who closed the app mid-onboarding (verified email but never accepted terms, or never
  // finished onboarding) must be sent back to finish when they land on a private screen -- not dropped
  // straight into it. Public routes are exempt: browsing without finishing onboarding is allowed by design.
  useEffect(()=>{
    if(!authReady||!signedIn||(PUBLIC_BROWSE(pathname)||pathname==='/onboarding'))return;
    if(isOnboardingFlowRoute(pathname))return;
    let active=true;
    resolveNextRouteForSignedInUser().then(next=>{
      if(active&&next&&next!=='/home'&&next!==pathname)router.replace(next as never);
    }).catch(()=>{});
    return()=>{active=false};
  },[authReady,signedIn,pathname]);

  useEffect(()=>{
    if(!authReady||!signedIn)return;
    void syncPushRegistration().catch(()=>{});
    let handledTapId: string | null = null;
    const openFromResponse=(response: Notifications.NotificationResponse | null)=>{
      const tapId=notificationTapId(response);
      const plan=planNotificationTap(pathnameRef.current, tapId, handledTapId);
      if(!plan.consume || !tapId) return;
      handledTapId=tapId;
      try { Notifications.clearLastNotificationResponse(); } catch { /* Web has no native last-response store. */ }
      if(plan.route) router.push(plan.route as never);
    };
    const listener=Notifications.addNotificationResponseReceivedListener(openFromResponse);
    try { openFromResponse(Notifications.getLastNotificationResponse()); }
    catch { /* Web and runtimes without the native notifications module. */ }
    return()=>listener.remove();
  },[authReady,signedIn]);

  if ((!fontsLoaded && !fontError)||!authReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PaymentsProvider>
          <ThemedStack />
          <NotifyHost />
        </PaymentsProvider>
      </ThemeProvider>
    </ErrorBoundary>
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
