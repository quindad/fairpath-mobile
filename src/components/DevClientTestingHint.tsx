import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FairPathColors as C, FairPathFonts as F } from '@/constants/fairpath';

/** DEV builds only — Expo dev client menu can float over bottom CTAs; not part of production UI. */
export function DevClientTestingHint() {
  const [open, setOpen] = useState(false);
  if (!__DEV__) return null;
  if (!open) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Show development testing note" onPress={() => setOpen(true)} style={s.chip}>
        <Text style={s.chipText}>DEV</Text>
      </Pressable>
    );
  }
  return (
    <View style={s.box}>
      <Text style={s.title}>Development build</Text>
      <Text style={s.body}>The Expo dev menu can cover buttons at the bottom. Drag it aside or scroll if a control is hard to tap. This label is not shown in production.</Text>
      <Pressable accessibilityRole="button" onPress={() => setOpen(false)}>
        <Text style={s.dismiss}>Dismiss</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  chip: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 20,
    backgroundColor: '#2A2210',
    borderWidth: 1,
    borderColor: C.lime,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: { color: C.lime, fontFamily: F.extraBold, fontSize: 9, letterSpacing: 1 },
  box: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4A4020',
    backgroundColor: '#141208',
    padding: 10,
  },
  title: { color: C.lime, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.8 },
  body: { color: C.mutedStrong, fontSize: 11, lineHeight: 16, marginTop: 4 },
  dismiss: { color: C.lime, fontFamily: F.bold, fontSize: 11, marginTop: 8 },
});
