import { Redirect } from 'expo-router';

/** The old static Credit Builder page was replaced by the real workspace at /credit. Kept so existing links keep working. */
export default function CreditToolsRedirect() {
  return <Redirect href={'/credit' as never} />;
}
