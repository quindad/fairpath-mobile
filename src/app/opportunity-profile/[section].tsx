import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';
import { FormScrollView } from '@/components/FormScrollView';
import { ContactEditor, CredentialsEditor, EducationEditor, ExperienceEditor, PreferencesEditor, SkillsEditor } from '@/components/opportunity/editors';
import { PageHeader, ScreenFrame } from '@/components/ProductChrome';
import { BodyText, Panel } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';

const TITLES: Record<string, { eyebrow: string; title: string; intro: string }> = {
  contact: { eyebrow: 'OPPORTUNITY PROFILE', title: 'Contact details', intro: 'Employers only receive this if you apply. It is never sold or shared on its own.' },
  experience: { eyebrow: 'OPPORTUNITY PROFILE', title: 'Work experience', intro: 'Any real work counts: formal jobs, informal work, self-employment and work done while incarcerated.' },
  education: { eyebrow: 'OPPORTUNITY PROFILE', title: 'Education', intro: 'Diplomas, GED, trade programs and classes.' },
  credentials: { eyebrow: 'OPPORTUNITY PROFILE', title: 'Certifications and licenses', intro: 'Optional. Do not enter certificate numbers.' },
  skills: { eyebrow: 'OPPORTUNITY PROFILE', title: 'Skills', intro: 'What you can do today.' },
  preferences: { eyebrow: 'OPPORTUNITY PROFILE', title: 'Job preferences', intro: 'The work you want. Used to shape your profile, not to judge you.' },
  availability: { eyebrow: 'OPPORTUNITY PROFILE', title: 'Availability', intro: 'When you can work.' },
  transportation: { eyebrow: 'OPPORTUNITY PROFILE', title: 'Transportation', intro: 'How you get to work. Employers see this only if you choose to include it.' },
};

export default function OpportunitySectionScreen() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const meta = TITLES[section ?? ''];
  const onChanged = useCallback(() => {}, []);

  return (
    <ScreenFrame>
      <PageHeader eyebrow={meta?.eyebrow ?? 'OPPORTUNITY PROFILE'} title={meta?.title ?? 'Section'} backTo="/opportunity-profile" alwaysBackTo />
      <FormScrollView contentContainerStyle={{ paddingHorizontal: L.mobileGutter, paddingBottom: 40 }}>
        {!meta ? (
          <Panel><BodyText>That section does not exist.</BodyText></Panel>
        ) : (
          <View>
            <Panel><BodyText muted>{meta.intro}</BodyText></Panel>
            {section === 'contact' ? <ContactEditor onChanged={onChanged} /> : null}
            {section === 'experience' ? <ExperienceEditor onChanged={onChanged} /> : null}
            {section === 'education' ? <EducationEditor onChanged={onChanged} /> : null}
            {section === 'credentials' ? <CredentialsEditor onChanged={onChanged} /> : null}
            {section === 'skills' ? <SkillsEditor onChanged={onChanged} /> : null}
            {section === 'preferences' || section === 'availability' || section === 'transportation' ? <PreferencesEditor mode={section} onChanged={onChanged} /> : null}
          </View>
        )}
      </FormScrollView>
    </ScreenFrame>
  );
}

// Keeps the router import used for typed navigation helpers in this module.
export const goToHub = () => router.replace('/opportunity-profile' as never);
