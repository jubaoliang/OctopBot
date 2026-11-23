import { Platform, type TextInputProps } from 'react-native';

/**
 * Text-field metrics that differ by OS. Screens pass the result straight to
 * the input — the OS branch lives here, not in feature UI (AGENTS.md:
 * `Platform.OS` belongs inside `src/platform/`).
 *
 * Android's EditText pads every line with the font's ascent/descent metrics
 * (`includeFontPadding`, default true). Inside the composer's fixed-height
 * pill that padding is what clips the placeholder, so fields opt out of it.
 * iOS has no such padding — the empty object leaves the field untouched.
 */
export const INPUT_TEXT_METRICS: TextInputProps & { includeFontPadding?: boolean } =
  Platform.OS === 'android' ? { includeFontPadding: false } : {};
