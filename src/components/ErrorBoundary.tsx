import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { layout, radius, typeScale } from '@/theme';

interface Props {
  children: ReactNode;
  /** Localized copy — kept as props so this file stays free of i18n hooks. */
  title: string;
  hint: string;
  retryLabel: string;
  /** Theme colors from a parent that sits under ThemeProvider. */
  colors: {
    bg: string;
    textPrimary: string;
    textSecondary: string;
    overlaySubtle: string;
  };
}

interface State {
  error: Error | null;
}

/**
 * Last-resort UI when a screen throws during render. Resets on Retry so the
 * user is not stuck on a blank root after a one-off crash.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally no logging of message/stack — those can carry user text.
  }

  private retry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }
    const { colors } = this.props;
    return (
      <View style={[styles.screen, { backgroundColor: colors.bg }]} accessibilityRole="alert">
        <Text style={[styles.title, { color: colors.textPrimary }]}>{this.props.title}</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{this.props.hint}</Text>
        <PressableScale
          accessibilityRole="button"
          testID="error-boundary-retry"
          onPress={this.retry}
          style={[styles.button, { backgroundColor: colors.overlaySubtle }]}
        >
          <Text style={[styles.buttonLabel, { color: colors.textPrimary }]}>
            {this.props.retryLabel}
          </Text>
        </PressableScale>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.screenMargin,
    gap: 12,
  },
  title: {
    ...typeScale.title3,
    textAlign: 'center',
  },
  hint: {
    ...typeScale.subheadline,
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    minHeight: layout.hitTarget,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    ...typeScale.headline,
  },
});
