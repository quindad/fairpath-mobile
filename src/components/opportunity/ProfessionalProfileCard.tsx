import { Text, View } from 'react-native';
import { BodyText, Panel } from '@/components/ui-kit';
import type { ProfessionalProfilePreview } from '@/core/profile/professional-profile-model.ts';
import { FairPathFonts as F } from '@/constants/fairpath';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

export function ProfessionalProfileCard({ preview }: { preview: ProfessionalProfilePreview }) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.wrap}>
      <Panel tone="accent">
        <Text style={s.name}>{preview.displayName || 'Your name'}</Text>
        {preview.headline ? <Text style={s.headline}>{preview.headline}</Text> : null}
        <Text style={s.meta}>{preview.locationLabel}</Text>
        {preview.careerInterests.length ? (
          <Text style={s.meta}>Interests: {preview.careerInterests.join(' · ')}</Text>
        ) : null}
      </Panel>

      {preview.skills.length ? (
        <Panel>
          <Text style={s.section}>Skills</Text>
          <Text style={s.body}>{preview.skills.join(' · ')}</Text>
        </Panel>
      ) : null}

      {preview.experience.length ? (
        <Panel>
          <Text style={s.section}>Experience</Text>
          {preview.experience.map((e) => (
            <View key={`${e.title}-${e.company}`} style={s.block}>
              <Text style={s.role}>{e.title}</Text>
              <Text style={s.sub}>{e.company} · {e.period}</Text>
              {e.highlight ? <Text style={s.body}>{e.highlight}</Text> : null}
            </View>
          ))}
        </Panel>
      ) : null}

      {preview.education.length ? (
        <Panel>
          <Text style={s.section}>Education</Text>
          {preview.education.map((e) => (
            <Text key={e.school} style={s.body}>
              {e.school} — {e.credential}{e.field ? `, ${e.field}` : ''}
            </Text>
          ))}
        </Panel>
      ) : null}

      {preview.credentials.length ? (
        <Panel>
          <Text style={s.section}>Certifications & licenses</Text>
          {preview.credentials.map((c) => (
            <Text key={c.name} style={s.body}>
              {c.name}{c.issuer ? ` (${c.issuer})` : ''} · self-reported
            </Text>
          ))}
        </Panel>
      ) : null}

      {preview.accomplishments.length ? (
        <Panel>
          <Text style={s.section}>Highlights</Text>
          {preview.accomplishments.map((a) => (
            <Text key={a.label} style={s.body}>
              • {a.label} (self-reported)
            </Text>
          ))}
        </Panel>
      ) : null}

      <Panel>
        <BodyText muted>
          This is what you control. Employers only see professional details you attach to an application. Justice Records
          and legal documents never appear here.
        </BodyText>
      </Panel>
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  wrap: { gap: 12 },
  name: { color: t.text, fontFamily: F.black, fontSize: 22 },
  headline: { color: t.textSecondary, fontFamily: F.bold, fontSize: 15, marginTop: 4 },
  meta: { color: t.textMuted, fontSize: 13, marginTop: 4 },
  section: { color: t.text, fontFamily: F.extraBold, fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  block: { marginBottom: 10 },
  role: { color: t.text, fontFamily: F.bold, fontSize: 15 },
  sub: { color: t.textMuted, fontSize: 13, marginBottom: 4 },
  body: { color: t.text, fontSize: 14, lineHeight: 20 },
});
