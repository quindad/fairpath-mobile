import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const KEY = 'fairpath.app_intro_completed_v1';

async function readFlag(): Promise<boolean> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(KEY) === '1';
    }
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

async function writeFlag(): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, '1');
      return;
    }
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    /* non-fatal */
  }
}

/** Product intro carousel (Jobs, Housing, etc.) — separate from member profile onboarding. */
export async function hasCompletedAppIntro(): Promise<boolean> {
  return readFlag();
}

export async function markAppIntroCompleted(): Promise<void> {
  await writeFlag();
}
