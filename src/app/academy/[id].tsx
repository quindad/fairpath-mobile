import {PageHeader, ScreenFrame, ScreenScroll, ScreenColumn } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { Text, View } from 'react-native';

// FairPath does not run its own lesson/quiz courses right now -- a locally-tracked, no-real-credential
// "certificate" isn't worth much to a job seeker. Every entry in /academy links straight out to the real
// organization that actually runs it (CareerOneStop, Per Scholas, Coursera once a real affiliate deal is in
// place, etc.), so there is nothing to render here. This route stays only so an old link never 404s silently.
export default function AcademyCourseScreen() {
  const s = useThemedStyles(styles);
  return (
    <ScreenFrame>
      <PageHeader eyebrow="ACADEMY" title="Course" backTo="/academy" />
      <ScreenScroll contentContainerStyle={s.content}>
        <Text style={s.body}>
          FairPath links directly to real courses and programs run by other organizations, rather than issuing its own certificate. Go back to Academy to find one.
        </Text>
      </ScreenScroll>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12 },
  body: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
});
