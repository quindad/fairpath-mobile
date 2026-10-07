// Safety & Recovery: emergency resources. Only nationally known, publicly verifiable numbers are listed. No local or
// program-specific directory is invented. This module is content only; it carries no member data.

export type EmergencyResource = { id: string; name: string; number: string; availability: string; note: string };

export const EMERGENCY_RESOURCES: readonly EmergencyResource[] = [
  { id: 'emergency', name: 'Emergency services', number: '911', availability: '24/7', note: 'For immediate danger to you or someone else.' },
  { id: 'crisis_lifeline', name: '988 Suicide & Crisis Lifeline', number: '988', availability: '24/7', note: 'Call or text. Free and confidential.' },
];
