import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { PageHeader, ScreenFrame, SectionTitle } from '@/components/ProductChrome';
import { notify } from '@/core/ui/notify';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { communityCategoryLabel } from '@/core/community/categories';
import {
  cancelCommunityHelpRequest,
  fulfillCommunityHelpRequest,
  getCommunityHelpRequest,
  loadOffersForRequest,
  offerCommunityHelp,
  respondCommunityHelpOffer,
  type CommunityHelpOfferRow,
  type CommunityHelpRequestRow,
} from '@/core/community/community-help-service';
import { searchOpportunities } from '@/core/opportunity/orchestrator';
import type { OpportunityResult } from '@/core/opportunity/types';
import { OpportunityResultsList } from '@/components/opportunity/OpportunityResultsList';
import { syncCommunityRequestPlan } from '@/core/opportunity/community-plan-sync';
import { communityPlanStatusHint, communityRequestStatusLabel } from '@/core/community/status-copy';
import { communityExchangeNotifyCopy } from '@/core/community/exchange-flow-errors';

export default function CommunityRequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<CommunityHelpRequestRow | null>(null);
  const [offers, setOffers] = useState<CommunityHelpOfferRow[]>([]);
  const [opportunityResults, setOpportunityResults] = useState<OpportunityResult[]>([]);
  const [fallbacks, setFallbacks] = useState<import('@/core/opportunity/types').OpportunityAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const req = await getCommunityHelpRequest(id);
    setRequest(req);
    if (req) {
      await syncCommunityRequestPlan({ requestId: req.id, description: req.description, status: req.status });
      const outcome = await searchOpportunities({
        needs: [{
          localId: req.id,
          kind: 'essential',
          category: req.category as import('@/core/community/categories').CommunityHelpCategoryId,
          label: req.description.slice(0, 60),
          urgency: req.urgency as import('@/core/community/categories').CommunityHelpUrgency,
          constraints: { pickupOk: req.pickup_ok, noPersonalTransport: !req.pickup_ok && req.delivery_preferred },
        }],
        location: { city: req.city, state: req.state, zip: req.postal_code, missing: false },
        rawQuery: req.description,
      });
      setOpportunityResults(outcome.results);
      setFallbacks(outcome.fallbacks);
      const off = req.is_owner ? await loadOffersForRequest(id) : [];
      setOffers(off);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      setLoading(true);
      (async () => {
        try {
          await reload();
        } finally {
          if (live) setLoading(false);
        }
      })();
      return () => {
        live = false;
      };
    }, [reload]),
  );

  async function onOffer() {
    if (!id || actionBusy) return;
    setActionBusy(true);
    try {
      await offerCommunityHelp(id);
      notify('Offer sent', 'The member will be notified. Coordinate pickup safely if they accept.');
      router.push('/marketplace' as never);
    } catch (e) {
      const copy = communityExchangeNotifyCopy('offer_help', e);
      if (copy.signedOut) router.push(('/sign-in?returnTo=' + (copy.returnTo ?? '/community/can-help')) as never);
      else notify(copy.title, copy.body);
    } finally {
      setActionBusy(false);
    }
  }

  async function onRespond(offerId: string, accept: boolean) {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await respondCommunityHelpOffer(offerId, accept);
      await reload();
      notify(
        accept ? 'Offer accepted' : 'Offer declined',
        accept ? 'Status is matched — not fulfilled until you confirm assistance happened.' : '',
      );
    } catch (e) {
      const copy = communityExchangeNotifyCopy('respond_offer', e);
      notify(copy.title, copy.body);
    } finally {
      setActionBusy(false);
    }
  }

  async function onCancel() {
    if (!id || actionBusy) return;
    setActionBusy(true);
    try {
      await cancelCommunityHelpRequest(id);
      notify('Request cancelled', '');
      router.back();
    } catch (e) {
      const copy = communityExchangeNotifyCopy('cancel_request', e);
      if (copy.signedOut) router.push(('/sign-in?returnTo=/community/need-help/' + id) as never);
      else notify(copy.title, copy.body);
    } finally {
      setActionBusy(false);
    }
  }

  async function onFulfill() {
    if (!id || actionBusy) return;
    setActionBusy(true);
    try {
      await fulfillCommunityHelpRequest(id);
      notify('Marked fulfilled', 'Thank you for closing the loop.');
      await reload();
    } catch (e) {
      const copy = communityExchangeNotifyCopy('fulfill_request', e);
      if (copy.signedOut) router.push(('/sign-in?returnTo=/community/need-help/' + id) as never);
      else notify(copy.title, copy.body);
    } finally {
      setActionBusy(false);
    }
  }

  if (loading && !request) {
    return (
      <ScreenFrame>
        <PageHeader eyebrow="REQUEST" title="Loading…" backTo="/community/need-help" />
        <View style={s.loadingWrap}>
          <ActivityIndicator color={C.lime} />
          <Text style={s.muted}>Loading request…</Text>
        </View>
      </ScreenFrame>
    );
  }

  if (!request) {
    return (
      <ScreenFrame>
        <PageHeader eyebrow="REQUEST" title="Not found" backTo="/community/need-help" />
        <Text style={s.muted}>This request is unavailable, expired, or you do not have access.</Text>
      </ScreenFrame>
    );
  }

  const owner = request.is_owner;
  const statusHint = communityPlanStatusHint(request.status);
  const terminal = request.status === 'fulfilled' || request.status === 'cancelled' || request.status === 'expired';

  return (
    <ScreenFrame>
      <PageHeader eyebrow="REQUEST" title={communityCategoryLabel(request.category)} backTo="/community/need-help" />
      <FormScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.statusBanner}>
          <Text style={s.statusTitle}>{communityRequestStatusLabel(request.status)}</Text>
          {statusHint ? <Text style={s.statusHint}>{statusHint}</Text> : null}
        </View>
        <Text style={s.desc}>{request.description}</Text>
        <Text style={s.meta}>{request.urgency.replace('_', ' ')} · {request.city}, {request.state}</Text>
        {owner && !terminal ? (
          <View style={s.ownerActions}>
            {request.status === 'matched' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: actionBusy }}
                style={[s.primary, actionBusy && s.disabled]}
                disabled={actionBusy}
                onPress={() => void onFulfill()}
              >
                <Text style={s.primaryText}>Mark assistance fulfilled</Text>
              </Pressable>
            ) : null}
            {request.status === 'open' || request.status === 'matched' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: actionBusy }}
                style={[s.outline, actionBusy && s.disabled]}
                disabled={actionBusy}
                onPress={() => void onCancel()}
              >
                <Text style={s.outlineText}>Cancel request</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {!owner && request.status === 'open' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: actionBusy }}
            style={[s.primary, actionBusy && s.disabled]}
            disabled={actionBusy}
            onPress={() => void onOffer()}
          >
            <Text style={s.primaryText}>{actionBusy ? 'Sending offer…' : 'Offer to help'}</Text>
          </Pressable>
        ) : null}
        {!owner && request.status === 'matched' ? (
          <Text style={s.muted}>This request already has an accepted helper.</Text>
        ) : null}

        <SectionTitle>Paths FairPath found</SectionTitle>
        <Text style={s.sectionHelp}>Resources and community listings are starting points — always confirm hours, eligibility, and availability with the provider or donor.</Text>

        <OpportunityResultsList results={opportunityResults} fallbacks={fallbacks} />

        {owner && offers.length ? (
          <>
            <SectionTitle>Offers from helpers</SectionTitle>
            {offers.filter((o) => o.status === 'offered').map((o) => (
              <View key={o.id} style={s.card}>
                {o.note ? <Text style={s.cardBody}>{o.note}</Text> : <Text style={s.cardBody}>A member offered to help.</Text>}
                <View style={s.row}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={actionBusy}
                    style={[s.primarySmall, actionBusy && s.disabled]}
                    onPress={() => void onRespond(o.id, true)}
                  >
                    <Text style={s.primaryText}>Accept</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={actionBusy}
                    style={[s.outline, actionBusy && s.disabled]}
                    onPress={() => void onRespond(o.id, false)}
                  >
                    <Text style={s.outlineText}>Decline</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </FormScrollView>
    </ScreenFrame>
  );
}

const s = {
  scroll: { flex: 1 },
  content: { padding: L.mobileGutter, paddingBottom: 48, gap: 10 },
  loadingWrap: { padding: L.mobileGutter, alignItems: 'center' as const, gap: 12 },
  statusBanner: { borderWidth: 1, borderColor: C.borderStrong, padding: 12, backgroundColor: '#0A0C0A', gap: 4 },
  statusTitle: { color: C.lime, fontFamily: F.extraBold, fontSize: 13, lineHeight: 18 },
  statusHint: { color: C.mutedStrong, fontSize: 12, lineHeight: 17 },
  desc: { color: C.white, fontFamily: F.semiBold, fontSize: 15, lineHeight: 22 },
  meta: { color: C.mutedStrong, fontSize: 12, marginBottom: 4 },
  muted: { color: C.mutedStrong, fontSize: 12, lineHeight: 18, padding: L.mobileGutter },
  sectionHelp: { color: C.mutedStrong, fontSize: 12, lineHeight: 18, marginBottom: 6 },
  card: { borderWidth: 1, borderColor: C.borderStrong, padding: 12, backgroundColor: '#0A0C0A', marginTop: 6 },
  cardBody: { color: C.white, fontSize: 13, lineHeight: 19 },
  primary: { minHeight: 48, backgroundColor: C.lime, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 16, marginVertical: 4 },
  primaryText: { color: C.black, fontFamily: F.extraBold, fontSize: 13 },
  primarySmall: { flex: 1, minHeight: 44, backgroundColor: C.lime, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 8 },
  outline: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: C.borderStrong, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 8 },
  outlineText: { color: C.white, fontFamily: F.semiBold, fontSize: 13 },
  ownerActions: { flexDirection: 'column' as const, gap: 8, marginBottom: 4 },
  row: { flexDirection: 'row' as const, gap: 8, marginTop: 10 },
  disabled: { opacity: 0.55 },
};
