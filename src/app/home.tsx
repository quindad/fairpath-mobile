import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { notify } from '@/core/ui/notify';
import { FairPathLogo } from '@/components/FairPathLogo';
import { Lucide } from '@react-native-vector-icons/lucide';
import { ScreenFrame } from '@/components/ProductChrome';
import { HomeStatus } from '@/components/HomeStatus';
import { CommunityHelpPanel } from '@/components/CommunityHelpPanel';
import { FairPathColors as C, FairPathFonts as F, FairPathLayout as L } from '@/constants/fairpath';
import { loadFairPathReadiness } from '@/core/profile/profile-service';
import { homeFocusLine, loadHomePersonalization, type HomePersonalization } from '@/core/profile/home-personalization';
import { loadMemberCapabilities, type MemberCapabilities } from '@/core/profile/member-capabilities';
import { loadJobs, loadSavedJobIds, loadUnreadNotificationCount, saveJob, unsaveJob, type Job } from '@/core/opportunities/opportunity-service';
import { loadMemberSummary } from '@/core/profile/member-summary';

export default function Home() {
  const pathname = usePathname();
  const [personalization, setPersonalization] = useState<HomePersonalization | null>(null);
  const [caps, setCaps] = useState<MemberCapabilities | null>(null);
  const [readiness, setReadiness] = useState<number | null>(null);
  const [jobAppCount, setJobAppCount] = useState(0);
  const [savedJobCount, setSavedJobCount] = useState(0);
  const [search, setSearch] = useState('');
  const [featured, setFeatured] = useState<Job[]>([]);
  const [jobsState, setJobsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [unread, setUnread] = useState(0);
  const [savedJobs, setSavedJobs] = useState<Record<string, boolean>>({});

  const greetingName = personalization?.firstName?.trim() || null;
  const contextLine = homeFocusLine(personalization, caps);

  useEffect(() => {
    let a = true;
    loadUnreadNotificationCount().then((n) => { if (a) setUnread(n); });
    return () => { a = false; };
  }, [pathname, reloadKey]);

  useEffect(() => {
    let active = true;
    setJobsState((prev) => (prev === 'ready' ? prev : 'loading'));
    if (reloadKey > 0) setFeatured([]);
    loadFairPathReadiness()
      .then((x) => { if (active) setReadiness(x.readiness.overallPercentage); })
      .catch(() => { if (active) setReadiness(null); });
    loadHomePersonalization()
      .then((x) => { if (active) setPersonalization(x); })
      .catch(() => { if (active) setPersonalization(null); });
    loadMemberCapabilities()
      .then((x) => { if (active) setCaps(x); })
      .catch(() => { if (active) setCaps(null); });
    loadMemberSummary()
      .then((x) => {
        if (!active) return;
        setJobAppCount(x?.jobs?.applied ?? 0);
        setSavedJobCount(x?.jobs?.saved ?? 0);
      })
      .catch(() => {
        if (active) {
          setJobAppCount(0);
          setSavedJobCount(0);
        }
      });
    loadJobs('', '', {}, 2)
      .then((x) => { if (active) { setFeatured(x.slice(0, 2)); setJobsState('ready'); } })
      .catch(()=>{if(active){setFeatured([]);setJobsState('error')}});
    loadSavedJobIds()
      .then((ids) => { if (active) setSavedJobs(Object.fromEntries(ids.map((id) => [id, true]))); })
      .catch(() => {});
    return () => { active = false; };
  }, [pathname, reloadKey]);

  function openSearch() {
    const q = search.trim();
    router.push((q ? `/find-jobs?search=${encodeURIComponent(q)}` : '/explore') as never);
  }

  return (
    <ScreenFrame>
      <FormScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <FairPathLogo width={108} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            style={s.bell}
            onPress={() => router.push('/notifications' as never)}
          >
            <Lucide name="bell" color={C.white} size={18} />
            {unread > 0 ? (
              <View style={s.bellBadge}>
                <Text style={s.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <Text style={s.greeting}>
          {greetingName ? `Hello, ${greetingName}` : 'Welcome to FairPath'}
        </Text>
        {contextLine ? <Text style={s.context} numberOfLines={2}>{contextLine}</Text> : null}

        <View style={s.search}>
          <Lucide name="search" color={C.lime} size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={openSearch}
            style={s.searchInput}
            placeholder="Search jobs and opportunities"
            placeholderTextColor={C.muted}
          />
          {search.length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setSearch('')}>
              <Text style={s.clearSearch}>×</Text>
            </Pressable>
          ) : null}
        </View>

        <HomeStatus />

        <CommunityHelpPanel />

        {readiness != null && readiness < 100 ? (
          <Pressable
            accessibilityRole="button"
            style={s.readinessRow}
            onPress={() => router.push('/complete-profile' as never)}
          >
            <Text style={s.readinessText}>Profile {readiness}% complete</Text>
            <Text style={s.readinessLink}>Finish →</Text>
          </Pressable>
        ) : null}

        <View style={s.sectionHead}>
          <Text style={s.sectionTitle}>Jobs for you</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/find-jobs' as never)}>
            <Text style={s.sectionLink}>See all</Text>
          </Pressable>
        </View>

        {jobsState==='loading' && featured.length === 0 ? (
          <Text style={s.muted}>Loading jobs…</Text>
        ) : null}
        {jobsState==='error' && featured.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>Couldn&apos;t load jobs</Text>
            <Text style={s.muted}>Check your connection and try again.</Text>
            <Pressable accessibilityRole="button" style={s.retryBtn} onPress={() => setReloadKey((k) => k + 1)}>
              <Text style={s.retryText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : null}
        {jobsState==='ready' && featured.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>NO OPEN JOBS RIGHT NOW</Text>
            <Text style={s.muted}>Try Explore for housing, community, and record relief while listings grow.</Text>
            <Pressable accessibilityRole="button" style={s.retryBtn} onPress={() => router.push('/explore' as never)}>
              <Text style={s.retryText}>Open Explore</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={s.jobList}>
          {featured.map((j) => {
            const saved = !!savedJobs[j.id];
            return (
              <Pressable
                key={j.id}
                accessibilityRole="button"
                style={s.jobRow}
                onPress={() => router.push(`/job/${j.id}` as never)}
              >
                <View style={s.jobMain}>
                  <Text style={s.jobTitle} numberOfLines={2}>{j.title}</Text>
                  <Text style={s.jobSub} numberOfLines={1}>
                    {j.company_name}
                    {j.location_text || [j.city, j.state].filter(Boolean).join(', ')
                      ? ` · ${j.location_text || [j.city, j.state].filter(Boolean).join(', ')}`
                      : ''}
                  </Text>
                  {j.pay_min != null ? (
                    <Text style={s.jobPay}>
                      ${Number(j.pay_min).toLocaleString()}
                      {j.pay_max ? `–$${Number(j.pay_max).toLocaleString()}` : ''}
                      {` / ${j.pay_period || 'period'}`}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={saved ? 'Remove saved job' : 'Save job'}
                  hitSlop={12}
                  style={[s.saveBtn, saved && s.saveBtnOn]}
                  onPress={() => {
                    const action = saved ? unsaveJob(j.id) : saveJob(j.id);
                    action
                      .then(() => setSavedJobs((prev) => ({ ...prev, [j.id]: !saved })))
                      .catch((err) => {
                        if (err instanceof Error && err.message === 'SIGNED_OUT') {
                          router.push('/sign-in?returnTo=/home' as never);
                          return;
                        }
                        notify('Could not update saved job', 'Please try again.');
                      });
                  }}
                >
                  <Lucide name={saved ? 'bookmark-check' : 'bookmark'} color={saved ? C.black : C.white} size={16} />
                </Pressable>
              </Pressable>
            );
          })}
        </View>

        <View style={s.shortcuts}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/my-path' as never)}>
            <Text style={s.quickLink}>My Path</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/job-applications' as never)}>
            <Text style={s.quickLink}>
              Applications{jobAppCount > 0 ? ` (${jobAppCount})` : ''}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/saved-jobs' as never)}>
            <Text style={s.quickLink}>
              Saved jobs{savedJobCount > 0 ? ` (${savedJobCount})` : ''}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/fairpath-ai' as never)}>
            <Text style={s.quickLink}>Signal</Text>
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" style={s.exploreCta} onPress={() => router.push('/explore' as never)}>
          <Text style={s.exploreText}>Browse all of FairPath in Explore</Text>
          <Lucide name="arrow-right" color={C.lime} size={18} />
        </Pressable>
      </FormScrollView>
    </ScreenFrame>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: L.mobileGutter, paddingTop: 8, paddingBottom: 36 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    backgroundColor: C.lime,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  bellBadgeText: { color: C.black, fontFamily: F.extraBold, fontSize: 10 },
  greeting: { color: C.white, fontFamily: F.extraBold, fontSize: 24, lineHeight: 28, letterSpacing: -0.5 },
  context: { color: C.mutedStrong, fontFamily: F.medium, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 2 },
  search: {
    minHeight: 48,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: C.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, color: C.white, fontFamily: F.medium, fontSize: 15, paddingVertical: 0 },
  clearSearch: { color: C.mutedStrong, fontSize: 22, paddingLeft: 8 },
  readinessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#0A0C0A',
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  readinessText: { color: C.mutedStrong, fontFamily: F.semiBold, fontSize: 13 },
  readinessLink: { color: C.lime, fontFamily: F.extraBold, fontSize: 13 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 },
  sectionTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 17 },
  sectionLink: { color: C.lime, fontFamily: F.semiBold, fontSize: 14 },
  muted: { color: C.mutedStrong, fontSize: 13, lineHeight: 19 },
  emptyBox: { gap: 8, paddingVertical: 8 },
  emptyTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 15 },
  retryBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: C.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: { color: C.black, fontFamily: F.extraBold, fontSize: 13 },
  jobList: { gap: 10 },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: '#0B0D0B',
  },
  jobMain: { flex: 1, minWidth: 0 },
  jobTitle: { color: C.white, fontFamily: F.extraBold, fontSize: 15, lineHeight: 20 },
  jobSub: { color: C.mutedStrong, fontFamily: F.medium, fontSize: 13, marginTop: 4 },
  jobPay: { color: C.white, fontFamily: F.semiBold, fontSize: 13, marginTop: 6 },
  saveBtn: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: C.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.black,
  },
  saveBtnOn: { backgroundColor: C.lime, borderColor: C.lime },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  quickLink: {
    color: C.mutedStrong,
    fontFamily: F.semiBold,
    fontSize: 13,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: '#0A0C0A',
  },
  exploreCta: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.borderStrong,
    backgroundColor: '#0A0C0A',
  },
  exploreText: { color: C.white, fontFamily: F.semiBold, fontSize: 14, flex: 1, paddingRight: 12 },
});
