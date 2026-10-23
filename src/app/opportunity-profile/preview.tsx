import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { ProfessionalProfileCard } from '@/components/opportunity/ProfessionalProfileCard.tsx';
import { SecondaryButton, StatusLine } from '@/components/ui-kit';
import { buildProfessionalProfilePreview } from '@/core/profile/professional-profile-model.ts';
import { loadContact, loadProfileForDocument, profileErrorMessage } from '@/core/profile/opportunity-service.ts';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import type { ProfessionalProfilePreview } from '@/core/profile/professional-profile-model.ts';

export default function ProfessionalProfilePreviewScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [preview, setPreview] = useState<ProfessionalProfilePreview | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([loadContact(), loadProfileForDocument()])
      .then(([contact, profile]) => setPreview(buildProfessionalProfilePreview(contact, profile)))
      .catch((e) => {
        if (e instanceof Error && e.message.includes('SIGNED_OUT')) {
          router.replace(('/sign-in?returnTo=' + encodeURIComponent('/opportunity-profile/preview')) as never);
          return;
        }
        setPreview(null);
        setError(profileErrorMessage(e));
      });
  }, []);

  useFocusEffect(load);

  return (
    <ScreenFrame>
      <PageHeader eyebrow="OPPORTUNITY PROFILE" title="Professional preview" backTo="/opportunity-profile" />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        {!preview && !error ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? (
          <>
            <StatusLine tone="error">{error}</StatusLine>
            <SecondaryButton label="TRY AGAIN" onPress={load} />
          </>
        ) : null}
        {preview ? <ProfessionalProfileCard preview={preview} /> : null}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = (_t: ThemeTokens) => ({
  content: { paddingHorizontal: 16, paddingBottom: 36 },
  spinner: { marginTop: 32 },
});
