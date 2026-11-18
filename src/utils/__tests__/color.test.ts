import { tintHex, isLightColor } from '../color';

describe('tintHex', () => {
  it('converts a six-digit hex color', () => {
    expect(tintHex('#2F82D1', 0.14)).toBe('rgba(47,130,209,0.14)');
  });

  it('accepts a missing hash and mixed case', () => {
    expect(tintHex('2f82d1', 1)).toBe('rgba(47,130,209,1)');
  });

  it('expands three-digit shorthand', () => {
    expect(tintHex('#fa0', 0.5)).toBe('rgba(255,170,0,0.5)');
  });

  it('tolerates surrounding whitespace', () => {
    expect(tintHex('  #000000 ', 0.2)).toBe('rgba(0,0,0,0.2)');
  });

  it.each([null, undefined, '', 'red', '#12', '#12345', '#GGGGGG', 'rgb(1,2,3)', '#12345678'])(
    'returns null for %p',
    input => {
      expect(tintHex(input, 0.14)).toBeNull();
    },
  );
});

describe('isLightColor', () => {
  it('treats white and pale fills as light', () => {
    expect(isLightColor('#FFFFFF')).toBe(true);
    expect(isLightColor('#F3F4F6')).toBe(true);
    expect(isLightColor('#FFF')).toBe(true);
  });

  it('treats the accent palettes as dark enough for a light glyph', () => {
    for (const color of [
      '#111827',
      '#2F82D1',
      '#7C5CD6',
      '#12946A',
      '#D64570',
      '#C77E1E',
      '#0E8FA3',
    ]) {
      expect(isLightColor(color)).toBe(false);
    }
  });

  it('falls back to the light-foreground answer for non-hex input', () => {
    expect(isLightColor(null)).toBe(false);
    expect(isLightColor('rgba(0,0,0,1)')).toBe(false);
    expect(isLightColor('nope')).toBe(false);
  });
});
