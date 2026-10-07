import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle, SharpChip } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { BRANCHES, type BranchId } from '@/core/veterans/branches';
import { VETERAN_SECTIONS, sectionUsable, type VeteranSection } from '@/core/veterans/dashboard';
import { translateOccupation } from '@/core/veterans/translation';

const COMPONENT_LABEL: Record<string, string> = {
  active: 'Active Duty',
  reserve: 'Reserve',
  national_guard: 'National Guard',
};

export default function VeteransScreen() {
  const s = useThemedStyles(styles);
  const [branchId, setBranchId] = useState<BranchId | null>(null);
  const [code, setCode] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);

  const branch = useMemo(() => BRANCHES.find((b) => b.id === branchId) ?? null, [branchId]);
  const translation = useMemo(
    () => (branchId && submittedCode ? translateOccupation(branchId, submittedCode) : null),
    [branchId, submittedCode],
  );

  return (
    <ScreenFrame>
      <PageHeader eyebrow="PATHWAY · IN DEVELOPMENT" title="Veterans" backTo="/home" />
      <FormScrollView contentContainerStyle={s.content}>
        <View style={s.banner} accessibilityRole="summary">
          <Text style={s.bannerTitle}>Veterans pathway is in development</Text>
          <Text style={s.bannerBody}>
            Some features are still being built and verified. FairPath is not affiliated with, endorsed by, or acting for the Department of Defense or the Department of Veterans Affairs.
          </Text>
        </View>

        <Pressable style={s.button} accessibilityRole="link" accessibilityLabel="Open your Veterans service profile" onPress={() => router.push('/veterans/profile' as never)}>
          <Text style={s.buttonText}>Service profile and consent</Text>
        </Pressable>

        <SectionTitle>Your branch</SectionTitle>
        <Text style={s.help}>Optional. Choose a branch to personalize this page. Browsing needs no personal information.</Text>
        <View style={s.chipWrap} accessibilityRole="radiogroup" accessibilityLabel="Military branch">
          {BRANCHES.map((b) => (
            <SharpChip
              key={b.id}
              label={b.officialName.replace('United States ', '')}
              active={branchId === b.id}
              onPress={() => setBranchId(branchId === b.id ? null : b.id)}
            />
          ))}
        </View>
        {branch ? (
          <View style={s.branchCard} accessibilityLabel={`Selected branch: ${branch.officialName}`}>
            <Text style={s.branchName}>{branch.officialName}</Text>
            <Text style={s.help}>
              Components offered: {branch.components.map((c) => COMPONENT_LABEL[c]).join(', ')}.
            </Text>
            <Text style={s.help}>Branch accent colors are pending design review. The FairPath accent is shown for now.</Text>
          </View>
        ) : null}

        <SectionTitle>Dashboard</SectionTitle>
        {VETERAN_SECTIONS.map((section) => (
          <SectionCard key={section.id} section={section} />
        ))}

        <SectionTitle>Military occupation to civilian roles</SectionTitle>
        <Text style={s.help}>
          Enter an occupation code (MOS, AFSC, Navy rating, or equivalent). FairPath only shows translations that have been reviewed by a subject-matter reviewer. Unreviewed codes are never guessed.
        </Text>
        <View style={s.row}>
          <TextInput
            style={s.input}
            value={code}
            onChangeText={setCode}
            placeholder="For example 11B or a rating code"
            placeholderTextColor={s.placeholder.color}
            autoCapitalize="characters"
            accessibilityLabel="Occupation code"
            returnKeyType="search"
            onSubmitEditing={() => setSubmittedCode(code.trim() || null)}
          />
          <Pressable
            style={s.button}
            accessibilityRole="button"
            accessibilityLabel="Look up occupation code"
            onPress={() => setSubmittedCode(code.trim() || null)}
            disabled={!branchId}
          >
            <Text style={s.buttonText}>Look up</Text>
          </Pressable>
        </View>
        {!branchId ? <Text style={s.help}>Choose a branch first. Occupation codes are branch-specific.</Text> : null}
        {translation ? (
          translation.status === 'reviewed' ? (
            <View style={s.card} accessibilityLabel="Reviewed translation">
              {translation.roles.map((r) => <Text key={r} style={s.cardBody}>{r}</Text>)}
              <Text style={s.help}>Reviewed {translation.reviewedOn} by {translation.reviewedBy}.</Text>
            </View>
          ) : (
            <View style={s.card} accessibilityLabel="Translation not yet reviewed">
              <Text style={s.cardTitle}>Not yet reviewed</Text>
              <Text style={s.cardBody}>
                FairPath does not have a reviewed civilian translation for this code yet. Check the official occupation resources, or ask a veteran service officer.
              </Text>
            </View>
          )
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}

function SectionCard({ section }: { section: VeteranSection }) {
  const s = useThemedStyles(styles);
  const usable = sectionUsable(section);
  const statusLabel = section.status === 'live' ? 'Available' : section.status === 'in_development' ? 'In development' : 'Planned';
  return (
    <View style={s.card} accessibilityLabel={`${section.title}, ${statusLabel}`}>
      <Text style={s.cardTitle}>{section.title}</Text>
      <Text style={s.badge}>{statusLabel}</Text>
      {section.officialLinksOnly ? (
        <Text style={s.cardBody}>Benefit information links only to official sources. FairPath does not decide benefit or claim eligibility.</Text>
      ) : null}
      {!usable ? <Text style={s.help}>Not open yet. Shown so you can see what is planned.</Text> : null}
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  bannerBody: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  help: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  chipWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  branchCard: { borderWidth: 1, borderColor: t.border, padding: 14, gap: 6 },
  branchName: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  cardBody: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  badge: { color: t.accent, fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.6 },
  row: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, paddingHorizontal: 12, fontSize: 16 },
  placeholder: { color: t.textMuted },
  button: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' as const, backgroundColor: t.accent },
  buttonText: { color: t.onAccent, fontWeight: '700' as const },
});
