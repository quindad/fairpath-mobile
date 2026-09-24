import { Alert, Platform } from 'react-native';

export type NotifyAction = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * Cross-platform replacement for RN's Alert.alert. Same call signature
 * (title, message?, actions?) so existing call sites migrate by swapping
 * the function name. React Native Web's Alert.alert is a no-op, so this
 * falls back to window.alert/window.confirm on web.
 */
export function notify(title: string, message?: string, actions?: NotifyAction[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, actions);
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
