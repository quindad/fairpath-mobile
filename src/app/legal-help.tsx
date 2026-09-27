import { Redirect } from 'expo-router';

/** Legal help is found through Resources search (verified organizations). */
export default function LegalHelpRedirect() {
  return <Redirect href={'/resources' as never} />;
}
