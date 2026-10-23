import { Linking, Pressable, Text, View } from 'react-native';
import { BodyText, PrimaryButton, SecondaryButton, TextButton } from '@/components/ui-kit';
import { FairPathFonts as F } from '@/constants/fairpath';
import type { AiResponse, Basis } from '@/core/ai/orchestrator';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

const BASIS_LABEL: Record<Basis, string> = {
  rule: 'Rule',
  member: 'You',
  extracted: 'From a file',
  app_state: 'Your FairPath data',
  ai: 'AI wording',
};

type Props = {
  user: string;
  response: AiResponse | null;
  loading: boolean;
  provOpen: boolean;
  onToggleProv: () => void;
  onAction: (route: string) => void;
};

export function SignalTurn({ user, response, loading, provOpen, onToggleProv, onAction }: Props) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.turn}>
      <View style={s.userBubble}>
        <Text style={s.userText}>{user}</Text>
      </View>
      {loading ? (
        <View style={s.assistantBubble}>
          <Text style={s.typing}>Signal is thinking…</Text>
        </View>
      ) : null}
      {response ? (
        <View style={s.assistantBubble}>
          {response.title ? <Text style={s.title}>{response.title}</Text> : null}
          {response.parts.map((p, k) => (
            <Text key={k} style={s.body}>{p.text}</Text>
          ))}
          {response.actions.length ? (
            <View style={s.actions}>
              {response.actions.map((a) =>
                a.primary ? (
                  <PrimaryButton key={a.label + a.route} label={a.label} onPress={() => onAction(a.route)} />
                ) : (
                  <SecondaryButton key={a.label + a.route} label={a.label} onPress={() => onAction(a.route)} />
                ),
              )}
            </View>
          ) : null}
          <TextButton label={provOpen ? 'Hide sources' : 'How I got this'} onPress={onToggleProv} />
          {provOpen ? (
            <View style={s.prov}>
              <BodyText muted>
                {response.provenance.engine === 'model' ? 'AI wording plus fixed rules' : 'Built-in rules (no AI model)'}
                {' · '}
                {response.provenance.confidence}
              </BodyText>
              {response.provenance.sourceRefs.length ? (
                <BodyText muted>
                  Used: {[...new Set(response.provenance.sourceRefs.map((r) => r.kind.replace(/_/g, ' ')))].join(', ')}
                </BodyText>
              ) : (
                <BodyText muted>No personal records were used for this answer.</BodyText>
              )}
              {response.provenance.officialSources.map((o) => (
                <Pressable key={o.url} accessibilityRole="link" onPress={() => void Linking.openURL(o.url)}>
                  <Text style={s.link}>{o.label} ↗</Text>
                </Pressable>
              ))}
              <Text style={s.basisFoot}>
                {[...new Set(response.parts.map((p) => BASIS_LABEL[p.basis]))].join(' · ')}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  turn: { marginBottom: 16, gap: 8 },
  userBubble: {
    alignSelf: 'flex-end' as const,
    maxWidth: '88%' as const,
    backgroundColor: t.inverse,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 4,
  },
  userText: { color: t.onInverse, fontFamily: F.medium, fontSize: 15, lineHeight: 21 },
  assistantBubble: {
    alignSelf: 'flex-start' as const,
    maxWidth: '96%' as const,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  typing: { color: t.textMuted, fontFamily: F.medium, fontSize: 14 },
  title: { color: t.text, fontFamily: F.extraBold, fontSize: 17, lineHeight: 22 },
  body: { color: t.textSecondary, fontFamily: F.medium, fontSize: 14, lineHeight: 21 },
  actions: { gap: 8, marginTop: 4 },
  prov: { borderTopWidth: 1, borderTopColor: t.border, paddingTop: 8, gap: 4 },
  link: { color: t.accentText, fontFamily: F.semiBold, fontSize: 13, marginTop: 4 },
  basisFoot: { color: t.textMuted, fontSize: 11, marginTop: 4 },
});
