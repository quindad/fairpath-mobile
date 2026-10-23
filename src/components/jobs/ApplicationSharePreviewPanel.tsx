import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { BodyText, Panel } from '@/components/ui-kit';
import {
  buildApplicationSharePreview,
  SHARE_SECTION_LABELS,
  type ShareSectionKey,
} from '@/core/jobs/application-share-preview.ts';
import { loadContact, loadProfileForDocument } from '@/core/profile/opportunity-service.ts';
import { FairPathFonts as F } from '@/constants/fairpath';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

export function ApplicationSharePreviewPanel({ sections }: { sections: ShareSectionKey[] }) {
  const s = useThemedStyles(styles);
  const [headline, setHeadline] = useState('');
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof loadProfileForDocument>> | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([loadContact(), loadProfileForDocument()])
      .then(([c, p]) => {
        if (!alive) return;
        setHeadline(c.professional_headline || '');
        setProfile(p);
      })
      .catch(() => {
        if (alive) setProfile(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const preview = useMemo(() => {
    if (!profile || !sections.length) return [];
    try {
      return buildApplicationSharePreview(sections, profile, headline);
    } catch {
      return [];
    }
  }, [profile, sections, headline]);

  if (!sections.length) return null;

  return (
    <Panel>
      <Text style={s.title}>Preview for employer</Text>
      <BodyText muted>
        If you submit with Opportunity Profile sharing on, the employer receives only these sections — built on FairPath
        servers from your profile. Justice Records are never included.
      </BodyText>
      {!preview.length ? (
        <View style={{ marginTop: 8 }}>
          <BodyText muted>Add details in the sections you selected, or choose different sections.</BodyText>
        </View>
      ) : (
        <View style={s.list}>
          {preview.map((block) => (
            <View key={block.section}>
              <Text style={s.section}>{SHARE_SECTION_LABELS[block.section]}</Text>
              {block.lines.map((line) => (
                <Text key={line} style={s.line}>
                  • {line}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </Panel>
  );
}

const styles = (t: ThemeTokens) => ({
  title: { color: t.text, fontFamily: F.bold, fontSize: 14, marginBottom: 6 },
  list: { marginTop: 10, gap: 10 },
  section: { color: t.accentText, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 0.8 },
  line: { color: t.text, fontSize: 13, lineHeight: 18, marginTop: 2 },
});
