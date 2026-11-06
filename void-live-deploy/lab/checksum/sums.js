// The checksum checker's sums (lab/checksum/). Pure, no DOM. A file of any size is hashed in pieces: crypto.subtle wants the whole file
// in memory, so past BIG bytes SHA-256 runs here, block by block (FIPS 180-4), and a 20 GB disk image checks on a phone like a 2 MB zip.
// The 35 "sealed" experiments in the lab hashed their own state with SHA-256; this hashes the person's file, which is what the sum is for.
export const BIG = 256 * 1024 * 1024;

const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
  0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);

/** a SHA-256 you feed in pieces: const h = sha256(); h.update(bytes); ... h.hex(). */
export function sha256() {
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64), buf = new Uint8Array(64); let fill = 0, total = 0;
  const block = (b, o) => {
    for (let i = 0; i < 16; i++) W[i] = (b[o + i * 4] << 24) | (b[o + i * 4 + 1] << 16) | (b[o + i * 4 + 2] << 8) | b[o + i * 4 + 3];
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], c = W[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3), s1 = ((c >>> 17) | (c << 15)) ^ ((c >>> 19) | (c << 13)) ^ (c >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = H[0], b2 = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7)), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) | 0, S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const t2 = (S0 + ((a & b2) ^ (a & c) ^ (b2 & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b2; b2 = a; a = (t1 + t2) | 0;
    }
    H[0] += a; H[1] += b2; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  };
  return {
    update(bytes) {
      let i = 0; total += bytes.length;
      if (fill) { while (fill < 64 && i < bytes.length) buf[fill++] = bytes[i++]; if (fill === 64) { block(buf, 0); fill = 0; } }
      for (; i + 64 <= bytes.length; i += 64) block(bytes, i);
      while (i < bytes.length) buf[fill++] = bytes[i++];
      return this;
    },
    hex() {
      const bits = total * 8, pad = new Uint8Array(((fill < 56 ? 56 : 120) - fill) + 8); pad[0] = 0x80;
      const hi = Math.floor(bits / 2 ** 32), lo = bits >>> 0, n = pad.length;
      pad[n - 8] = hi >>> 24; pad[n - 7] = hi >>> 16; pad[n - 6] = hi >>> 8; pad[n - 5] = hi; pad[n - 4] = lo >>> 24; pad[n - 3] = lo >>> 16; pad[n - 2] = lo >>> 8; pad[n - 1] = lo;
      total -= pad.length; this.update(pad);
      return Array.from(H, (x) => (x >>> 0).toString(16).padStart(8, '0')).join('');
    },
  };
}

const LEN = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' };
/** a pasted checksum, cleaned: { hex, algo } ('SHA-256' by its length), or null when it is not one. Takes "sha256:ABC…", spaces and a file name after it. */
export function expectedOf(text) {
  const m = /(?:^|[^0-9a-z])([0-9a-f]{32,128})(?![0-9a-z])/i.exec(String(text || '').replace(/^\s*(?:md5|sha-?\d+)\s*[:=]\s*/i, ' '));
  if (!m || !LEN[m[1].length]) return null;
  return { hex: m[1].toLowerCase(), algo: LEN[m[1].length] };
}
/** does a computed hex match what was pasted: 'match', 'differs', or '' when nothing was pasted for that algorithm. */
export function verdictOf(hex, expected, algo) {
  if (!expected || expected.algo !== algo) return '';
  return hex.toLowerCase() === expected.hex ? 'match' : 'differs';
}
/** a SHA256SUMS / md5sum style list -> [{ hex, name }]: "hash  name", "hash *name" (binary mode) and "SHA256 (name) = hash" (BSD). */
export function sumsFileOf(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    let m = /^\s*([0-9a-f]{32,128})\s+[* ]?(.+?)\s*$/i.exec(line);
    if (m && LEN[m[1].length]) { out.push({ hex: m[1].toLowerCase(), name: m[2].replace(/^\.\//, ''), algo: LEN[m[1].length] }); continue; }
    m = /^\s*(MD5|SHA-?1|SHA-?256|SHA-?384|SHA-?512)\s*\((.+)\)\s*=\s*([0-9a-f]{32,128})\s*$/i.exec(line);
    if (m && LEN[m[3].length]) out.push({ hex: m[3].toLowerCase(), name: m[2].replace(/^\.\//, ''), algo: LEN[m[3].length] });
  }
  return out;
}
/** the line a sha256sum-style file holds for one file: "hash  name". */
export const sumLine = (hex, name) => hex + '  ' + String(name).replace(/[\r\n]/g, ' ');
/** bytes -> "1.4 GB" style. */
export function sizeOf(n) { const u = ['bytes', 'KB', 'MB', 'GB', 'TB']; let i = 0, v = n; while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; } return (i ? v.toFixed(1) : String(v)) + ' ' + u[i]; }
