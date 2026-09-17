import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LIME = '#A8F32C';
const BLACK = '#090A09';
const CARD = '#151715';
const MUTED = '#A7ACA7';

export default function HomeScreen() {
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <View style={styles.mark}><Text style={styles.markText}>FP</Text></View>
          <Text style={styles.brand}>FAIRPATH</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.eyebrow}>
            <View style={styles.dot} />
            <Text style={styles.eyebrowText}>OPPORTUNITY HAS A PATH</Text>
          </View>
          <Text style={styles.title}>Find your{`\n`}<Text style={styles.titleAccent}>FairPath</Text> forward.</Text>
          <Text style={styles.subtitle}>
            Jobs, housing, resources and support built to help you move forward — without judgment.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/sign-up')}>
            <Text style={styles.primaryButtonText}>Get started</Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </Pressable>
          <View style={styles.trustCard}>
            <View style={styles.trustLine} />
            <Text style={styles.trustText}>Your story is yours. FairPath helps you find what comes next.</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLACK },
  safeArea: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 42, height: 42, borderRadius: 13, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center' },
  markText: { color: BLACK, fontSize: 16, fontWeight: '900', letterSpacing: -1 },
  brand: { color: '#F6F7F5', fontSize: 17, fontWeight: '800', letterSpacing: 2.4 },
  hero: { flex: 1, justifyContent: 'center', paddingBottom: 20 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: LIME },
  eyebrowText: { color: LIME, fontSize: 11, fontWeight: '800', letterSpacing: 1.7 },
  title: { color: '#F7F8F6', fontSize: 50, lineHeight: 53, fontWeight: '800', letterSpacing: -2.4, maxWidth: 520 },
  titleAccent: { color: LIME },
  subtitle: { color: MUTED, fontSize: 17, lineHeight: 26, marginTop: 22, maxWidth: 500 },
  actions: { gap: 12 },
  primaryButton: { minHeight: 60, borderRadius: 18, backgroundColor: LIME, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryButtonText: { color: BLACK, fontSize: 17, fontWeight: '800' },
  arrow: { color: BLACK, fontSize: 25, fontWeight: '500' },
  secondaryButton: { minHeight: 58, borderRadius: 18, borderWidth: 1, borderColor: '#303330', alignItems: 'center', justifyContent: 'center', backgroundColor: CARD },
  secondaryButtonText: { color: '#F2F3F1', fontSize: 15, fontWeight: '700' },
  trustCard: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  trustLine: { width: 2, height: 32, borderRadius: 2, backgroundColor: LIME },
  trustText: { flex: 1, color: '#777D77', fontSize: 12, lineHeight: 17 },
});
