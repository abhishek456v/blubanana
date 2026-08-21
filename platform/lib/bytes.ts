/**
 * base64 → bytes, without a dependency.
 *
 * The storage client wants binary. React Native has no `Buffer`, and `atob`
 * has only been reliably present since a recent Hermes, so this decodes by
 * hand rather than betting every upload path on which runtime the app lands
 * on.
 *
 * Lives on its own because two things now need it: profile photos and the
 * media library. base64 is the one representation of a picked file that
 * behaves the same on web and native, which is why both take that rather than
 * a `file://` URI.
 */
export function base64ToBytes(base64: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '')
  const bytes = new Uint8Array(((clean.length * 3) / 4) | 0)

  let byte = 0
  let bits = 0
  let out = 0
  for (const char of clean) {
    bits = (bits << 6) | alphabet.indexOf(char)
    byte += 6
    if (byte >= 8) {
      byte -= 8
      bytes[out++] = (bits >> byte) & 0xff
    }
  }
  return bytes.subarray(0, out)
}
