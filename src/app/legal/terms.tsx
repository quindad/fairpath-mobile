import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';

/** Full Terms of Service for member consent (version v1). */
export default function LegalTermsScreen() {
  return <LegalDocumentScreen slug="terms" defaultBackTo="/accept-terms" />;
}
