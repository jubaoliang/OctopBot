import * as Clipboard from 'expo-clipboard';

/**
 * System clipboard (AGENTS.md wrapper hygiene: the only place expo-clipboard
 * is imported). Returns whether the write landed — the caller shows "copied"
 * from that answer rather than from having tried.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
