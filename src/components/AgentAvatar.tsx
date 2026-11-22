import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { EXPERT_ICONS } from '@/components/expert-icons';
import { useAuth } from '@/features/auth';
import { UI_FONT, useTokens } from '@/theme';
import { tintHex } from '@/utils/color';

// SvgXml logs parse failures via console.error by default (a red LogBox
// banner in dev). Some server avatars use syntax its slim parser rejects;
// swallow the log and let `fallback` render instead.
const silenceSvgError = () => undefined;

/**
 * Expert avatar: the backend-provided portrait (`icon_url`) when it loads
 * and parses, else the agent's brand color as a soft tile with its lucide
 * icon (`icon_name`), else the initial letter. Backend avatars are relative
 * paths on the server, resolved against the session base URL. The SVG text
 * is fetched and handed to SvgXml (not SvgUri) so parse errors can be
 * silenced and degraded to the fallback instead of logging a red banner.
 */
export function AgentAvatar({
  name,
  iconName,
  iconUrl,
  color,
  size = 36,
  fallbackTextSecondary,
}: {
  name: string;
  iconName?: string | null;
  iconUrl?: string | null;
  color?: string | null;
  size?: number;
  /** Text color for the fallback initial when no brand color exists. */
  fallbackTextSecondary: string;
}) {
  const t = useTokens();
  const { baseUrl } = useAuth();
  const Icon = iconName ? EXPERT_ICONS[iconName] : undefined;
  // An unparseable brand color falls back to the neutral token pair, which
  // also keeps the tile visible in dark mode.
  const brandTint = tintHex(color, 0.14);
  const fg = brandTint && color ? color : fallbackTextSecondary;

  const resolvedUrl = iconUrl
    ? iconUrl.startsWith('http')
      ? iconUrl
      : `${baseUrl ?? ''}${iconUrl}`
    : null;
  const isSvg = resolvedUrl?.toLowerCase().endsWith('.svg') ?? false;

  const [svg, setSvg] = useState<{ url: string; xml: string } | null>(null);
  useEffect(() => {
    if (!resolvedUrl || !isSvg) {
      return;
    }
    let cancelled = false;
    fetch(resolvedUrl)
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(text => {
        if (!cancelled) {
          setSvg({ url: resolvedUrl, xml: text });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSvg(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedUrl, isSvg]);
  // Only use the fetched XML once it belongs to the current URL, so a
  // stale portrait never flashes for a different expert.
  const svgXml = svg && svg.url === resolvedUrl ? svg.xml : null;

  const fallback = Icon ? (
    <Icon size={Math.round(size * 0.5)} color={fg} />
  ) : (
    <Text allowFontScaling={false} style={[styles.initial, { color: fg, fontSize: size * 0.42 }]}>
      {name.slice(0, 1)}
    </Text>
  );

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: brandTint ?? t.overlaySubtle,
        },
      ]}
    >
      {resolvedUrl && isSvg && svgXml ? (
        <SvgXml
          xml={svgXml}
          width={size}
          height={size}
          onError={silenceSvgError}
          fallback={fallback}
        />
      ) : resolvedUrl && !isSvg ? (
        <Image
          source={{ uri: resolvedUrl }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        fallback
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: {
    fontFamily: UI_FONT,
    fontWeight: '600',
    lineHeight: undefined,
  },
});
