/**
 * Probe native modules without importing packages that call requireNativeModule / TurboModuleRegistry at load time.
 * Used when the installed dev client (e.g. development-signal) omits optional native code.
 */
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';

export function fairpathIosQaMinimalBuild(): boolean {
  return Constants.expoConfig?.extra?.fairpathIosQaMinimal === true;
}

export function pushNotificationsNativeAvailable(): boolean {
  return requireOptionalNativeModule('ExpoPushTokenManager') != null;
}

export function printNativeAvailable(): boolean {
  return requireOptionalNativeModule('ExpoPrint') != null;
}

export function sharingNativeAvailable(): boolean {
  return requireOptionalNativeModule('ExpoSharing') != null;
}

export function appleSignInNativeAvailable(): boolean {
  return requireOptionalNativeModule('ExpoAppleAuthentication') != null;
}

/** @stripe/stripe-react-native TurboModule */
export function stripeNativeAvailable(): boolean {
  return requireOptionalNativeModule('StripeSdk') != null;
}

export function mapsNativeAvailable(): boolean {
  return requireOptionalNativeModule('RNMapsAirModule') != null || requireOptionalNativeModule('AirMapModule') != null;
}

export async function loadExpoNotificationsModule(): Promise<typeof import('expo-notifications') | null> {
  if (!pushNotificationsNativeAvailable()) return null;
  return import('expo-notifications');
}

export async function loadExpoPrintModule(): Promise<typeof import('expo-print') | null> {
  if (!printNativeAvailable()) return null;
  return import('expo-print');
}

export async function loadExpoSharingModule(): Promise<typeof import('expo-sharing') | null> {
  if (!sharingNativeAvailable()) return null;
  return import('expo-sharing');
}

export async function loadStripeReactNativeModule(): Promise<typeof import('@stripe/stripe-react-native') | null> {
  if (!stripeNativeAvailable()) return null;
  try {
    return await import('@stripe/stripe-react-native');
  } catch {
    return null;
  }
}

export type NativeCapabilitySnapshot = {
  fairpathIosQaMinimalBuild: boolean;
  pushNotifications: boolean;
  print: boolean;
  sharing: boolean;
  appleSignIn: boolean;
  stripe: boolean;
  maps: boolean;
};

export function getNativeCapabilitySnapshot(): NativeCapabilitySnapshot {
  return {
    fairpathIosQaMinimalBuild: fairpathIosQaMinimalBuild(),
    pushNotifications: pushNotificationsNativeAvailable(),
    print: printNativeAvailable(),
    sharing: sharingNativeAvailable(),
    appleSignIn: appleSignInNativeAvailable(),
    stripe: stripeNativeAvailable(),
    maps: mapsNativeAvailable(),
  };
}
