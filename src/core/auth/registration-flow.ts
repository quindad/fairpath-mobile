/** Whether the member still needs to record current Terms + Privacy (RPC + profile pointers). */
export type RegistrationConsentContext = 'registration' | 'renewal';

export function registrationConsentContext(profile: {
  terms_accepted_at?: string | null;
  privacy_accepted_at?: string | null;
} | null | undefined): RegistrationConsentContext {
  if (!profile?.terms_accepted_at && !profile?.privacy_accepted_at) return 'registration';
  return 'renewal';
}

export function acceptTermsScreenCopy(context: RegistrationConsentContext) {
  if (context === 'renewal') {
    return {
      kicker: 'UPDATED AGREEMENTS',
      title: 'Review the latest Terms and Privacy',
      body: 'FairPath updated its legal documents. Read the current versions and confirm to keep using your member account.',
      primary: 'Save agreement and continue',
      cancelLabel: 'Sign out for now',
      cancelHint: 'You will not stay signed in on this device. Your account is not deleted.',
    };
  }
  return {
    kicker: 'FINISH REGISTRATION',
    title: 'Review Terms and Privacy',
    body: 'You are signed in. To finish creating your FairPath member account, read each document and agree below. Browsing as a guest does not require this step.',
    primary: 'Complete registration',
    cancelLabel: 'Cancel registration',
    cancelHint: 'We will sign you out on this device only. Your account is not deleted unless you request deletion later.',
  };
}
