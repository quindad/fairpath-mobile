/**
 * Expo keeps the last notification response until the app clears it.
 * Routing from that stored response on every signed-in launch replays an old tap
 * and pulls the member into the inbox when they did not just open a notification.
 */

export type NotificationResponseLike = {
  notification?: {
    date?: number;
    request?: { identifier?: string | null };
  };
} | null | undefined;

const ONBOARDING_ROUTES = new Set(['/accept-terms', '/onboarding']);

export function notificationTapId(response: NotificationResponseLike): string | null {
  if (!response) return null;
  const identifier = response.notification?.request?.identifier;
  if (typeof identifier === 'string' && identifier.length > 0) return identifier;
  const date = response.notification?.date;
  if (typeof date === 'number' && Number.isFinite(date)) return `date:${date}`;
  return 'notification-response';
}

export function planNotificationTap(
  pathname: string,
  tapId: string | null,
  handledTapId: string | null,
): { consume: boolean; route: '/notifications' | null } {
  if (!tapId || tapId === handledTapId) return { consume: false, route: null };
  const stayPut = ONBOARDING_ROUTES.has(pathname) || pathname === '/notifications';
  return { consume: true, route: stayPut ? null : '/notifications' };
}
