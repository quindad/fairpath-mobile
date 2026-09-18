import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

const LIME = '#A8F32C';
const BLACK = '#090A09';
const CARD = '#151715';
const BORDER = '#303330';
const MUTED = '#909690';
const ERROR = '#FF8A8A';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function signIn() {
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setErrorMessage('Enter your email and password.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        setErrorMessage(error.message === 'Invalid login credentials'
          ? 'That email or password does not match a FairPath account.'
          : error.message);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .single();

      if (profileError) {
        setErrorMessage('You are signed in, but FairPath could not load your profile. Try again.');
        return;
      }

      router.replace(profile?.onboarding_completed ? '/' : '/onboarding');
    } catch {
      setErrorMessage('We could not sign you in right now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>

          <View style={styles.heading}>
            <Text style={styles.kicker}>WELCOME BACK</Text>
            <Text style={styles.title}>Keep moving{String.fromCharCode(10)}forward.</Text>
            <Text style={styles.subtitle}>Sign in to your FairPath account and pick up where you left off.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor="#666C66"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              style={styles.input}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor="#666C66"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              style={styles.input}
              onSubmitEditing={signIn}
            />

            <Pressable onPress={() => router.push('/forgot-password')} style={styles.forgotButton}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={signIn}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
              <Text style={styles.arrow}>{loading ? '•' : '→'}</Text>
            </Pressable>
          </View>

          <View style={styles.signupRow}>
            <Text style={styles.signupMuted}>New to FairPath?</Text>
            <Pressable onPress={() => router.replace('/sign-up')}>
              <Text style={styles.signupLink}> Create account</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BLACK },
  safeArea: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 30 },
  backButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: '#F6F7F5', fontSize: 23, lineHeight: 25 },
  heading: { marginTop: 70, marginBottom: 42 },
  kicker: { color: LIME, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 15 },
  title: { color: '#F7F8F6', fontSize: 46, lineHeight: 49, fontWeight: '800', letterSpacing: -2.1 },
  subtitle: { color: MUTED, fontSize: 16, lineHeight: 24, marginTop: 18, maxWidth: 500 },
  form: { gap: 10 },
  label: { color: '#D7DAD6', fontSize: 13, fontWeight: '700', marginTop: 4 },
  input: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: BORDER, backgroundColor: CARD, color: '#F7F8F6', fontSize: 16, paddingHorizontal: 17 },
  forgotButton: { alignSelf: 'flex-end', paddingVertical: 5 },
  forgotText: { color: LIME, fontSize: 13, fontWeight: '800' },
  errorText: { color: ERROR, fontSize: 13, lineHeight: 19, marginTop: 4 },
  primaryButton: { minHeight: 60, borderRadius: 18, backgroundColor: LIME, paddingHorizontal: 20, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: BLACK, fontSize: 17, fontWeight: '800' },
  arrow: { color: BLACK, fontSize: 25 },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 'auto', paddingTop: 42 },
  signupMuted: { color: '#777D77', fontSize: 13 },
  signupLink: { color: LIME, fontSize: 13, fontWeight: '800' },
});