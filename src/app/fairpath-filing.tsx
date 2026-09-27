import { Redirect } from 'expo-router';

/** Filing paperwork now lives inside each case (checklist, forms guide, worksheet, packet). */
export default function FilingRedirect() {
  return <Redirect href={'/record-relief' as never} />;
}
