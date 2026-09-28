import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { FairPathFonts as F } from '@/constants/fairpath';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import { setNotifyHandler, type NotifyAction } from '@/core/ui/notify';
import type { ThemeTokens } from '@/core/theme/tokens';

type Dialog = { title: string; message?: string; actions: NotifyAction[] };

/**
 * Renders web notify()/confirm() calls as a themed in-app modal instead of window.alert/confirm — matches the rest
 * of FairPath's visual language (sharp corners, theme tokens, dark/light) instead of the browser's native gray box,
 * and unlike a native dialog it's part of the DOM/accessibility tree, so it can actually be driven and verified.
 * Mount once at the app root. Native (iOS/Android) is untouched: notify() still calls Alert.alert there.
 */
export function NotifyHost() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [dialog, setDialog] = useState<Dialog | null>(null);

  useEffect(() => {
    setNotifyHandler((title, message, actions) => {
      const acts = actions && actions.length ? actions : [{ text: 'OK' }];
      setDialog({ title, message, actions: acts });
    });
    return () => setNotifyHandler(null);
  }, []);

  if (!dialog) return null;
  const run = (a: NotifyAction) => { setDialog(null); a.onPress?.(); };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setDialog(null)}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>{dialog.title}</Text>
          {dialog.message ? <Text style={s.message}>{dialog.message}</Text> : null}
          <View style={s.actions}>
            {dialog.actions.map((a, i) => (
              <Pressable key={i} accessibilityRole="button" style={[s.btn, a.style === 'destructive' ? s.btnDanger : a.style === 'cancel' ? s.btnCancel : s.btnDefault]} onPress={() => run(a)}>
                <Text style={[s.btnText, a.style === 'destructive' ? s.btnTextDanger : a.style === 'cancel' ? s.btnTextCancel : s.btnTextDefault]}>{a.text.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = (t: ThemeTokens) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center' as const, justifyContent: 'center' as const, padding: 24 },
  card: { width: '100%' as const, maxWidth: 420, backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderStrong, padding: 20 },
  title: { color: t.text, fontFamily: F.extraBold, fontSize: 16, lineHeight: 21 },
  message: { color: t.textSecondary, fontFamily: F.regular, fontSize: 13, lineHeight: 19, marginTop: 8 },
  actions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 8, marginTop: 18, flexWrap: 'wrap' as const },
  btn: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  btnDefault: { backgroundColor: t.accent, borderColor: t.accent },
  btnCancel: { backgroundColor: 'transparent', borderColor: t.borderStrong },
  btnDanger: { backgroundColor: 'transparent', borderColor: '#FF6B6B' },
  btnText: { fontFamily: F.bold, fontSize: 12, letterSpacing: 0.4 },
  btnTextDefault: { color: '#0A0C0A' },
  btnTextCancel: { color: t.textSecondary },
  btnTextDanger: { color: '#FF6B6B' },
});
