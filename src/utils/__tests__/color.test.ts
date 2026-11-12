import { tintHex } from '../color';

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
