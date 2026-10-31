/**
 * hash: the digests people ask for by name ("md5 of hello", "sha256 hash generator"), on bytes or text, all in the browser.
 * MD5 is worked out here (RFC 1321), because the browser's crypto.subtle has no MD5; SHA-1, SHA-256, SHA-384 and SHA-512 come from
 * crypto.subtle.digest (FIPS 180-4). Text is hashed as its UTF-8 bytes, so the answers match `echo -n text | md5sum` and the like.
 */

/** MD5 of bytes (RFC 1321): 16 bytes. lib/audio-write.js uses it for the FLAC sample check. Pure. */
export function md5(bytes) {
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21], K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const n = bytes.length, total = ((n + 8) >>> 6) + 1, w = new Uint32Array(total * 16);
  for (let i = 0; i < n; i++) w[i >> 2] |= bytes[i] << ((i % 4) * 8);
  w[n >> 2] |= 0x80 << ((n % 4) * 8); w[total * 16 - 2] = (n * 8) >>> 0; w[total * 16 - 1] = Math.floor(n / 2 ** 29);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let o = 0; o < w.length; o += 16) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f, g; const r = i >> 4;
      if (r === 0) { f = (b & c) | (~b & d); g = i; } else if (r === 1) { f = (d & b) | (~d & c); g = (5 * i + 1) % 16; } else if (r === 2) { f = b ^ c ^ d; g = (3 * i + 5) % 16; } else { f = c ^ (b | ~d); g = (7 * i) % 16; }
      const t = d; d = c; c = b; const x = (a + f + K[i] + w[o + g]) >>> 0, s = S[r * 4 + (i % 4)]; b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0; a = t;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  const out = new Uint8Array(16); [a0, b0, c0, d0].forEach((v, k) => { for (let j = 0; j < 4; j++) out[k * 4 + j] = (v >>> (8 * j)) & 255; }); return out;
}

/** the algorithms by the names people type: { id, name, subtle } (subtle is the crypto.subtle name; MD5 has none) */
export const ALGOS = [
  { id: 'md5', name: 'MD5', subtle: null },
  { id: 'sha1', name: 'SHA-1', subtle: 'SHA-1' },
  { id: 'sha256', name: 'SHA-256', subtle: 'SHA-256' },
  { id: 'sha384', name: 'SHA-384', subtle: 'SHA-384' },
  { id: 'sha512', name: 'SHA-512', subtle: 'SHA-512' },
];
/** an algorithm id from what people type ("sha-256", "SHA256", "md5"), or null. Pure. */
export const algoOf = (w) => { const k = String(w || '').toLowerCase().replace(/[\s_-]/g, ''); return ALGOS.find((a) => a.id === k) ? k : null; };
/** bytes as lower-case hex. Pure. */
export const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
/** the hex digest of `text` (its UTF-8 bytes) with algorithm `id`; a promise, since crypto.subtle answers later. */
export async function digestHex(id, text) {
  const bytes = new TextEncoder().encode(String(text ?? '')), a = ALGOS.find((x) => x.id === id);
  if (!a) throw new Error('unknown hash ' + id);
  if (!a.subtle) return toHex(md5(bytes));
  return toHex(new Uint8Array(await crypto.subtle.digest(a.subtle, bytes)));
}
