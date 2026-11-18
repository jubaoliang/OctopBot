import { Tabs } from 'expo-router';

import { DesignTabBar } from '@/components/DesignTabBar';

/**
 * Tab shell for every target without a system tab bar. Android draws the
 * docked bar from `DesignTabBar`; iOS takes `tabs-shell.ios.tsx` instead.
 */
export function TabsShell() {
  return (
    <Tabs
      tabBar={props => (
        <DesignTabBar
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
