import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

/**
 * Markdown tables: one shared width per column (measured from the widest
 * cell) so header titles line up with the body grid, cell text wrapped, and
 * horizontal scrolling (with a transient scrollbar) only when the grid is
 * wider than the reading column. Fits-in-viewport tables stay static.
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
  const [measured, setMeasured] = useState<number[][]>([]);
  const colWidths = useMemo(() => {
    const cols: number[] = [];
    for (const row of measured) {
      row.forEach((value, index) => {
        cols[index] = Math.max(cols[index] ?? 0, value);
      });
    }
    return cols;
  }, [measured]);

  const handleCellLayout = useCallback((row: number, col: number, width: number) => {
    const w = Math.ceil(width);
    setMeasured(prev => {
      if (prev[row]?.[col] === w) {
        return prev;
      }
      const next = prev.map(cells => [...cells]);
      (next[row] ??= [])[col] = w;
      return next;
    });
  }, []);

  const rowCounter = { index: 0 };
  const grid = mapRows(children, rowCounter, (cell, row, col) => {
    const width = colWidths[col];
    return cloneElement(cell, {
      style: [cell.props.style, width ? { width, minWidth: width, maxWidth: width } : null],
      onLayout: (event: LayoutChangeEvent) =>
        handleCellLayout(row, col, event.nativeEvent.layout.width),
    });
  });
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
      <View style={style}>{grid}</View>
    </ScrollView>
  );
}

type CellProps = {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * The markdown renderer emits thead/tbody → tr → th/td as plain Views; rows
 * are the ones carrying our row direction. Walk that tree so every cell can
 * be measured and then pinned to its column's shared width.
 */
function mapRows(
  node: ReactNode,
  rowCounter: { index: number },
  visit: (cell: ReactElement<CellProps>, row: number, col: number) => ReactElement,
): ReactNode {
  return Children.map(node, child => {
    if (!isValidElement<CellProps>(child)) {
      return child;
    }
    const flat = StyleSheet.flatten(child.props.style) ?? {};
    if (flat.flexDirection === 'row') {
      const row = rowCounter.index++;
      const cells = Children.map(child.props.children, (cell, col) =>
        isValidElement<CellProps>(cell) ? visit(cell, row, col) : cell,
      );
      return cloneElement(child, { children: cells });
    }
    return cloneElement(child, {
      children: mapRows(child.props.children, rowCounter, visit),
    });
  });
}

const styles = StyleSheet.create({
  scroll: {
    marginVertical: 6,
  },
  content: {
    flexGrow: 0,
  },
});
