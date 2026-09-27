import { Redirect } from 'expo-router';

/** The old static screening page was replaced by real case tracking. Kept so existing links keep working. */
export default function RecordReliefCheckRedirect() {
  return <Redirect href={'/record-relief/add' as never} />;
}
