import { Alert, Linking } from 'react-native';

import { isHttpUrl } from '@/utils/safe-url';

/**
 * Outbound linking — the ONLY place RN `Linking.openURL` is called from
 * product UI (AGENTS.md wrapper hygiene).
 *
 * Markdown and other surfaces must go through `confirmOpenHttpUrl` so
 * model-generated links cannot invoke arbitrary schemes silently.
 */

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
  if (!isHttpUrl(url)) {
    return false;
  }
  Alert.alert(copy.title, copy.message(url), [
    { text: copy.cancel, style: 'cancel' },
    {
      text: copy.open,
      onPress: () => {
        void Linking.openURL(url).catch(() => undefined);
      },
    },
  ]);
  // Handled asynchronously via the alert — tell Markdown not to open itself.
  return false;
}
