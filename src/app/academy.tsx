import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { FilterStrip, PageHeader, ScreenFrame, SectionTitle, SharpChip } from '@/components/ProductChrome';
import { useThemedStyles } from '@/core/theme/ThemeProvider';
import type { ThemeTokens } from '@/core/theme/tokens';
import { type CanonicalCourse, type CostClass } from '@/core/academy/catalog-contract';
import { searchCourses } from '@/core/academy/catalog-search';
import { DEV_FIXTURE_COURSES } from '@/core/academy/fixtures';

const CATALOG = DEV_FIXTURE_COURSES;

const COST_OPTIONS: { value: CostClass; label: string }[] = [
  { value: 'free', label: 'Free' },
  { value: 'free_with_paid_certificate', label: 'Free to learn, paid certificate' },
  { value: 'low_cost', label: 'Low cost' },
  { value: 'sponsored', label: 'Sponsored' },
  { value: 'paid', label: 'Paid' },
];

const COST_TEXT: Record<CostClass, string> = {
  free: 'Free',
  free_with_paid_certificate: 'Free to learn · certificate costs money',
  low_cost: 'Low cost',
  paid: 'Paid',
  sponsored: 'Sponsored seat',
  unknown: 'Price not verified',
};

export default function AcademyScreen() {
  const s = useThemedStyles(styles);
  const [query, setQuery] = useState('');
  const [costs, setCosts] = useState<CostClass[]>([]);

  const results = useMemo(
    () => searchCourses(CATALOG, { query, costClasses: costs }),
    [query, costs],
  );

  const toggleCost = (c: CostClass) =>
    setCosts((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  return (
    <ScreenFrame>
      <PageHeader eyebrow="FAIRPATH ACADEMY" title="Learn" backTo="/home" />
      <FormScrollView contentContainerStyle={s.content}>
        <View style={s.banner} accessibilityRole="summary">
          <Text style={s.bannerTitle}>Real, free national programs moved to Resources</Text>
          <Text style={s.bannerBody}>
            CareerOneStop, Per Scholas, Job Corps, and other real free/low-cost national programs now live in the Resources tab, where you can search and filter them alongside local help. The catalog below is development fixtures only — real paid-provider catalogs like Coursera or Udemy, with their own recognized certificates, appear here once a real partnership or affiliate agreement is set up.
          </Text>
          <Pressable accessibilityRole="link" onPress={() => router.push('/resources' as never)}>
            <Text style={s.link}>OPEN RESOURCES →</Text>
          </Pressable>
        </View>

        <TextInput
          style={s.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search courses, skills, or careers"
          placeholderTextColor={s.placeholder.color}
          accessibilityLabel="Search courses"
          returnKeyType="search"
        />

        <SectionTitle>Cost</SectionTitle>
        <FilterStrip>
          {COST_OPTIONS.map((o) => (
            <SharpChip key={o.value} label={o.label} active={costs.includes(o.value)} onPress={() => toggleCost(o.value)} />
          ))}
        </FilterStrip>

        <SectionTitle>{results.length} {results.length === 1 ? 'course' : 'courses'}</SectionTitle>
        {results.length === 0 ? (
          <View style={s.card}>
            <Text style={s.cardTitle}>No courses match</Text>
            <Text style={s.cardBody}>Try a broader search or remove a cost filter.</Text>
          </View>
        ) : (
          results.map((c) => <CourseCard key={c.id} course={c} />)
        )}
      </FormScrollView>
    </ScreenFrame>
  );
}

function CourseCard({ course }: { course: CanonicalCourse }) {
  const s = useThemedStyles(styles);
  return (
    <View style={s.card} accessibilityLabel={`${course.title}. ${COST_TEXT[course.costClass]}.`}>
      <Text style={s.cardTitle}>{course.title}</Text>
      <Text style={s.cost}>{COST_TEXT[course.costClass]}</Text>
      {course.description ? <Text style={s.cardBody}>{course.description}</Text> : null}
      <Text style={s.cardBody}>
        {course.category} · {course.difficulty} · {course.durationHours ? `${course.durationHours} hours` : 'duration not listed'}
      </Text>
      <Text style={s.cardBody}>Eligibility: {course.eligibility}</Text>
      <Text style={s.help}>Provider: {course.providerId} · Verified {course.lastVerified?.slice(0, 10) ?? 'never'}</Text>
      {course.enrollmentUrl ? (
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(course.enrollmentUrl)}>
          <Text style={s.link}>GO TO COURSE →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = (t: ThemeTokens) => ({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  banner: { borderLeftWidth: 3, borderLeftColor: t.accent, backgroundColor: t.surface, padding: 14, gap: 6 },
  bannerTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  bannerBody: { color: t.textSecondary, fontSize: 14, lineHeight: 20 },
  search: { minHeight: 48, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.input, color: t.text, paddingHorizontal: 12, fontSize: 16 },
  placeholder: { color: t.textMuted },
  card: { borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, padding: 14, gap: 6 },
  cardTitle: { color: t.text, fontWeight: '700' as const, fontSize: 16 },
  cardBody: { color: t.textSecondary, fontSize: 15, lineHeight: 21 },
  cost: { color: t.accent, fontWeight: '700' as const, fontSize: 14 },
  help: { color: t.textSecondary, fontSize: 13, lineHeight: 19 },
  link: { color: t.accent, fontWeight: '700' as const, fontSize: 13, marginTop: 6 },
});
