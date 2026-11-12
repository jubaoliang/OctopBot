/**
 * Bottom inset for content that must stay above the keyboard.
 *
 * `keyboardHeight` is the height the keyboard covers right now — 0 for a
 * hidden keyboard and for one that is shown but covers nothing (floating,
 * hardware-keyboard accessory). `restingInset` is the room kept for chrome
 * under the content when no keyboard is in the way; `gap` is the space
 * left between the keyboard's top edge and the content.
 *
 * The result never drops below the resting inset, so content does not move
 * until the keyboard actually reaches it.
 */
export function keyboardInset(keyboardHeight: number, restingInset: number, gap: number): number {
  'worklet';
  return keyboardHeight > 0 ? Math.max(restingInset, keyboardHeight + gap) : restingInset;
}
