import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { nextUploadState, type UploadState } from '@/core/documents/upload-pipeline';

// Secure storage and the file picker are not connected in this build. Until they are, the choose-file action stays
// disabled and the screen says so. The state machine is still exercised by the retry path once a real upload exists.
const STORAGE_CONNECTED = false;

const STEP_TEXT: Record<UploadState['step'], string> = {
  idle: 'Choose a PDF, JPEG, PNG or HEIC file. Your original is kept as uploaded.',
  uploading: 'Uploading…',
  extracting: 'Reading the document. This can take a minute.',
  ready_for_review: 'Ready. Review each detail before using it.',
  failed: 'The upload did not finish.',
};

export default function DocumentUploadScreen() {
  const s = useThemedStyles(styles);
  const [state, setState] = useState<UploadState>({ step: 'idle' });

  // Retry path: a failed upload returns to uploading. Kept honest by the pipeline rules.
  const retry = () => setState((prev) => nextUploadState(prev, { type: 'retry' }));

  return (
    <ScreenFrame>
      <PageHeader eyebrow="DOCUMENTS" title="Upload a document" backTo="/documents" />
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.banner}>
          <Text style={s.bannerTitle}>Secure upload</Text>
          <Text style={s.body}>
            Documents stay private. Only you can see them until you choose to share. Nothing is shared automatically, and extracted details are not treated as correct until you confirm them.
          </Text>
        </View>

        <View style={s.card} accessibilityLiveRegion="polite" accessibilityLabel={`Upload status: ${STEP_TEXT[state.step]}`}>
          <Text style={s.cardTitle}>{state.step === 'failed' ? 'Upload stopped' : statusTitle(state)}</Text>
          <Text style={s.body}>{STEP_TEXT[state.step]}</Text>
          {state.step === 'failed' ? <Text style={s.error} accessibilityRole="alert">{state.message}</Text> : null}
          {state.step === 'failed' && state.retryable ? (
            <Pressable style={s.primary} accessibilityRole="button" accessibilityLabel="Try the upload again" onPress={retry}>
              <Text style={s.primaryText}>Try again</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={STORAGE_CONNECTED ? s.primary : s.disabled}
          accessibilityRole="button"
          accessibilityLabel="Choose a file to upload"
          accessibilityState={{ disabled: !STORAGE_CONNECTED }}
          disabled={!STORAGE_CONNECTED}
        >
          <Text style={STORAGE_CONNECTED ? s.primaryText : s.disabledText}>Choose a file</Text>
        </Pressable>
        {!STORAGE_CONNECTED ? (
          <Text style={s.body}>Uploading is unavailable until secure document storage is connected for this build.</Text>
        ) : null}
      </ScrollView>
    </ScreenFrame>
  );
}

function statusTitle(state: UploadState): string {
  switch (state.step) {
    case 'idle': return 'Ready when you are';
    case 'uploading': return `Uploading (attempt ${state.attempt})`;
    case 'extracting': return 'Reading details';
    case 'ready_for_review': return 'Ready for review';
    default: return '';
  }
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 15 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 8 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  error: { color: t.text, fontSize: 15, fontWeight: '700' as const },
  primary: { minHeight: 48, justifyContent: 'center' as const, alignItems: 'center' as const, backgroundColor: t.accent },
  primaryText: { color: t.onAccent, fontWeight: '700' as const },
  disabled: { minHeight: 48, justifyContent: 'center' as const, alignItems: 'center' as const, borderWidth: 1, borderColor: t.border },
  disabledText: { color: t.textMuted, fontWeight: '700' as const },
});
