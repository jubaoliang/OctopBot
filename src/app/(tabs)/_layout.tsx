import { TabsShell } from '@/platform/tabs-shell';

/**
 * Tab routes are shared; only the bar around them is platform-specific.
 * `platform/tabs-shell` picks the shell (iOS system tab bar, docked bar
 * elsewhere), so this file stays a single route declaration.
 */
export default function TabsLayout() {
  return <TabsShell />;
}
