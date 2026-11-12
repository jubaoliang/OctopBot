import { keyboardInset } from '../keyboard-inset';

describe('keyboardInset', () => {
  const TAB_BAR = 112;
  const GAP = 8;

  it('keeps the resting inset while no keyboard is shown', () => {
    expect(keyboardInset(0, TAB_BAR, GAP)).toBe(TAB_BAR);
  });

  it('keeps the resting inset for a keyboard that is shown but covers nothing', () => {
    // Floating keyboard / hardware-keyboard accessory: visible, height 0.
    expect(keyboardInset(0, TAB_BAR, GAP)).toBe(TAB_BAR);
    expect(keyboardInset(0, 0, GAP)).toBe(0);
  });

  it('does not move the content until the keyboard reaches it', () => {
    expect(keyboardInset(40, TAB_BAR, GAP)).toBe(TAB_BAR);
    expect(keyboardInset(TAB_BAR - GAP, TAB_BAR, GAP)).toBe(TAB_BAR);
  });

  it('rides the keyboard, plus the gap, once it is taller than the resting inset', () => {
    expect(keyboardInset(336, TAB_BAR, GAP)).toBe(344);
    expect(keyboardInset(336, 0, 0)).toBe(336);
  });

  it('is continuous across the hand-over point', () => {
    const below = keyboardInset(TAB_BAR - GAP - 0.5, TAB_BAR, GAP);
    const above = keyboardInset(TAB_BAR - GAP + 0.5, TAB_BAR, GAP);
    expect(above - below).toBeCloseTo(0.5);
  });
});
