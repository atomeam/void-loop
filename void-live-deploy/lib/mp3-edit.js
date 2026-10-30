// MP3 files changed on the device without coding the sound again, so nothing is lost: the cover picture in the ID3 tag. Pure.
// ID3v2.3 and v2.4 tags (id3.org/id3v2.3.0, id3.org/id3v2.4.0-structure) keep their own frames; a v2.2 tag keeps its common text.

const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));
const syncsafe = (b, at) => ((b[at] & 127) << 21) | ((b[at + 1] & 127) << 14) | ((b[at + 2] & 127) << 7) | (b[at + 3] & 127);
const be32 = (b, at) => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0;
const putSyncsafe = (n) => [(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127];
const putBe32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const cat = (parts) => { const o = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let k = 0; for (const p of parts) { o.set(p, k); k += p.length; } return o; };
// FF 00 back to FF: the tag was written with unsynchronisation
const unsync = (b) => { const o = []; for (let i = 0; i < b.length; i++) { o.push(b[i]); if (b[i] === 0xff && b[i + 1] === 0) i++; } return Uint8Array.from(o); };
const V22 = { TT2: 'TIT2', TP1: 'TPE1', TP2: 'TPE2', TAL: 'TALB', TYE: 'TYER', TRK: 'TRCK', TPA: 'TPOS', TCO: 'TCON', TCM: 'TCOM', COM: 'COMM' };

/** the first MPEG audio frame header at or after `at`: { at, version, layer, bytes } or null. Two frames in a row must agree. */
export function firstFrame(b, at = 0) {
  for (let i = at; i + 4 <= b.length; i++) {
    const h = header(b, i); if (!h) continue;
    const n = header(b, i + h.bytes); if (n && n.version === h.version && n.layer === h.layer && n.rate === h.rate) return { at: i, ...h };
    if (i + h.bytes === b.length) return { at: i, ...h };
  }
  return null;
}
const RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
const KBPS1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], KBPS2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
/** a Layer III frame header at `i`: { version (3: MPEG-1, 2: MPEG-2, 0: MPEG-2.5), layer, rate, kbps, channels, bytes } or null */
export function header(b, i) {
  if (i + 4 > b.length || b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) return null;
  const version = (b[i + 1] >> 3) & 3, layer = (b[i + 1] >> 1) & 3, bi = b[i + 2] >> 4, ri = (b[i + 2] >> 2) & 3, pad = (b[i + 2] >> 1) & 1;
  if (version === 1 || layer !== 1 || bi === 0 || bi === 15 || ri === 3) return null;
  const rate = RATES[version][ri], kbps = (version === 3 ? KBPS1 : KBPS2)[bi], bytes = Math.floor((version === 3 ? 144 : 72) * kbps * 1000 / rate) + pad;
  return { version, layer: 3, rate, kbps, channels: (b[i + 3] >> 6) === 3 ? 1 : 2, bytes, samples: version === 3 ? 1152 : 576 };
}

/** the ID3v2 tag at the start: { version, end (the first byte after it), frames: [{ id, flags, data }], dropped } or null */
export function readTag(b) {
  if (b.length < 10 || ascii(b, 0, 3) !== 'ID3') return null;
  const version = b[3], flags = b[5], size = syncsafe(b, 6), end = 10 + size + (version === 4 && flags & 0x10 ? 10 : 0);
  let body = b.subarray(10, Math.min(b.length, 10 + size));
  if (flags & 0x80 && version < 4) body = unsync(body);
  let p = 0; const frames = []; let dropped = 0;
  if (flags & 0x40) p = version === 4 ? syncsafe(body, 0) : 4 + be32(body, 0);
  const idLen = version === 2 ? 3 : 4, headLen = version === 2 ? 6 : 10;
  while (p + headLen <= body.length && body[p] !== 0) {
    const id = ascii(body, p, idLen), n = version === 2 ? (body[p + 3] << 16) | (body[p + 4] << 8) | body[p + 5] : version === 4 ? syncsafe(body, p + 4) : be32(body, p + 4);
    if (!/^[A-Z0-9]+$/.test(id) || p + headLen + n > body.length) break;
    let data = body.subarray(p + headLen, p + headLen + n), fl = version === 2 ? 0 : (body[p + 8] << 8) | body[p + 9];
    if (version === 4 && fl & 0x02) { data = unsync(data); fl &= ~0x02; }
    if (version === 4 && fl & 0x01) { data = data.subarray(4); fl &= ~0x01; }
    p += headLen + n;
    if (version === 2) { if (V22[id]) frames.push({ id: V22[id], flags: 0, data }); else dropped++; continue; }
    // compressed or encrypted frames cannot be carried into a new tag as they are
    if ((version === 3 && fl & 0x00c0) || (version === 4 && fl & 0x000c)) { dropped++; continue; }
    frames.push({ id, flags: 0, data });
  }
  return { version, end, frames, dropped };
}

/** an ID3v2 tag (v2.3, or v2.4 when the file had v2.4) with these frames */
export function writeTag(frames, version = 3) {
  const parts = frames.map((f) => cat([new TextEncoder().encode(f.id), Uint8Array.from(version === 4 ? putSyncsafe(f.data.length) : putBe32(f.data.length)), Uint8Array.of(0, 0), f.data]));
  const body = cat(parts);
  return cat([Uint8Array.of(0x49, 0x44, 0x33, version, 0, 0, ...putSyncsafe(body.length)), body]);
}

/** an APIC frame body: the front cover (picture type 3), with its MIME type and no description */
export function apic(picture, mime) {
  return cat([Uint8Array.of(0), new TextEncoder().encode(mime), Uint8Array.of(0, 3, 0), picture]);
}

/** the MP3 with `picture` (JPEG or PNG bytes) as its front cover: { bytes, notes }. The sound is the same bytes as before. */
export function addCover(mp3, picture, mime) {
  if (mime !== 'image/jpeg' && mime !== 'image/png') throw new Error('the cover must be a JPEG or a PNG picture.');
  const tag = readTag(mp3), audioAt = tag ? Math.min(tag.end, mp3.length) : 0, first = firstFrame(mp3, audioAt);
  if (!first || first.at - audioAt > 65536) throw new Error('this is not an MP3: no MPEG audio frames were found.');
  const kept = tag ? tag.frames.filter((f) => f.id !== 'APIC') : [], replaced = tag ? tag.frames.length - kept.length : 0;
  const version = tag && tag.version === 4 ? 4 : 3, out = cat([writeTag([...kept, { id: 'APIC', flags: 0, data: apic(picture, mime) }], version), mp3.subarray(audioAt)]);
  const notes = [replaced ? 'the cover picture it had was replaced' : 'a cover picture added', (picture.length / 1024).toFixed(0) + ' KB picture (' + mime.slice(6).toUpperCase() + ')', 'the sound is untouched: the same MP3 frames, not coded again'];
  if (kept.length) notes.push(kept.length + ' other tag field' + (kept.length === 1 ? '' : 's') + ' kept (title, artist and the rest)');
  if (tag && tag.dropped) notes.push(tag.dropped + ' tag field' + (tag.dropped === 1 ? '' : 's') + ' Verse cannot carry over were left out');
  return { bytes: out, notes };
}
