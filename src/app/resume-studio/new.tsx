import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { createResume, resumeErrorMessage } from '@/core/resume/resume-service';
import { useFairPathTheme } from '@/core/theme/ThemeProvider';
import { notify } from '@/core/ui/notify';

export default function NewResume() {
  const { tokens } = useFairPathTheme();
  useEffect(() => {
    let live = true;
    createResume('My resume').then((r) => { if (live) router.replace(('/resume-studio/' + r.id) as never); })
      .catch((e) => { if (live) { notify('Could not create a resume', resumeErrorMessage(e)); router.replace('/resume-studio' as never); } });
    return () => { live = false; };
  }, []);
  return <ScreenFrame><PageHeader eyebrow="FAIRPATH" title="Resume Studio" backTo="/resume-studio" alwaysBackTo /><ActivityIndicator color={tokens.accentText} style={{ marginTop: 32 }} /></ScreenFrame>;
}
