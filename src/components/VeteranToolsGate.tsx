import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { View } from 'react-native';
import { PageHeader, ScreenFrame, ScreenScroll } from '@/components/ProductChrome';
import { BodyText, Panel, PrimaryButton, SecondaryButton } from '@/components/ui-kit';
import { FairPathLayout as L } from '@/constants/fairpath';
import { loadMemberCapabilities, veteranToolsEnabled, type MemberCapabilities } from '@/core/profile/member-capabilities';

type Props = {
  eyebrow: string;
  title: string;
  backTo?: string;
  children: React.ReactNode;
};

export function VeteranToolsGate({ eyebrow, title, backTo = '/home', children }: Props) {
  const [caps, setCaps] = useState<MemberCapabilities | null | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      loadMemberCapabilities()
        .then((c) => setCaps(c))
        .catch(() => setCaps(null));
    }, []),
  );

  if (caps === undefined) return null;

  if (!veteranToolsEnabled(caps)) {
    return (
      <ScreenFrame>
        <PageHeader eyebrow={eyebrow} title={title} backTo={backTo} />
        <ScreenScroll contentContainerStyle={{ padding: L.mobileGutter, gap: 16, paddingBottom: 32 }}>
          <Panel>
            <BodyText>
              Veteran-specific tools are optional. You can still use Jobs and Housing filters like everyone else. Turn on veteran tools in settings when you want translation, benefits links, and service profile features here.
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
