import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, File, Images } from 'lucide-react-native';
import type { ReactNode } from 'react';

import type { AttachSource } from '@/core/api/attachments';
import { continuousCorners, layout, radius, typeScale, useTokens } from '@/theme';

export interface AttachTrayProps {
  onPick: (source: AttachSource) => void;
  labels: {
    library: string;
    camera: string;
    files: string;
  };
}

/**
 * WeChat / DeepSeek–style attach palette under the composer.
 *
 * Tiles only launch system pickers (Photos, Camera, Files) — no in-app
 * gallery. Kept inline (not a Modal menu) so the composer stays a chat
 * surface rather than a web-style pull-down.
 */
export function AttachTray({ onPick, labels }: AttachTrayProps) {
  const t = useTokens();
  return (
    <View
      style={[styles.tray, { borderTopColor: t.borderSubtle }]}
      testID="composer-attach-tray"
      accessibilityRole="menu"
    >
      <Tile
        testID="composer-attach-library"
        label={labels.library}
        onPress={() => onPick('library')}
        icon={<Images size={28} color={t.textBody} />}
      />
      <Tile
        testID="composer-attach-camera"
        label={labels.camera}
        onPress={() => onPick('camera')}
        icon={<Camera size={28} color={t.textBody} />}
      />
      <Tile
        testID="composer-attach-files"
        label={labels.files}
        onPress={() => onPick('files')}
        icon={<File size={28} color={t.textBody} />}
      />
    </View>
  );
}

function Tile({
  label,
  icon,
  onPress,
  testID,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  testID: string;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed ? { opacity: 0.7 } : null]}
    >
      <View
        style={[styles.tileFace, { backgroundColor: t.surfaceRaised, borderColor: t.borderSubtle }]}
      >
        {icon}
      </View>
      <Text style={[styles.tileLabel, { color: t.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const TILE = 64;

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tile: {
    width: TILE + 8,
    alignItems: 'center',
    gap: 8,
  },
  tileFace: {
    width: TILE,
    height: TILE,
    borderRadius: radius.card,
    ...continuousCorners,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.hitTarget,
  },
  tileLabel: {
    ...typeScale.caption1,
    textAlign: 'center',
  },
});
