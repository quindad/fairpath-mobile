import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenFrame, PageHeader } from '@/components/ProductChrome';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { supabase } from '@/lib/supabase';
import { paymentsConfigured } from '@/core/payments/payments-service';

/**
 * DEV-only integration health view. Never shipped in production (__DEV__ gate below).
 *
 * Every row is explicitly labeled LIVE (queried right now, from this device) or STATIC (known from reading the
 * code/config, not re-verified here). Never blur the two — a STATIC "not connected" is not the same claim as a
 * LIVE failed check, and this screen must not imply more live verification than actually happens.
 */
type Row = { label: string; mode: 'LIVE' | 'STATIC'; status: string; detail?: string };

export default function DevIntegrationHealth() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const out: Row[] = [];

      // ---- LIVE checks: actually queried right now ----
      try {
        const { data: { session } } = await supabase.auth.getSession();
        out.push({ label: 'Supabase Auth session', mode: 'LIVE', status: session ? 'SESSION PRESENT' : 'SIGNED OUT' });
      } catch (e) {
        out.push({ label: 'Supabase Auth session', mode: 'LIVE', status: 'UNREACHABLE', detail: e instanceof Error ? e.message : String(e) });
      }

      try {
        const t0 = Date.now();
        const { error } = await supabase.from('coverage_markets').select('id', { count: 'exact', head: true });
        out.push({ label: 'Supabase DB (coverage_markets read)', mode: 'LIVE', status: error ? 'ERROR' : 'HEALTHY (' + (Date.now() - t0) + 'ms)', detail: error?.message });
      } catch (e) {
        out.push({ label: 'Supabase DB (coverage_markets read)', mode: 'LIVE', status: 'UNREACHABLE', detail: e instanceof Error ? e.message : String(e) });
      }

      try {
        const { count } = await supabase.from('coverage_markets').select('id', { count: 'exact', head: true });
        out.push({ label: 'Coverage markets configured', mode: 'LIVE', status: (count ?? 0) > 0 ? count + ' MARKET(S)' : '0 — EVERY ZIP DEFAULTS TO COMING_SOON' });
      } catch { out.push({ label: 'Coverage markets configured', mode: 'LIVE', status: 'CHECK FAILED' }); }

      try {
        const { count } = await supabase.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'published');
        out.push({ label: 'Job listings (open)', mode: 'LIVE', status: (count ?? 0) + ' — ALL DEV FIXTURE/SEED, NOT REAL INVENTORY' });
      } catch { out.push({ label: 'Job listings (open)', mode: 'LIVE', status: 'CHECK FAILED' }); }

      try {
        const { count } = await supabase.from('housing_listings').select('id', { count: 'exact', head: true }).eq('status', 'published');
        out.push({ label: 'Housing listings (active)', mode: 'LIVE', status: (count ?? 0) + ' — ALL DEV FIXTURE/SEED, NOT REAL INVENTORY' });
      } catch { out.push({ label: 'Housing listings (active)', mode: 'LIVE', status: 'CHECK FAILED' }); }

      try {
        const { count } = await supabase.from('external_opportunities').select('id', { count: 'exact', head: true });
        out.push({ label: 'Ingestion pipeline (external_opportunities rows)', mode: 'LIVE', status: (count ?? 0) + ' — pipeline exists in schema but is unused by any code' });
      } catch { out.push({ label: 'Ingestion pipeline (external_opportunities rows)', mode: 'LIVE', status: 'BLOCKED (RLS: server-only by design)' }); }

      out.push({ label: 'Payments client config', mode: 'LIVE', status: paymentsConfigured() ? 'STRIPE KEY PRESENT' : 'NO STRIPE KEY (.env not set)' });

      // ---- STATIC: known from code/config, not re-verified by this screen ----
      out.push({ label: 'Google Sign-In (Supabase provider)', mode: 'STATIC', status: 'UNKNOWN — check DEV Supabase dashboard, not visible from the client' });
      out.push({ label: 'Apple Sign-In', mode: 'STATIC', status: 'NOT CONFIGURED — needs Apple Developer capability + provider + native rebuild' });
      out.push({ label: 'Android Maps key', mode: 'STATIC', status: 'NOT SET in app.json' });
      out.push({ label: 'Walkability / schools / nearby-places provider', mode: 'STATIC', status: 'SCHEMA + UI READY, NO PROVIDER CONNECTED' });
      out.push({ label: 'Credit report extraction', mode: 'STATIC', status: 'FUNCTION NOT DEPLOYED TO DEV — disabled pending provider/privacy decision' });
      out.push({ label: 'Stripe Edge Function (stripe-webhook)', mode: 'STATIC', status: 'NOT DEPLOYED TO DEV' });
      out.push({ label: 'Push notification delivery', mode: 'STATIC', status: 'QUEUE ARCHITECTURE READY, NO CLIENT TOKEN REGISTRATION, NO SENDER WORKER' });
      out.push({ label: 'Email / SMS', mode: 'STATIC', status: 'NOT STARTED' });
      out.push({ label: 'Error monitoring / crash reporting', mode: 'STATIC', status: 'NOT STARTED' });
      out.push({ label: 'Product analytics', mode: 'STATIC', status: 'NOT STARTED' });
      out.push({ label: 'Record Relief real jurisdiction coverage', mode: 'STATIC', status: '0 of 50 states + DC — TEST-A..D fixtures only' });

      if (active) setRows(out);
    })();
    return () => { active = false; };
  }, []);

  return (
    <ScreenFrame>
      <PageHeader eyebrow="DEV ONLY — NEVER SHIPPED" title="Integration health" backTo="/me" />
      <ScrollView contentContainerStyle={s.content}>
        {!__DEV__ ? (
          <Text style={s.blocked}>This screen only renders in a development build.</Text>
        ) : !rows ? (
          <Text style={s.loading}>Checking…</Text>
        ) : (
          <>
            <Text style={s.note}>
              LIVE rows were queried from this device just now. STATIC rows are known from reading the code/config
              and are not re-verified by this screen — see docs/EXTERNAL_INTEGRATION_REGISTER.md and
              docs/FAIRPATH_MOBILE_LAUNCH_BOARD.md for full detail and evidence.
            </Text>
            {rows.map((r) => (
              <View key={r.label} style={s.row}>
                <View style={s.rowHead}>
                  <Text style={s.label}>{r.label}</Text>
                  <View style={[s.tag, r.mode === 'LIVE' ? s.tagLive : s.tagStatic]}><Text style={s.tagText}>{r.mode}</Text></View>
                </View>
                <Text style={s.status}>{r.status}</Text>
                {r.detail ? <Text style={s.detail}>{r.detail}</Text> : null}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenFrame>
  );
}

const s = StyleSheet.create({
  content: { padding: L.mobileGutter, paddingBottom: 48 },
  blocked: { color: C.mutedStrong, fontSize: 13 },
  loading: { color: C.muted, fontSize: 13 },
  note: { color: C.muted, fontSize: 10, lineHeight: 15, marginBottom: 18 },
  row: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: C.white, fontFamily: F.extraBold, fontSize: 11, flex: 1, paddingRight: 10 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  tagLive: { borderColor: C.lime, backgroundColor: '#10150C' },
  tagStatic: { borderColor: C.borderStrong },
  tagText: { color: C.lime, fontFamily: F.extraBold, fontSize: 7, letterSpacing: 1 },
  status: { color: C.mutedStrong, fontSize: 11, marginTop: 5 },
  detail: { color: C.danger, fontSize: 9, marginTop: 3 },
});
