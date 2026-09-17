import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LIME = '#A8F32C';
const BLACK = '#090A09';
const CARD = '#151715';
const BORDER = '#303330';
const MUTED = '#909690';

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const destination = email ? ' to ' + email : '';

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>✓</Text>
          </View>
          <Text style={styles.kicker}>ONE MORE STEP</Text>
          <Text style={styles.title}>Check your email.</Text>
          <Text style={styles.subtitle}>
            We sent a verification link{destination}. Open it to verify your FairPath account.
          </Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Didn't see it?</Text>
            <Text style={styles.cardText}>
              Check your spam or junk folder. Keep this screen open while you verify your email.
            </Text>
          </View>
          <Pressable style={styles.secondaryButton} onPress={() => router.replace('/sign-up')}>
            <Text style={styles.secondaryButtonText}>Use a different email</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLACK },
  safeArea: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  iconText: { color: BLACK, fontSize: 30, fontWeight: '900' },
  kicker: { color: LIME, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 14 },
  title: { color: '#F7F8F6', fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1.8 },
  subtitle: { color: MUTED, fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 500 },
  card: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, borderRadius: 18, padding: 18, marginTop: 32 },
  cardTitle: { color: '#F7F8F6', fontSize: 15, fontWeight: '800', marginBottom: 7 },
  cardText: { color: MUTED, fontSize: 14, lineHeight: 21 },
  secondaryButton: { minHeight: 56, borderRadius: 17, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  secondaryButtonText: { color: '#F7F8F6', fontSize: 15, fontWeight: '800' },
});
