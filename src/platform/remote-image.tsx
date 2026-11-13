import { Image, type ImageContentFit, type ImageProps } from 'expo-image';
import { StyleSheet } from 'react-native';

/**
 * Cross-platform image load for chat/media previews.
 * Local `file://` / `content://` URIs need no headers; JWT-protected
 * `/api/agents/…/media/preview` URLs pass `Authorization` via `headers`.
 *
 * Screens must not import `expo-image` directly — keep the dependency behind
 * this wrapper so HarmonyOS can swap the implementation later.
 */
export function RemoteImage({
  uri,
  headers,
  accessibilityLabel,
  contentFit = 'cover',
  style,
  testID,
}: {
  uri: string;
  headers?: Record<string, string>;
  accessibilityLabel?: string;
  contentFit?: ImageContentFit;
  /**
   * Accept shared StyleSheet entries. RN's ViewStyle `overflow: "scroll"`
   * union is wider than expo-image's ImageStyle; narrow at this boundary.
   */
  style?: object;
  testID?: string;
}) {
  const source: ImageProps['source'] = headers ? { uri, headers } : { uri };
  return (
    <Image
      source={source}
      style={[styles.base, style]}
      contentFit={contentFit}
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
