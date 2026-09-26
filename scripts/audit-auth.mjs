// Social auth audit (Apple + Google) and identity-model checks.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const failures = [];
const check = (c, m) => { if (!c) failures.push(m); };

const social = read('src/core/auth/social-auth.ts');
const socialCode = social.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const buttons = read('src/components/SocialAuthButtons.tsx');
const signIn = read('src/app/sign-in.tsx');
const signUp = read('src/app/sign-up.tsx');
const app = JSON.parse(read('app.json'));
const mig = read('supabase/migrations/20260929120000_auth_profile_hardening.sql');

// entry points
check(/signInWithApple/.test(social) && /signInWithGoogle/.test(social), 'Apple and Google entry points must exist.');
check(/<SocialAuthButtons/.test(signIn) && /<SocialAuthButtons/.test(signUp), 'Sign-in and sign-up must both offer Apple/Google.');
check(/signInWithPassword/.test(signIn) && /auth\.signUp\(/.test(signUp), 'Email/password sign-in and sign-up must remain.');
// real provider auth through Supabase
check(/signInWithIdToken\(\{ provider: 'apple'/.test(social) && /nonce: rawNonce/.test(social) && /SHA256/.test(social), 'Apple must use a nonce-bound native id token through Supabase.');
check(/signInWithOAuth\(\{\s*provider: 'google'/.test(social) && /openAuthSessionAsync/.test(social) && /setSession/.test(social), 'Google must use Supabase OAuth via the system browser.');
check(/AppleAuthenticationButton/.test(buttons), "Apple's official button component must be used.");
// no fake success / client identity
check(!/from\('profiles'\)\s*\.insert|\.upsert\(/.test(socialCode), 'The client must never create profiles; the database trigger does.');
check(!/user_id\s*:|id:\s*user\.id|p_user_id/.test(socialCode), 'No client-supplied user id may be sent.');
check(/maybeSingle\(\)/.test(social) && /could not load your profile/.test(social), 'A missing profile must be reported, not papered over.');
check(!/signInAnonymously|setSession\(\{\s*access_token:\s*['"`]/.test(socialCode), 'No fabricated sessions.');
check(/ERR_REQUEST_CANCELED/.test(social) && /status: 'cancelled'/.test(social), 'Cancellation must be handled cleanly.');
check(/!profile\.first_name && !profile\.last_name/.test(social) && /credential\.fullName\?\./.test(social), 'Apple names arrive only once and may be hidden: fill blanks only, never assume them.');
check(!/email\s*===|\.email\s*==|merge|linkIdentity/i.test(socialCode), 'The client must not implement its own email-based account merging/linking.');
check(/needsConsent/.test(social) && fs.existsSync('src/app/accept-terms.tsx') && /recordSignUpConsent/.test(read('src/app/accept-terms.tsx')), 'First-time social members must accept Terms/Privacy through the consent ledger.');
check(/agreedToTerms/.test(signUp.split('<SocialAuthButtons')[1] ?? ''), 'Sign-up must require the terms checkbox before social sign-up.');
// config
check(app.expo.ios.usesAppleSignIn === true && app.expo.plugins.includes('expo-apple-authentication'), 'app.json must enable the Sign in with Apple capability.');
// server-side identity
check(!/raw_user_meta_data\s*->>\s*'account_type'|meta\s*->>\s*'account_type'/.test(mig) && /'member'/.test(mig), 'handle_new_user must not trust client-supplied account_type.');
check(/protect_profile_account_type/.test(mig) && /ACCOUNT_TYPE_LOCKED/.test(mig), 'Clients must not be able to change account_type.');
check(/on conflict \(id\) do nothing/.test(mig), 'Profile creation must be one-per-auth-user.');
check(!/account_type/.test(signUp.replace("account_type: 'member',", '')), 'Sign-up must not send anything but a member account_type.');

// executable: redirect parsing
const { parseAuthRedirect } = await import('../src/core/auth/auth-redirect.ts');
const ok = parseAuthRedirect('fairpathmobile://auth/callback#access_token=a1&refresh_token=r1&expires_in=3600');
check(ok.accessToken === 'a1' && ok.refreshToken === 'r1' && !ok.error, 'Redirect tokens must parse from the hash.');
const bad = parseAuthRedirect('fairpathmobile://auth/callback#error=access_denied&error_description=User+cancelled');
check(bad.error === 'User cancelled' && !bad.accessToken, 'Provider errors must parse and carry no tokens.');
check(!parseAuthRedirect('fairpathmobile://auth/callback').accessToken, 'A bare redirect has no tokens.');

if (failures.length) { console.error('Auth audit failed:\n- ' + failures.join('\n- ')); process.exit(1); }
console.log('Auth audit passed: Apple (nonce id-token) + Google (Supabase OAuth) + email/password; one profile per auth user; no client identity, merging or fake sessions.');
