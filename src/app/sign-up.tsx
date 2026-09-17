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

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function createAccount() {
    if (loading) return;

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirstName || !cleanLastName || !cleanEmail || !password) {
      setErrorMessage('Complete every field to create your FairPath account.');
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setErrorMessage('Enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Create a password with at least 8 characters.');
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            first_name: cleanFirstName,
            last_name: cleanLastName,
            account_type: 'member',
          },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (data.session) {
        router.replace('/check-email?email=' + encodeURIComponent(cleanEmail));
        return;
      }

      router.replace('/check-email?email=' + encodeURIComponent(cleanEmail));
    } catch {
      setErrorMessage('We could not create your account right now. Check your connection and try again.');
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
            <Text style={styles.kicker}>YOUR FAIRPATH STARTS HERE</Text>
            <Text style={styles.title}>Create your{`\n`}FairPath.</Text>
            <Text style={styles.subtitle}>
              One account for opportunities, resources and support built around where you're headed next.
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.nameRow}>
              <View style={styles.halfField}>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="First name"
                  placeholderTextColor="#666C66"
                  autoCapitalize="words"
                  autoComplete="given-name"
                  style={styles.input}
                />
              </View>
              <View style={styles.halfField}>
                <Text style={styles.label}>Last name</Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Last name"
                  placeholderTextColor="#666C66"
                  autoCapitalize="words"
                  autoComplete="family-name"
                  style={styles.input}
                />
              </View>
            </View>

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
              placeholder="At least 8 characters"
              placeholderTextColor="#666C66"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              style={styles.input}
              onSubmitEditing={createAccount}
            />

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            <Pressable
              style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
              onPress={createAccount}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>{loading ? 'Creating account…' : 'Create account'}</Text>
              <Text style={styles.arrow}>{loading ? '•' : '→'}</Text>
            </Pressable>

            <Text style={styles.terms}>
              By continuing, you agree to FairPath's Terms and Privacy Policy.
            </Text>
          </View>

          <View style={styles.loginRow}>
            <Text style={styles.loginMuted}>Already have an account?</Text>
            <Text style={styles.loginLink}> Sign in</Text>
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
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: { color: '#F6F7F5', fontSize: 23, lineHeight: 25 },
  heading: { marginTop: 46, marginBottom: 36 },
  kicker: { color: LIME, fontSize: 11, fontWeight: '800', letterSpacing: 1.6, marginBottom: 15 },
  title: { color: '#F7F8F6', fontSize: 46, lineHeight: 49, fontWeight: '800', letterSpacing: -2.1 },
  subtitle: { color: MUTED, fontSize: 16, lineHeight: 24, marginTop: 18, maxWidth: 500 },
  form: { gap: 10 },
  nameRow: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1, gap: 10 },
  label: { color: '#D7DAD6', fontSize: 13, fontWeight: '700', marginTop: 4 },
  input: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    color: '#F7F8F6',
    fontSize: 16,
    paddingHorizontal: 17,
  },
  errorText: { color: ERROR, fontSize: 13, lineHeight: 19, marginTop: 4 },
  primaryButton: {
    minHeight: 60,
    borderRadius: 18,
    backgroundColor: LIME,
    paddingHorizontal: 20,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButtonDisabled: { opacity: 0.65 },
  primaryButtonText: { color: BLACK, fontSize: 17, fontWeight: '800' },
  arrow: { color: BLACK, fontSize: 25 },
  terms: { color: '#6F756F', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 4 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 'auto', paddingTop: 38 },
  loginMuted: { color: '#777D77', fontSize: 13 },
  loginLink: { color: LIME, fontSize: 13, fontWeight: '800' },
});
