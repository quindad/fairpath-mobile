import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle, SharpChip } from '@/components/ProductChrome';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { BRANCHES, type Branch, type BranchId } from '@/core/veterans/branches';
import { VETERAN_SECTIONS, sectionUsable, type VeteranSection } from '@/core/veterans/dashboard';
import { translateOccupation } from '@/core/veterans/translation';
import { translateVeteranExperience } from '@/core/ai/signal';
import { VeteranToolsGate } from '@/components/VeteranToolsGate';

const COMPONENT_LABEL: Record<string, string> = {
  active: 'Active Duty',
  reserve: 'Reserve',
  national_guard: 'National Guard',
};

export default function VeteransScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [branchId, setBranchId] = useState<BranchId | null>(null);
  const [useBranchColor, setUseBranchColor] = useState(false);
  const [code, setCode] = useState('');
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [duties, setDuties] = useState('');
  const [signalText, setSignalText] = useState('');
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalRequested, setSignalRequested] = useState(false);

  const branch = useMemo(() => BRANCHES.find((b) => b.id === branchId) ?? null, [branchId]);
  const accent = useBranchColor && branch ? branch.accentHex : tokens.accent;
  const translation = useMemo(
    () => (branchId && submittedCode ? translateOccupation(branchId, submittedCode) : null),
    [branchId, submittedCode],
  );

  async function askSignal() {
    const t = duties.trim();
    if (!t || signalLoading) return;
    setSignalLoading(true); setSignalRequested(true);
    try {
      const r = await translateVeteranExperience(t, branch?.officialName);
      if (r.status === 'ok') setSignalText(r.text);
      else if (r.status === 'out_of_credits') setSignalText('You are out of Signal credits for now. They refresh with your plan.');
      else if (r.status === 'rate_limited') setSignalText('Signal is busy across FairPath right now. Try again shortly.');
      else if (r.status === 'signed_out') { router.push(('/sign-in?returnTo=' + encodeURIComponent('/veterans')) as never); return; }
      else setSignalText(r.message);
    } catch { setSignalText('Signal could not help with this right now. Please try again.'); }
    finally { setSignalLoading(false); }
  }

  return (
    <VeteranToolsGate eyebrow="VETERANS" title="Veteran-specific tools" backTo="/home">
    <ScreenFrame>
      <PageHeader eyebrow="VETERANS" title="Veteran-specific tools" backTo="/home" />
      <FormScrollView style={{ flex: 1 }} contentContainerStyle={s.content}>
        <View style={s.banner} accessibilityRole="summary">
          <Text style={s.bannerTitle}>Jobs and housing for everyone, with your filters built in</Text>
          <Text style={s.bannerBody}>
            FairPath Jobs and Housing are shared boards for every member — Veteran Friendly sits right next to Felony Friendly as a filter, not a separate app. This page is just for the handful of things that are genuinely veteran-specific: translating your service into civilian terms, VA benefits, and real veteran community organizations. FairPath is not affiliated with, endorsed by, or acting for the Department of Defense or the Department of Veterans Affairs.
          </Text>
        </View>

        <View style={s.quickLinks}>
          <Pressable style={[s.button, { backgroundColor: accent, flex: 1 }]} accessibilityRole="button" accessibilityLabel="Browse veteran-friendly jobs" onPress={() => router.push('/find-jobs?lane=veteran' as never)}>
            <Text style={s.buttonText}>Veteran-friendly jobs</Text>
          </Pressable>
          <Pressable style={[s.button, { backgroundColor: accent, flex: 1 }]} accessibilityRole="button" accessibilityLabel="Browse veteran-friendly housing" onPress={() => router.push('/find-housing?veteranFriendly=true' as never)}>
            <Text style={s.buttonText}>Veteran-friendly housing</Text>
          </Pressable>
        </View>

        <Pressable style={[s.button, { backgroundColor: accent }]} accessibilityRole="link" accessibilityLabel="Open your Veterans service profile" onPress={() => router.push('/veterans/profile' as never)}>
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
          <View style={[s.branchCard, useBranchColor ? { borderColor: accent, borderLeftWidth: 3 } : null]} accessibilityLabel={`Selected branch: ${branch.officialName}`}>
            <Text style={[s.branchName, useBranchColor ? { color: accent } : null]}>{branch.officialName}</Text>
            <Text style={s.help}>
              Components offered: {branch.components.map((c) => COMPONENT_LABEL[c]).join(', ')}.
            </Text>
            <View style={s.colorToggleRow}>
              <Text style={s.help}>Use {branch.officialName.replace('United States ', '')}'s color on this page</Text>
              <Switch value={useBranchColor} onValueChange={setUseBranchColor} accessibilityLabel={`Use ${branch.officialName} color theme`} />
            </View>
            <Text style={s.help}>Not the branch's insignia, and not independently verified against an official branch style guide — just a commonly-associated color, and entirely optional. Keep it off and everything stays standard FairPath.</Text>
          </View>
        ) : null}

        <SectionTitle>Veteran-specific tools</SectionTitle>
        {VETERAN_SECTIONS.map((section) => (
          <SectionCard key={section.id} section={section} accent={accent} />
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
            style={[s.button, { backgroundColor: accent }]}
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

        <SectionTitle>Signal · Describe it in your own words</SectionTitle>
        <Text style={s.help}>No reviewed code match? Describe what you actually did, and Signal will help phrase it for a civilian resume — it only rephrases what you tell it, never guesses an official occupation match.</Text>
        <TextInput
          style={[s.input, { minHeight: 70 }]}
          value={duties}
          onChangeText={setDuties}
          placeholder="What did you do day to day?"
          placeholderTextColor={s.placeholder.color}
          multiline
          accessibilityLabel="Describe your military duties for Signal"
        />
        <Pressable style={[s.button, { backgroundColor: accent }]} accessibilityRole="button" onPress={() => void askSignal()}>
          <Text style={s.buttonText}>{signalLoading ? 'Asking Signal…' : 'Ask Signal'}</Text>
        </Pressable>
        {signalRequested ? <View style={s.card}><Text style={s.cardBody}>{signalLoading ? 'Signal is thinking…' : signalText}</Text></View> : null}
      </FormScrollView>
    </ScreenFrame>
    </VeteranToolsGate>
  );
}

function SectionCard({ section, accent }: { section: VeteranSection; accent: string }) {
  const s = useThemedStyles(styles);
  const usable = sectionUsable(section);
  const statusLabel = section.status === 'live' ? 'Available' : section.status === 'in_development' ? 'In development' : 'Planned';
  const [expanded, setExpanded] = useState(false);
  const hasRealRoute = Boolean(section.route && section.route !== '#skills_translation');
  const isSelfSection = section.route === '#skills_translation';

  function onPress() {
    if (section.route && hasRealRoute) { router.push(section.route as never); return; }
    if (section.links?.length) setExpanded((x) => !x);
  }

  const body = (
    <>
      <Text style={s.cardTitle}>{section.title}</Text>
      <Text style={[s.badge, { color: accent }]}>{statusLabel}</Text>
      <Text style={s.cardBody}>{section.why}</Text>
      {section.officialLinksOnly ? (
        <Text style={s.cardBody}>Benefit information links only to official sources. FairPath does not decide benefit or claim eligibility.</Text>
      ) : null}
      {isSelfSection ? <Text style={s.help}>Use the occupation lookup and the Signal box below on this page.</Text> : null}
      {hasRealRoute ? <Text style={s.help}>Opens a real FairPath tool →</Text> : null}
      {!usable && !isSelfSection ? <Text style={s.help}>Not open yet. Shown so you can see what is planned.</Text> : null}
      {expanded && section.links ? (
        <View style={{ gap: 6, marginTop: 6 }}>
          {section.links.map((l) => (
            <Pressable key={l.url} accessibilityRole="link" onPress={() => void Linking.openURL(l.url)}>
              <Text style={s.linkText}>{l.label} ↗</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );

  if (hasRealRoute || section.links?.length) {
    return (
      <Pressable style={s.card} accessibilityRole="button" accessibilityLabel={`${section.title}, ${statusLabel}`} onPress={onPress}>
        {body}
      </Pressable>
    );
  }
  return <View style={s.card} accessibilityLabel={`${section.title}, ${statusLabel}`}>{body}</View>;
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  bannerBody: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  help: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  quickLinks: { flexDirection: 'row' as const, gap: 10 },
  chipWrap: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  branchCard: { borderWidth: 1, borderColor: t.border, padding: 14, gap: 6 },
  colorToggleRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginTop: 4 },
  branchName: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  cardBody: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  badge: { color: t.accent, fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.6 },
  linkText: { color: t.accent, fontSize: 14, fontWeight: '700' as const, textDecorationLine: 'underline' as const },
  row: { flexDirection: 'row' as const, gap: 8, alignItems: 'center' as const },
  input: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, paddingHorizontal: 12, fontSize: 16 },
  placeholder: { color: t.textMuted },
  button: { minHeight: 48, paddingHorizontal: 16, justifyContent: 'center' as const, backgroundColor: t.accent },
  buttonText: { color: t.onAccent, fontWeight: '700' as const },
});
