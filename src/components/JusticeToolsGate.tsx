import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { BodyText, Panel, PrimaryButton, SecondaryButton } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { justiceToolsEnabled, loadMemberCapabilities, type MemberCapabilities } from '@/core/profile/member-capabilities';

type Props = {
  eyebrow: string;
  title: string;
  backTo?: string;
  children: React.ReactNode;
};

/** Blocks justice/record-relief surfaces until the member opts in via settings. */
export function JusticeToolsGate({ eyebrow, title, backTo = '/home', children }: Props) {
  const [caps, setCaps] = useState<MemberCapabilities | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      loadMemberCapabilities()
        .then((c) => setCaps(c))
        .catch(() => setCaps(null));
    }, []),
  );

  if (caps === undefined) return null;

  if (!justiceToolsEnabled(caps)) {
    return (
      <ScreenFrame>
        <PageHeader eyebrow={eyebrow} title={title} backTo={backTo} />
        <ScreenScroll contentContainerStyle={{ padding: L.mobileGutter, gap: 16, paddingBottom: 32 }}>
          <Panel>
            <BodyText>
              Record Relief and justice record tools are optional. FairPath does not show them in your everyday experience until you choose to turn them on. Jobs, housing, and resources stay available either way.
            </BodyText>
          </Panel>
          <PrimaryButton label="Turn on in settings" onPress={() => router.push('/member-tool-preferences' as never)} />
          <SecondaryButton label="Back" onPress={() => router.replace(backTo as never)} />
        </ScreenScroll>
      </ScreenFrame>
    );
  }

  return <View style={{ flex: 1 }}>{children}</View>;
}
