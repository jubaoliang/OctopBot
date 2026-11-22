/**
 * Decode a UTF-8 byte buffer to a string.
 *
 * React Native's `fetch` `response.text()` can lossily decode a charset-less
 * `application/json` body on Android, turning CJK into '?'. Reading the raw
 * bytes and decoding UTF-8 here guarantees the server's text survives.
 * Pure TS (no TextDecoder dependency, which RN/Hermes lacks).
 */
export function decodeUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  const n = bytes.length;
  while (i < n) {
    const b = bytes[i++];
    let cp: number;
    if (b < 0x80) {
      cp = b;
    } else if (b < 0xe0) {
      cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if (b < 0xf0) {
      cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      cp =
        ((b & 0x07) << 18) |
        ((bytes[i++] & 0x3f) << 12) |
        ((bytes[i++] & 0x3f) << 6) |
        (bytes[i++] & 0x3f);
    }
    if (cp > 0xffff) {
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      out += String.fromCharCode(cp);
    }
  }
  return out;
}
