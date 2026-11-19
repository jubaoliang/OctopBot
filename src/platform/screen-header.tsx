import type { Edge } from 'react-native-safe-area-context';

import { AppHeader, LargeTitle } from '@/components/AppHeader';

/** Android and every other target draw their own bar. */
export const NATIVE_HEADERS = false;

/** The screen owns the top inset because the bar is drawn inside it. */
export const TOP_EDGES: Edge[] = ['top'];

export interface ScreenHeaderProps {
  /** Compact title, e.g. a conversation name. */
  title?: string;
  /** Second line under the compact title, e.g. connection state. */
  subtitle?: string;
  /** Large, left-aligned title for a top-level screen. */
  largeTitle?: string;
  /** Second line under the large title, e.g. a row count. */
  largeSubtitle?: string;
  /** Show the product logo instead of a title (chat home). */
  brand?: boolean;
  onMenu?: () => void;
  onBack?: () => void;
  /** Trailing action: start a conversation in the expert this screen shows. */
  onCompose?: () => void;
}

/**
 * The screen's top chrome. This implementation draws it; the iOS one hands
 * the same information to the system navigation bar. Screens pass data, never
 * a platform decision.
 */
export function ScreenHeader({
  title,
  subtitle,
  largeTitle,
  largeSubtitle,
  onMenu,
  onBack,
  onCompose,
}: ScreenHeaderProps) {
  return (
    <>
      <AppHeader
        title={title}
        subtitle={subtitle}
        onMenu={onMenu}
        onBack={onBack}
        onCompose={onCompose}
      />
      {largeTitle ? <LargeTitle title={largeTitle} subtitle={largeSubtitle} /> : null}
    </>
  );
}
