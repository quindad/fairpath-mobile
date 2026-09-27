import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { InlineBadge } from '@/components/ProductChrome';
import { FairPathFonts as F } from '@/constants/fairpath';
import { costLabel, distanceLabel, freshnessLabel, modeLabel, openNowLabel, provenanceBadge } from '@/core/resources/resource-format';
import type { ResourceProgress, ResourceSummary } from '@/core/resources/resources-service';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';

type Props = {
  resource: ResourceSummary;
  categoryLabels: Record<string, string>;
  /** When provided, the card shows a save control. Guests get a sign-in prompt from the caller. */
  saved?: boolean;
  progress?: ResourceProgress;
  onToggleSave?: () => void;
};

export function ResourceCard({ resource, categoryLabels, saved, progress, onToggleSave }: Props) {
  const s = useThemedStyles(styles);
  const fresh = freshnessLabel(resource.freshness);
  const test = provenanceBadge(resource.data_origin);
  const place = resource.nearest_location
    ? [resource.nearest_location.city, resource.nearest_location.state_code].filter(Boolean).join(', ')
    : resource.is_national ? 'Nationwide' : '';
  const meta = [modeLabel(resource.delivery_mode), place, distanceLabel(resource.distance_miles), openNowLabel(resource.nearest_location?.open_now)]
    .filter(Boolean)
    .join(' · ');
  const primary = resource.categories[0] ? categoryLabels[resource.categories[0]] ?? '' : '';

  return (
    <View style={s.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${resource.title}, ${resource.organization.name}`}
        onPress={() => router.push(`/resource/${resource.id}` as never)}
        style={({ pressed }) => [s.body, pressed && s.pressed]}
      >
        <View style={s.badges}>
          {fresh.tone === 'ok' ? <InlineBadge tone="lime">{fresh.label}</InlineBadge> : null}
          {fresh.tone === 'warn' ? <View style={s.warnBadge}><Text style={s.warnText}>{fresh.label}</Text></View> : null}
          {resource.cost_type === 'free' ? <InlineBadge>FREE</InlineBadge> : null}
          {resource.urgency_tier === 2 && resource.freshness === 'fresh' ? <InlineBadge>HELP TODAY</InlineBadge> : null}
          {progress === 'started' ? <InlineBadge>YOU STARTED THIS</InlineBadge> : null}
          {progress === 'completed' ? <InlineBadge>YOU FINISHED THIS</InlineBadge> : null}
          {test ? <InlineBadge>{test}</InlineBadge> : null}
        </View>
        <Text style={s.title}>{resource.title}</Text>
        <Text style={s.org}>{resource.organization.name}{primary ? ` · ${primary}` : ''}</Text>
        <Text style={s.summary} numberOfLines={2}>{resource.summary}</Text>
        <Text style={s.meta}>{meta}{resource.cost_type !== 'free' ? ` · ${costLabel(resource.cost_type)}` : ''}</Text>
      </Pressable>
      {onToggleSave ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saved ? `Remove ${resource.title} from saved` : `Save ${resource.title}`}
          accessibilityState={{ selected: Boolean(saved) }}
          onPress={onToggleSave}
          style={s.saveRow}
        >
          <Text style={[s.saveText, saved && s.saveTextOn]}>{saved ? 'SAVED ✓' : 'SAVE'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, marginBottom: 10 },
  body: { padding: 14 },
  pressed: { backgroundColor: t.accentSubtle },
  badges: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 8 },
  warnBadge: { alignSelf: 'flex-start' as const, borderWidth: 1, borderColor: t.warning, paddingHorizontal: 7, paddingVertical: 4 },
  warnText: { color: t.warning, fontFamily: F.extraBold, fontSize: 8, letterSpacing: 0.6 },
  title: { color: t.text, fontFamily: F.extraBold, fontSize: 16, lineHeight: 21 },
  org: { color: t.textSecondary, fontFamily: F.semiBold, fontSize: 12, marginTop: 3 },
  summary: { color: t.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 8 },
  meta: { color: t.textMuted, fontSize: 11, lineHeight: 16, marginTop: 8 },
  saveRow: { borderTopWidth: 1, borderTopColor: t.border, height: 40, alignItems: 'flex-end' as const, justifyContent: 'center' as const, paddingHorizontal: 14 },
  saveText: { color: t.textSecondary, fontFamily: F.extraBold, fontSize: 10, letterSpacing: 1 },
  saveTextOn: { color: t.accentText },
});
