import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItem,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FairPathLogo } from '@/components/FairPathLogo';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { markAppIntroCompleted } from '@/core/onboarding/app-intro-storage';
import { APP_INTRO_SLIDES, type IntroSlide } from '@/core/onboarding/intro-slides';

export default function AppIntroScreen() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<IntroSlide>>(null);
  const [index, setIndex] = useState(0);
  const [pagerHeight, setPagerHeight] = useState(0);
  const last = APP_INTRO_SLIDES.length - 1;

  const compact = height < 700;
  const titleSize = compact ? 28 : height >= 900 ? 34 : 32;
  const titleLine = compact ? 32 : height >= 900 ? 38 : 36;

  async function finish() {
    if (replay !== '1') await markAppIntroCompleted();
    router.replace('/join' as never);
  }

  const syncIndex = useCallback(
    (offsetX: number) => {
      const i = Math.round(offsetX / width);
      if (i >= 0 && i <= last) setIndex(i);
    },
    [width, last],
  );

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    syncIndex(e.nativeEvent.contentOffset.x);
  }

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    syncIndex(e.nativeEvent.contentOffset.x);
  }

  function go(delta: number) {
    const next = Math.min(last, Math.max(0, index + delta));
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  }

  const renderSlide: ListRenderItem<IntroSlide> = ({ item }) => (
    <View
      style={[
        s.slidePage,
        {
          width,
          height: pagerHeight || undefined,
          minHeight: pagerHeight ? undefined : 280,
        },
      ]}
    >
      <View style={s.slideInner}>
        <Text style={s.eyebrow}>{item.eyebrow}</Text>
        <Text style={[s.title, { fontSize: titleSize, lineHeight: titleLine }]}>{item.title}</Text>
        <Text style={[s.body, compact && s.bodyCompact]}>{item.body}</Text>
        {item.bullets?.map((b) => (
          <Text key={b} style={s.bullet}>
            · {b}
          </Text>
        ))}
      </View>
    </View>
  );

  return (
    <View style={s.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
        <View style={s.topZone}>
          <FairPathLogo width={compact ? 140 : 156} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip introduction"
            hitSlop={8}
            style={s.skipBtn}
            onPress={() => void finish()}
          >
            <Text style={s.skip}>Skip</Text>
          </Pressable>
        </View>

        <View
          style={s.middleZone}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && h !== pagerHeight) setPagerHeight(h);
          }}
        >
          <FlatList
            ref={listRef}
            data={APP_INTRO_SLIDES}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            bounces={false}
            style={s.pager}
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            onMomentumScrollEnd={onMomentumScrollEnd}
            scrollEventThrottle={16}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            renderItem={renderSlide}
          />
        </View>

        <View style={[s.bottomZone, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.dots} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: last, now: index }}>
            {APP_INTRO_SLIDES.map((slide, i) => (
              <View key={slide.id} style={[s.dot, i === index && s.dotOn]} accessibilityElementsHidden importantForAccessibility="no" />
            ))}
          </View>
          <View style={s.nav}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous slide"
              style={[s.back, index === 0 && s.backOff]}
              disabled={index === 0}
              onPress={() => go(-1)}
            >
              <Text style={s.backText}>Back</Text>
            </Pressable>
            {index < last ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Next slide" style={s.next} onPress={() => go(1)}>
                <Text style={s.nextText}>Next</Text>
                <Text style={s.nextArrow}>→</Text>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel="Continue to join FairPath" style={s.next} onPress={() => void finish()}>
                <Text style={s.nextText}>Join FairPath</Text>
                <Text style={s.nextArrow}>→</Text>
              </Pressable>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.black },
  safe: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  topZone: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: L.mobileGutter,
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 52,
  },
  skipBtn: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  skip: { color: C.mutedStrong, fontFamily: F.bold, fontSize: 14 },
  middleZone: { flex: 1, minHeight: 200 },
  pager: { flex: 1 },
  slidePage: { justifyContent: 'center', paddingHorizontal: L.mobileGutter },
  slideInner: { maxWidth: '100%' as const },
  eyebrow: { color: C.lime, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 1.4 },
  title: { color: C.white, fontFamily: F.black, marginTop: 12, letterSpacing: -0.5 },
  body: { color: C.mutedStrong, fontSize: 15, lineHeight: 23, marginTop: 14 },
  bodyCompact: { fontSize: 14, lineHeight: 21, marginTop: 12 },
  bullet: { color: C.mutedStrong, fontSize: 13, lineHeight: 20, marginTop: 8 },
  bottomZone: {
    paddingHorizontal: L.mobileGutter,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#252825',
    gap: 16,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2A3028' },
  dotOn: { backgroundColor: C.lime, width: 22 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { minHeight: 48, minWidth: 72, justifyContent: 'center', paddingHorizontal: 4 },
  backOff: { opacity: 0.35 },
  backText: { color: C.mutedStrong, fontFamily: F.bold, fontSize: 14 },
  next: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: C.lime,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  nextText: { color: C.black, fontFamily: F.extraBold, fontSize: 15, letterSpacing: 0.3 },
  nextArrow: { color: C.black, fontSize: 20, fontFamily: F.bold },
});
