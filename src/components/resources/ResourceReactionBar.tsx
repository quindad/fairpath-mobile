import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FairPathFonts as F } from '@/constants/fairpath';
import {
  RESOURCE_REACTIONS,
  clearResourceReaction,
  formatReactionAggregateLine,
  loadResourceReactionSummary,
  reactionActionMessage,
  resourceReactionsBackendReady,
  setResourceReaction,
  type ResourceReactionKind,
  type ResourceReactionSummary,
} from '@/core/community/resource-reactions';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

type Props = {
  resourceId: string;
  sensitiveCategories?: string[];
  onRequireSignIn: () => void;
  signedIn: boolean;
  busy?: boolean;
  setBusy?: (v: boolean) => void;
};

export function ResourceReactionBar({ resourceId, onRequireSignIn, signedIn, busy, setBusy }: Props) {
  const s = useThemedStyles(styles);
  const [ready, setReady] = useState(false);
  const [summary, setSummary] = useState<ResourceReactionSummary | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    resourceReactionsBackendReady().then((ok) => {
      setReady(ok);
      if (!ok) return;
      void loadResourceReactionSummary(resourceId).then(setSummary).catch(() => setSummary({ available: false }));
    });
  }, [resourceId]);

  async function pick(reaction: ResourceReactionKind) {
    if (!signedIn) {
      onRequireSignIn();
      return;
    }
    if (busy || !ready) return;
    setBusy?.(true);
    try {
      if (summary?.my_reaction === reaction) {
        const next = await clearResourceReaction(resourceId);
        setSummary(next);
      } else {
        const next = await setResourceReaction(resourceId, reaction, true);
        setSummary(next);
      }
      setExpanded(false);
    } catch (e) {
      notify('Feedback not saved', reactionActionMessage(e));
    } finally {
      setBusy?.(false);
    }
  }

  if (!ready || !summary?.available) {
    return (
      <View style={s.box}>
        <Text style={s.title}>How was this resource?</Text>
        <Text style={s.meta}>Community reactions activate after the contributions database migration is approved for this environment.</Text>
      </View>
    );
  }

  const line = formatReactionAggregateLine(summary);

  return (
    <View style={s.box}>
      <Text style={s.title}>How was this resource?</Text>
      <Text style={s.meta}>{line}</Text>
      <Text style={s.note}>Reactions are anonymous to other members. They are feedback, not proof a program is open today.</Text>
      <View style={s.row}>
        {RESOURCE_REACTIONS.map((r) => {
          const on = summary.my_reaction === r.id;
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={r.label}
              accessibilityState={{ selected: on }}
              disabled={Boolean(busy)}
              onPress={() => void pick(r.id)}
              onLongPress={() => setExpanded(true)}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={s.emoji}>{r.emoji}</Text>
              <Text style={[s.chipLabel, on && s.chipLabelOn]} numberOfLines={2}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {expanded ? (
        <Text style={s.meta}>Tap again to remove your reaction. Long-press opens all options for accessibility.</Text>
      ) : null}
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  box: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, marginTop: 12 },
  title: { color: t.text, fontFamily: F.extraBold, fontSize: 15, marginBottom: 6 },
  meta: { color: t.textMuted, fontSize: 12, lineHeight: 18, marginBottom: 6 },
  note: { color: t.textSecondary, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  chip: {
    width: '30%' as const,
    minWidth: 96,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: t.borderStrong,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center' as const,
  },
  chipOn: { borderColor: t.accentBorder, backgroundColor: t.accentSubtle },
  emoji: { fontSize: 18, marginBottom: 4 },
  chipLabel: { color: t.textSecondary, fontFamily: F.bold, fontSize: 9, textAlign: 'center' as const },
  chipLabelOn: { color: t.accentText },
});
