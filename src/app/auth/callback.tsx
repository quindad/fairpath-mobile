import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../../lib/supabase';

const LIME = '#A8F32C';
const BLACK = '#090A09';
const MUTED = '#909690';
const ERROR = '#FF8A8A';

export default function AuthCallbackScreen() {
  const [message, setMessage] = useState('Verifying your FairPath account…');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;

    async function finishVerification() {
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      if (error) {
        setIsError(true);
        setMessage('We could not finish verification. Return to FairPath and sign in again.');
        return;
      }

      if (data.session) {
        setMessage('Email verified. Your FairPath account is ready.');
        return;
      }

      setMessage('Email verified. Return to FairPath and sign in with your account.');
    }

    finishVerification();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session) return;
      setIsError(false);
      setMessage('Email verified. Your FairPath account is ready.');
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.icon}>
            <Text style={styles.iconText}>{isError ? '!' : '✓'}</Text>
          </View>
          <Text style={styles.kicker}>FAIRPATH ACCOUNT</Text>
          <Text style={styles.title}>{isError ? 'Verification issue.' : 'You’re verified.'}</Text>
          <Text style={[styles.message, isError && styles.error]}>{message}</Text>
          <Text style={styles.note}>You can safely close this page after verification completes.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLACK },
  safeArea: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32 },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: LIME,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  iconText: { color: BLACK, fontSize: 30, fontWeight: '900' },
  kicker: { color: LIME, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 14 },
  title: { color: '#F7F8F6', fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1.8 },
  message: { color: MUTED, fontSize: 16, lineHeight: 24, marginTop: 16, maxWidth: 500 },
  error: { color: ERROR },
  note: { color: '#6F756F', fontSize: 12, lineHeight: 18, marginTop: 22 },
});