import { Tabs } from 'expo-router';

import { AndroidTabBar } from '@/components/AndroidTabBar';

/**
 * Android tab shell: the routes stay shared, the bar is drawn by
 * `AndroidTabBar` (icon + label, tint-only selection, no ripple or hover).
 * iOS takes `tabs-shell.ios.tsx` and the system bar instead.
 */
export function TabsShell() {
  return (
    <Tabs
      tabBar={props => (
        <AndroidTabBar
          state={props.state}
          emitter={props.emitter}
          navigateToTab={props.navigateToTab}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      {/* chat is its own stack (home → thread); see (tabs)/chat/_layout.tsx */}
      <Tabs.Screen name="chat" options={{ title: 'chat' }} />
      <Tabs.Screen name="experts" options={{ title: 'experts' }} />
      <Tabs.Screen name="automation" options={{ title: 'automation' }} />
      <Tabs.Screen name="me" options={{ title: 'me' }} />
    </Tabs>
  );
}
