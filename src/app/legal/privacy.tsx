import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';

/** Full Privacy Policy for member consent (version v1). */
export default function LegalPrivacyScreen() {
  return <LegalDocumentScreen slug="privacy" defaultBackTo="/accept-terms" />;
}
