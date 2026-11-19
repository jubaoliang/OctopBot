import { Platform } from 'react-native';

/**
 * True where the app hands its chrome to the platform instead of drawing it:
 * the navigation bar, the tab bar, and the composer's shape.
 *
 * It lives here so screens and components never ask which OS they are on —
 * they ask what kind of chrome to render.
 */
export const SYSTEM_CHROME = Platform.OS === 'ios';
