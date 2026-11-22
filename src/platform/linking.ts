import { Alert, Linking } from 'react-native';

import { isHttpUrl } from '@/utils/safe-url';

/**
 * Outbound linking — the ONLY place RN `Linking.openURL` /
 * `Linking.openSettings` are called from product UI (AGENTS.md wrapper
 * hygiene).
 *
 * Markdown and other surfaces must go through `confirmOpenHttpUrl` so
 * model-generated links cannot invoke arbitrary schemes silently.
 */

/** Opens the OS Settings page for this app (permission recovery). */
export function openAppSettings(): void {
  void Linking.openSettings().catch(() => undefined);
}

export interface LinkConfirmCopy {
  title: string;
  message: (url: string) => string;
  cancel: string;
  open: string;
}

/**
 * Ask before leaving the app. Only http(s) URLs are offered; everything
 * else is refused (no `mailto:`, `javascript:`, custom schemes, …).
 * Returns whether the link was accepted (useful for Markdown `onLinkPress`).
 */
export function confirmOpenHttpUrl(url: string, copy: LinkConfirmCopy): boolean {
  const target = url.trim();
  if (!isHttpUrl(target)) {
    return false;
  }
  Alert.alert(copy.title, copy.message(target), [
    { text: copy.cancel, style: 'cancel' },
    {
      text: copy.open,
      onPress: () => {
        void Linking.openURL(target).catch(() => undefined);
      },
    },
  ]);
  // Handled asynchronously via the alert — tell Markdown not to open itself.
  return false;
}

/** The device-app schemes an assistant reply may propose (call, text, mail). */
const ACTION_SCHEME = /^(tel|sms|mailto):/i;

/**
 * Promise-based variant for device-tool execution: resolves with the user's
 * decision so the tool result can report opened/cancelled/unsupported.
 */
export function requestAppAction(
  url: string,
  copy: LinkConfirmCopy,
): Promise<'opened' | 'cancelled' | 'unsupported'> {
  const target = url.trim();
  if (!ACTION_SCHEME.test(target)) {
    return Promise.resolve('unsupported');
  }
  return new Promise(resolve => {
    Alert.alert(
      copy.title,
      copy.message(target),
      [
        { text: copy.cancel, style: 'cancel', onPress: () => resolve('cancelled') },
        {
          text: copy.open,
          onPress: () => {
            void Linking.openURL(target)
              .then(() => resolve('opened'))
              .catch(() => resolve('unsupported'));
          },
        },
      ],
      { cancelable: true, onDismiss: () => resolve('cancelled') },
    );
  });
}

/**
 * Assistant-proposed device actions — dial, SMS compose, email compose.
 * Always confirmed with a dialog (the URL is model-generated), then handed
 * to the OS handler. Returns whether the link was accepted.
 */
export function confirmOpenAppActionUrl(url: string, copy: LinkConfirmCopy): boolean {
  const target = url.trim();
  if (!ACTION_SCHEME.test(target)) {
    return false;
  }
  Alert.alert(copy.title, copy.message(target), [
    { text: copy.cancel, style: 'cancel' },
    {
      text: copy.open,
      onPress: () => {
        void Linking.openURL(target).catch(() => undefined);
      },
    },
  ]);
  return false;
}
