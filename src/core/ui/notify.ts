import { Alert, Platform } from 'react-native';

export type NotifyAction = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type Handler = (title: string, message: string | undefined, actions: NotifyAction[]) => void;
let webHandler: Handler | null = null;

/** Registered by <NotifyHost/> (mounted once at the app root) so notify() can route to the themed modal on web. */
export function setNotifyHandler(h: Handler | null) {
  webHandler = h;
}

/**
 * Cross-platform replacement for RN's Alert.alert. Same call signature
 * (title, message?, actions?) so existing call sites migrate by swapping
 * the function name. On web this renders as a themed in-app modal via
 * <NotifyHost/> when mounted; if it isn't (e.g. a standalone tool render),
 * it falls back to window.alert/window.confirm so nothing silently no-ops.
 */
export function notify(title: string, message?: string, actions?: NotifyAction[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, actions);
    return;
  }

  if (webHandler) {
    webHandler(title, message, actions && actions.length ? actions : [{ text: 'OK' }]);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  if (!actions || actions.length === 0) {
    window.alert(text);
    return;
  }

  if (actions.length === 1) {
    window.alert(text);
    actions[0].onPress?.();
    return;
  }

  // Web has no native multi-button dialog. Map to confirm(): the
  // non-cancel action (usually the last one, e.g. 'destructive'/'default')
  // runs on OK, the 'cancel'-styled action runs on Cancel/dismiss.
  const cancelAction = actions.find((a) => a.style === 'cancel');
  const primaryAction = actions.find((a) => a !== cancelAction) ?? actions[actions.length - 1];

  if (window.confirm(text)) {
    primaryAction.onPress?.();
  } else {
    cancelAction?.onPress?.();
  }
}

/** Convenience alias for call sites that are conceptually a confirmation, not a notice. */
export const confirm = notify;
