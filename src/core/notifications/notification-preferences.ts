import { supabase } from '@/lib/supabase';
import { currentUser } from '@/core/supabase/current-user';

export type NotificationPreferences = { push_enabled: boolean; marketing_enabled: boolean };

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
 await currentUser();
 const { data, error } = await supabase.rpc('get_notification_preferences');
 if (error) throw error;
 const row = Array.isArray(data) ? data[0] : data;
 return { push_enabled: Boolean(row?.push_enabled), marketing_enabled: Boolean(row?.marketing_enabled) };
}

export async function setNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
 await currentUser();
 const { error } = await supabase.rpc('set_notification_preferences', {
  p_push: preferences.push_enabled,
  p_marketing: preferences.marketing_enabled,
 });
 if (error) throw error;
}

export async function registerNotificationToken(token: string, platform: 'ios' | 'android'): Promise<void> {
 await currentUser();
 const { error } = await supabase.rpc('register_push_token', {
  p_token: token, p_platform: platform, p_provider: 'expo',
 });
 if (error) throw error;
}

export async function unregisterNotificationToken(token?: string): Promise<void> {
 await currentUser();
 const { error } = await supabase.rpc('unregister_push_token', { p_token: token ?? null });
 if (error) throw error;
}
