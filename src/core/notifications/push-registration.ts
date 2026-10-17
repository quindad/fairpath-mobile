import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { getNotificationPreferences, registerNotificationToken, unregisterNotificationToken } from './notification-preferences';

export async function syncPushRegistration(): Promise<'registered'|'disabled'|'unavailable'|'permission-denied'> {
 if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unavailable';
 if (!Device.isDevice) return 'unavailable';
 const prefs = await getNotificationPreferences();
 if (!prefs.push_enabled) return 'disabled';
 if (Platform.OS === 'android') {
  await Notifications.setNotificationChannelAsync('default', {
   name: 'FairPath updates', importance: Notifications.AndroidImportance.DEFAULT,
  });
 }
 const existing = await Notifications.getPermissionsAsync();
 const permission = existing.status === 'granted' ? existing : await Notifications.requestPermissionsAsync();
 if (permission.status !== 'granted') return 'permission-denied';
 const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
 if (!projectId) return 'unavailable';
 const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
 await registerNotificationToken(token, Platform.OS);
 return 'registered';
}

export async function disablePushRegistration(): Promise<void> {
 await unregisterNotificationToken();
}
