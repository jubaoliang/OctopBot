import { useState } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

/**
 * Markdown tables: size to content, wrap cell text, and only enable
 * horizontal scrolling (with a transient scrollbar) when the grid is
 * wider than the reading column. Fits-in-viewport tables stay static —
 * no scroll chrome.
 */
export function MarkdownTable({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const [viewportW, setViewportW] = useState(0);
  const [contentW, setContentW] = useState(0);
  // Epsilon avoids flicker from sub-pixel layout.
  const needsScroll = viewportW > 0 && contentW > viewportW + 1;

  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      scrollEnabled={needsScroll}
      // Exception: tables may show a transient bar while scrolling.
      // Everywhere else in the app keeps indicators off.
      showsHorizontalScrollIndicator={needsScroll}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      onLayout={event => {
        setViewportW(event.nativeEvent.layout.width);
      }}
      onContentSizeChange={width => {
        setContentW(width);
      }}
    >
      <View style={style}>{children}</View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginVertical: 6,
  },
  content: {
    flexGrow: 0,
  },
});
