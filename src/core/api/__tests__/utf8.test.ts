import { decodeUtf8 } from '../utf8';

function bytes(...nums: number[]): Uint8Array {
  return new Uint8Array(nums);
}

describe('decodeUtf8', () => {
  it('decodes ASCII', () => {
    expect(decodeUtf8(bytes(0x68, 0x69))).toBe('hi');
  });

  it('decodes 3-byte CJK', () => {
    // 研 U+7814 = E7 A0 94 ; 究 U+7A76 = E7 A9 B6
    expect(decodeUtf8(bytes(0xe7, 0xa0, 0x94, 0xe7, 0xa9, 0xb6))).toBe('研究');
  });

  it('decodes 2-byte latin', () => {
    // é U+00E9 = C3 A9
    expect(decodeUtf8(bytes(0xc3, 0xa9))).toBe('é');
  });

  it('decodes 4-byte emoji as a surrogate pair', () => {
    // 🐙 U+1F419 = F0 9F 90 99
    expect(decodeUtf8(bytes(0xf0, 0x9f, 0x90, 0x99))).toBe('🐙');
  });

  it('round-trips a mixed string', () => {
    const s = '研究主题 research 🐙 é';
    const encoded = new TextEncoder().encode(s);
    expect(decodeUtf8(encoded)).toBe(s);
  });

  it('returns empty for empty input', () => {
    expect(decodeUtf8(bytes())).toBe('');
  });
});
