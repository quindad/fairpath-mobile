import { Image, ImageStyle, StyleProp } from 'react-native';

const FAIRPATH_LOGO = require('../../assets/brand/fairpath-logo.png');

type FairPathLogoProps = {
  width?: number;
  style?: StyleProp<ImageStyle>;
};

export function FairPathLogo({ width = 168, style }: FairPathLogoProps) {
  return (
    <Image
      source={FAIRPATH_LOGO}
      resizeMode="contain"
      accessibilityLabel="FairPath"
      style={[{ width, height: width * 0.56 }, style]}
    />
  );
}
