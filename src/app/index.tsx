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
        <View style={styles.brandLockup}>
          <View style={styles.logoRow}>
            <Text style={styles.logoF}>F</Text>
            <Text style={styles.logoP}>P</Text>
            <View style={styles.logoArrow}><Text style={styles.logoArrowText}>➜</Text></View>
          </View>
          <Text style={styles.brandWord}><Text style={styles.brandWhite}>Fair</Text>Path</Text>
          <Text style={styles.brandTag}>A FAIRPATH FORWARD.</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.eyebrow}>
            <View style={styles.eyebrowLine} />
            <Text style={styles.eyebrowText}>OPPORTUNITY HAS A PATH</Text>
          </View>
          <Text style={styles.title}>FIND YOUR{String.fromCharCode(10)}<Text style={styles.titleAccent}>FAIRPATH</Text>{String.fromCharCode(10)}FORWARD.</Text>
          <Text style={styles.subtitle}>Jobs, housing, resources and support built to help you move forward — without judgment.</Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/sign-up')}>
            <Text style={styles.primaryButtonText}>Get started</Text>
            <View style={styles.arrowWrap}><Text style={styles.arrow}>→</Text></View>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push('/sign-in')}>
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
  brandLockup: { alignSelf: 'center', alignItems: 'center', marginTop: 4 },
  logoRow: { height: 42, minWidth: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', position: 'relative' },
  logoF: { color: '#F7F8F6', fontFamily: 'LeagueSpartan_900Black', fontSize: 44, lineHeight: 46, letterSpacing: -7 },
  logoP: { color: LIME, fontFamily: 'LeagueSpartan_900Black', fontSize: 44, lineHeight: 46, letterSpacing: -4 },
  logoArrow: { position: 'absolute', right: -2, top: 7 },
  logoArrowText: { color: BLACK, fontSize: 21, fontWeight: '900' },
  brandWord: { color: LIME, fontFamily: 'LeagueSpartan_800ExtraBold', fontSize: 21, lineHeight: 22, letterSpacing: -0.8, marginTop: -2 },
  brandWhite: { color: '#F7F8F6' },
  brandTag: { color: '#D0D4CF', fontFamily: 'LeagueSpartan_700Bold', fontSize: 7, letterSpacing: 2.5, marginTop: 5 },
  hero: { flex: 1, justifyContent: 'center', paddingBottom: 6 },
  eyebrow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  eyebrowLine: { width: 42, height: 2, backgroundColor: LIME, borderRadius: 99 },
  eyebrowText: { color: LIME, fontFamily: 'LeagueSpartan_800ExtraBold', fontSize: 11, letterSpacing: 2 },
  title: { color: '#F7F8F6', fontFamily: 'LeagueSpartan_900Black', fontSize: 58, lineHeight: 51, letterSpacing: -2.2, maxWidth: 560 },
  titleAccent: { color: LIME },
  subtitle: { color: MUTED, fontSize: 17, lineHeight: 26, marginTop: 24, maxWidth: 500 },
  actions: { gap: 12 },
  primaryButton: { minHeight: 62, borderRadius: 17, backgroundColor: LIME, paddingLeft: 20, paddingRight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryButtonText: { color: BLACK, fontFamily: 'LeagueSpartan_800ExtraBold', fontSize: 17 },
  arrowWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  arrow: { color: BLACK, fontSize: 25, lineHeight: 27, marginTop: -2 },
  secondaryButton: { minHeight: 58, borderRadius: 17, borderWidth: 1, borderColor: '#303330', alignItems: 'center', justifyContent: 'center', backgroundColor: CARD },
  secondaryButtonText: { color: '#F2F3F1', fontFamily: 'LeagueSpartan_700Bold', fontSize: 15 },
  trustCard: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  trustLine: { width: 2, height: 32, borderRadius: 2, backgroundColor: LIME },
  trustText: { flex: 1, color: '#777D77', fontSize: 12, lineHeight: 17 },
});