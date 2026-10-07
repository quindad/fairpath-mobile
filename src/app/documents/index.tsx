import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { BodyText, EmptyState, ListRow, Panel, PrimaryButton, SecondaryButton, StatusLine, TextButton } from '@/components/ui-kit';
import { FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { deleteDocument, documentErrorMessage, listMyDocuments, type DocumentListItem } from '@/core/documents/document-service';
import { DOCUMENT_TYPES } from '@/core/documents/document-types';
import { RENDERABLE, currentFingerprint, readinessFor, type RenderableType } from '@/core/documents/generate';
import { useFairPathTheme, useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { notify } from '@/core/ui/notify';

type Ready = Record<string, { ready: boolean; reason: string }>;

function dateText(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function daysLeft(iso: string | null) {
  return iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null;
}

export default function DocumentsScreen() {
  const s = useThemedStyles(styles);
  const { tokens } = useFairPathTheme();
  const [items, setItems] = useState<DocumentListItem[] | null>(null);
  const [ready, setReady] = useState<Ready>({});
  const [stale, setStale] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [openTypes, setOpenTypes] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setError('');
    try {
      const list = await listMyDocuments();
      setItems(list);
      const r: Ready = {};
      await Promise.all(RENDERABLE.map(async (t) => { try { r[t] = await readinessFor(t); } catch { r[t] = { ready: false, reason: 'Could not check right now.' }; } }));
      setReady(r);
      // "Changed since you generated it": compare what the document would contain today with what it contained then.
      const latest = list.filter((x) => x.isLatest && x.doc.status === 'ready' && (RENDERABLE as string[]).includes(x.doc.document_type));
      const flags: Record<string, boolean> = {};
      await Promise.all(latest.map(async (x) => {
        try { flags[x.doc.id] = (await currentFingerprint(x.doc.document_type as RenderableType, x.doc.metadata?.options_code)) !== x.doc.input_fingerprint; } catch { /* leave unflagged */ }
      }));
      setStale(flags);
    } catch (e) {
      if (e instanceof Error && e.message.includes('SIGNED_OUT')) router.replace(('/sign-in?returnTo=' + encodeURIComponent('/documents')) as never);
      else { setItems(null); setError('We could not load your documents. Check your connection and try again.'); }
    }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  function remove(x: DocumentListItem) {
    notify('Delete this document?', 'This removes FairPath’s stored copy and history entry. A file you already downloaded or shared stays where it is: FairPath cannot recall it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void deleteDocument(x.doc.id).then(load).catch((e) => notify('Could not delete', documentErrorMessage(e))) },
    ]);
  }

  const visible = (items ?? []).filter((x) => x.doc.status !== 'deleted');
  const latest = visible.filter((x) => x.isLatest);
  const earlier = (type: string) => visible.filter((x) => !x.isLatest && x.doc.document_type === type);
  const attention = latest.filter((x) => stale[x.doc.id] || (x.doc.has_stored_copy && (daysLeft(x.doc.expires_at) ?? 99) <= 7) || x.doc.status === 'expired');
  const readyTypes = RENDERABLE.filter((t) => ready[t]?.ready);
  const blockedTypes = RENDERABLE.filter((t) => ready[t] && !ready[t].ready);

  return (
    <ScreenFrame>
      <PageHeader eyebrow="YOUR ACCOUNT" title="My Documents" backTo="/me" />
      <ScrollView contentContainerStyle={s.content}>
        <BodyText muted>Everything FairPath helped you prepare, in one place. Files stay private to you until you choose to download or share them.</BodyText>
        <ListRow
          title="Upload a document for review"
          body="Court records, credit reports and other documents you already have. You review every detail before it is used."
          onPress={() => router.push('/documents/upload' as never)}
        />
        {!items && !error ? <ActivityIndicator color={tokens.accentText} style={s.spinner} /> : null}
        {error ? <View><StatusLine tone="error">{error}</StatusLine><SecondaryButton label="TRY AGAIN" onPress={() => void load()} /></View> : null}

        {items ? (
          <>
            {attention.length ? (
              <>
                <View style={s.block}><SectionTitle>NEEDS ATTENTION</SectionTitle></View>
                {attention.map((x) => (
                  <Panel key={x.doc.id} tone="warning">
                    <Text style={s.title}>{x.doc.title}</Text>
                    <StatusLine tone="warning">
                      {stale[x.doc.id] ? 'Your information changed since you created this. Create a new version so it is current.' : (daysLeft(x.doc.expires_at) ?? 99) <= 7 ? `Your stored copy is removed in ${Math.max(0, daysLeft(x.doc.expires_at) ?? 0)} day(s).` : 'This stored copy has expired.'}
                    </StatusLine>
                    <PrimaryButton label="CREATE A NEW VERSION" onPress={() => router.push(('/documents/create?type=' + x.doc.document_type) as never)} />
                  </Panel>
                ))}
              </>
            ) : null}

            <View style={s.block}><SectionTitle>READY TO EXPORT</SectionTitle></View>
            {readyTypes.length === 0 ? <EmptyState title="Nothing is ready yet" body="Save resources or build your Opportunity Profile, and the documents FairPath can prepare will appear here." /> : null}
            {readyTypes.map((t) => (
              <ListRow key={t} title={DOCUMENT_TYPES[t].label} body={DOCUMENT_TYPES[t].description} meta={DOCUMENT_TYPES[t].formats.map((f) => f.toUpperCase()).join(' · ')} onPress={() => router.push(('/documents/create?type=' + t) as never)} />
            ))}
            {blockedTypes.map((t) => (
              <ListRow key={t} title={DOCUMENT_TYPES[t].label} body={ready[t].reason} onPress={() => router.push((t === 'opportunity_profile' ? '/opportunity-profile' : '/resources') as never)} />
            ))}

            <View style={s.block}><SectionTitle>GENERATED</SectionTitle></View>
            {latest.length === 0 ? <EmptyState title="No documents yet" body="Documents you create will be listed here with their versions. By default FairPath keeps a record of what you created, not the file itself." /> : null}
            {latest.map((x) => {
              const older = earlier(x.doc.document_type);
              return (
                <View key={x.doc.id}>
                  <ListRow
                    title={x.doc.title}
                    body={`Version ${x.doc.version} · ${x.doc.format.toUpperCase()} · ${dateText(x.doc.created_at)}`}
                    meta={[stale[x.doc.id] ? 'CHANGED SINCE YOU CREATED IT' : 'Up to date', x.doc.generated_by === 'device' ? 'Prepared on this device' : 'Prepared by FairPath', x.doc.has_stored_copy ? `Copy kept until ${dateText(x.doc.expires_at ?? x.doc.created_at)}` : 'No file stored'].join(' · ')}
                    onPress={() => router.push(('/documents/create?type=' + x.doc.document_type) as never)}
                  />
                  <View style={s.actions}>
                    {older.length ? <TextButton label={openTypes[x.doc.document_type] ? 'HIDE EARLIER VERSIONS' : `EARLIER VERSIONS (${older.length})`} onPress={() => setOpenTypes((o) => ({ ...o, [x.doc.document_type]: !o[x.doc.document_type] }))} /> : <View />}
                    <TextButton tone="danger" label="DELETE" onPress={() => remove(x)} />
                  </View>
                  {openTypes[x.doc.document_type] ? older.map((o) => (
                    <View key={o.doc.id} style={s.earlier}>
                      <Text style={s.earlierText}>Version {o.doc.version} · {o.doc.format.toUpperCase()} · {dateText(o.doc.created_at)}</Text>
                      <TextButton tone="danger" label="DELETE" onPress={() => remove(o)} />
                    </View>
                  )) : null}
                </View>
              );
            })}

            <View style={s.block}><SectionTitle>UPLOADED</SectionTitle></View>
            <ListRow title="Housing application documents" body="Documents you uploaded for a housing application are kept with that application." onPress={() => router.push('/housing-applications' as never)} />

            <Panel>
              <BodyText muted>
                Documents can contain personal information. FairPath never shares them with employers, landlords or partners on its own. Sharing always starts with a button you press.
              </BodyText>
            </Panel>
          </>
        ) : null}
      </ScrollView>
    </ScreenFrame>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { paddingHorizontal: L.mobileGutter, paddingBottom: 40, paddingTop: 14 },
  spinner: { marginTop: 28 },
  block: { marginTop: 22 },
  title: { color: t.text, fontFamily: F.extraBold, fontSize: 15 },
  actions: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, borderBottomWidth: 1, borderBottomColor: t.border },
  earlier: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingLeft: 14, borderBottomWidth: 1, borderBottomColor: t.border },
  earlierText: { color: t.textMuted, fontSize: 12 },
});
