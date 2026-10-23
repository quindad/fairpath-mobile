import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';

/** FastTrack housing checkout is retired; standard applications only. Deep links land here with a clear redirect. */
export default function FastTrackCheckout() {
  return (
    <ScreenFrame>
      <PageHeader eyebrow="HOUSING" title="Application checkout" backTo="/housing-applications" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <Text style={s.title}>FastTrack housing is no longer offered</Text>
        <Text style={s.body}>
          FairPath uses one standard application path for every listing. Property owners still make approval decisions — no paid path speeds that up in the app anymore.
        </Text>
        <Text style={s.body}>PAYMENTS ARE NOT CONNECTED for this retired flow.</Text>
        <Pressable accessibilityRole="button" style={s.cta} onPress={() => router.replace('/housing-applications' as never)}>
          <Text style={s.ctaText}>OPEN MY APPLICATIONS</Text>
        </Pressable>
      </ScrollView>
    </ScreenFrame>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: L.mobileGutter, paddingVertical: 24, gap: 12 },
  title: { color: C.white, fontFamily: F.extraBold, fontSize: 20, lineHeight: 26 },
  body: { color: C.mutedStrong, fontFamily: F.regular, fontSize: 12, lineHeight: 18 },
  cta: { minHeight: 48, backgroundColor: C.lime, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: C.black, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 0.9 },
});
