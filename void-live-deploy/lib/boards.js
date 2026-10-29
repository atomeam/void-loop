/**
 * boards: the pure half of Verse's image and text boards (/boards/, functions/api/boards/[[path]].js). Owner, 2026-10-25: "Let's go after the chans
 * next ... sweep through the image boards and text boards"; strangers may post "anything legal, just like the existing boards"; then "we have to,
 * you do remember, so we have everything they do and more; leave the categories blank but user creatable". So there are no starter boards: anyone
 * makes one (a short code, a title, a line about it, SFW or 18+, images or text only). Everything a chan does is here as pure functions the page and
 * the server share: board codes, tripcodes (hashed with the server's secret, the password never kept), greentext, >>quotes and >>>/board/ links,
 * text spoilers, sage, the bump limit and the page limit, the image checks (the type read from the bytes, never the name; the size read from the
 * header; EXIF, XMP, GPS and comments stripped or refused) and the proof-of-work bot check used when Turnstile is not set up.
 * Pure: no network, no storage, no DOM. Tests: tools/boards.test.mjs.
 */

export const CODE_RE = /^[a-z0-9]{1,10}$/;
// codes a board may not take: the site's own words, and words that would read as official
export const RESERVED = Object.freeze(['api', 'admin', 'mod', 'mods', 'rules', 'new', 'create', 'all', 'search', 'archive', 'catalog', 'boards', 'board', 'verse', 'void', 'owner',
  'help', 'about', 'static', 'www', 'null', 'undefined', 'report', 'reports', 'settings', 'watch', 'staff', 'official', 'support', 'legal', 'dmca', 'abuse', 'i', 't', 'login']);
export const LIMITS = Object.freeze({
  title: 40, about: 200, name: 40, sub: 100, body: 4000, lines: 120, why: 200,
  perPage: 15, pages: 10, bump: 300, images: 150, replies: 500, // a thread sinks after 300 replies, takes 150 images, locks at 500; 10 pages of 15 stay live, the rest go to the archive
  hideAt: 3, // reports from this many different people hide a post until the owner looks
  file: 4 * 1024 * 1024, thumb: 200 * 1024, thumbPx: 250, px: 10000,
});
/** the thread limits of a board (a row with text_only, or { textOnly }): a text board's threads run to 1,000 posts, as a textboard's do. Pure. */
export const limitsOf = (b) => (b && (b.text_only || b.textOnly) ? { bump: 1000, replies: 1000, images: 0 } : { bump: LIMITS.bump, replies: LIMITS.replies, images: LIMITS.images });
export const TYPES = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' });
export const REPORT_WHY = Object.freeze(['illegal content', 'personal information (doxxing)', 'spam or flooding', 'wrong board or wrong rating', 'other rule broken']);
export const POW_BITS = 16; // about 65,000 hashes: a second or two on a phone, a cost for a script that posts thousands

/** why a board code cannot be used, or '' when it can (taken: a Set of codes already made). Pure. */
export function codeProblem(code, taken = new Set()) {
  const c = String(code == null ? '' : code);
  if (!CODE_RE.test(c)) return 'a code is 1 to 10 lowercase letters or digits, like b, tech or g2';
  if (RESERVED.includes(c)) return '/' + c + '/ is reserved';
  if (taken.has(c)) return '/' + c + '/ is taken';
  return '';
}

/** text as typed, made safe to keep: control characters out (a newline stays), CRLF to LF, at most 2 blank lines in a row, trimmed, cut to max. Pure. */
export function cleanText(s, max, lines = Infinity) {
  let t = String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f‪-‮⁦-⁩]/g, (c) => (c === '\t' ? ' ' : ''));
  t = t.replace(/\n{4,}/g, '\n\n\n').trim();
  if (lines !== Infinity) t = t.split('\n').slice(0, lines).join('\n');
  return Array.from(t).slice(0, max).join('').trim();
}
/** one line: no newlines at all. Pure. */
export const cleanLine = (s, max) => cleanText(String(s == null ? '' : s).replace(/\s+/g, ' '), max);

/** "name#password" -> { name, secret }: what is after the first # is the tripcode's password, never shown and never kept. Pure. */
export function parseName(raw) {
  const s = String(raw == null ? '' : raw), at = s.indexOf('#');
  const name = cleanLine(at < 0 ? s : s.slice(0, at), LIMITS.name) || 'Anonymous', secret = at < 0 ? '' : s.slice(at + 1).slice(0, 128);
  return { name, secret };
}
const enc = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '.').replace(/\//g, '_').replace(/=+$/, '');
/** the tripcode for a password: "!" and 10 characters of an HMAC keyed by the server's secret, so the same password always gives the same mark
 *  and nobody can work one out without the secret (a "secure tripcode"); '' for no password. */
export async function tripcode(secret, key) {
  if (!secret || !key) return '';
  const k = await crypto.subtle.importKey('raw', enc.encode('verse-boards-trip:' + key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return '!' + b64u(await crypto.subtle.sign('HMAC', k, enc.encode(secret))).slice(0, 10);
}
/** sage: the options field says sage, so a reply does not bump its thread. Pure. */
export const isSage = (options) => /(?:^|\s)sage(?:\s|$)/i.test(String(options || ''));

const esc = (x) => String(x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// one pass over a line: >>>/board/123, >>>/board/, >>123, a link, [spoiler] and [/spoiler]
const TOKEN = /(>>>\/([a-z0-9]{1,10})\/(\d{1,9})?)|(>>(\d{1,9}))|(https?:\/\/[^\s<>"']{2,300})|(\[spoiler\])|(\[\/spoiler\])|(\[code\])|(\[\/code\])/gi;
/** a post's text as HTML: every character escaped, then greentext lines, >>quotes (data-q, for the preview), >>>/board/ links, links (nofollow,
 *  opened apart) and [spoiler] text. `here` is the board the post is on (a >>quote stays on it); `thread` the thread number, when known. Pure. */
export function render(body, { here = '', thread = 0 } = {}) {
  let open = 0, code = false;
  const out = String(body == null ? '' : body).split('\n').map((line) => {
    let html = '', last = 0;
    for (const m of line.matchAll(TOKEN)) {
      html += esc(line.slice(last, m.index)); last = m.index + m[0].length;
      if (m[1]) { const b = m[2].toLowerCase(), n = m[3]; html += '<a class="ql xb" href="/boards/?b=' + b + (n ? '&amp;p=' + n : '') + '">' + esc(m[0]) + '</a>'; }
      else if (m[4]) html += '<a class="ql" data-q="' + m[5] + '" href="' + (here ? '/boards/?b=' + esc(here) + '&amp;p=' + m[5] : '') + '#p' + m[5] + '">&gt;&gt;' + m[5] + '</a>';
      else if (m[6]) { const u = m[6].replace(/[).,!?:;]+$/, ''); last -= m[6].length - u.length; html += '<a href="' + esc(u) + '" rel="nofollow ugc noopener noreferrer" target="_blank">' + esc(u) + '</a>'; }
      else if (m[7]) { open++; html += '<span class="sp">'; }
      else if (m[8]) { if (open) { open--; html += '</span>'; } else html += esc(m[0]); }
      else if (m[9]) { if (code) html += esc(m[0]); else { code = true; html += '<code class="cd">'; } }
      else if (m[10]) { if (code) { code = false; html += '</code>'; } else html += esc(m[0]); }
    }
    html += esc(line.slice(last));
    return /^>(?!>\d)/.test(line) ? '<span class="gt">' + html + '</span>' : html;
  }).join('<br>');
  return out + (code ? '</code>' : '') + '</span>'.repeat(open);
}
/** the post numbers a text quotes with >>n (for the "replies" backlinks), in order, once each. Pure. */
export function quotesIn(body) {
  const seen = new Set();
  for (const m of String(body || '').matchAll(/(?<!>)>>(\d{1,9})(?!\d)/g)) seen.add(+m[1]);
  return [...seen];
}
/** a post as one line of plain text, for the catalog and the share preview: whole up to n characters, else cut at the last word that fits
 *  (the thread itself always shows it all). Pure. */
export const excerpt = (body, n = 160) => { const t = String(body || '').replace(/\[\/?spoiler\]/gi, '').replace(/\s+/g, ' ').trim(), a = Array.from(t); if (a.length <= n) return t; const cut = a.slice(0, n).join(''), sp = cut.lastIndexOf(' '); return (sp > n / 2 ? cut.slice(0, sp) : cut).trim(); };

/** true when a search's words are all in a post's subject or text (any case). Pure. */
export function matches(q, post) {
  const words = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) return false;
  const hay = (String(post.sub || '') + ' ' + String(post.body || '')).toLowerCase();
  return words.every((w) => hay.includes(w));
}
/** the catalog's order: by bump (the default), by when the thread was made, or by replies; a stuck thread is never sorted here. Pure. */
export function order(threads, by = 'bump') {
  const k = by === 'new' ? 'at' : by === 'replies' ? 'replies' : 'bumped';
  return [...threads].sort((a, b) => (b[k] || 0) - (a[k] || 0) || b.no - a.no);
}
/** a thread's page in the index (1-based) from its place in bump order. Pure. */
export const pageOf = (i) => Math.floor(i / LIMITS.perPage) + 1;

// ---- images ----
const u8 = (b) => (b instanceof Uint8Array ? b : new Uint8Array(b));
const ascii = (b, at, n) => String.fromCharCode(...b.subarray(at, at + n));
/** the type of an image from its first bytes (never its name or what the browser said): 'image/jpeg', 'image/png', 'image/gif', 'image/webp' or null. Pure. */
export function sniff(bytes) {
  const b = u8(bytes); if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG' && b[4] === 0x0d && b[5] === 0x0a) return 'image/png';
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'image/webp';
  return null;
}
/** an image's width and height from its header, or null when the header cannot be read (a file that is not what it says). Pure. */
export function dims(bytes, type = sniff(bytes)) {
  const b = u8(bytes), dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    if (type === 'image/png') return ascii(b, 12, 4) === 'IHDR' ? { w: dv.getUint32(16), h: dv.getUint32(20) } : null;
    if (type === 'image/gif') return { w: dv.getUint16(6, true), h: dv.getUint16(8, true) };
    if (type === 'image/webp') {
      const kind = ascii(b, 12, 4);
      if (kind === 'VP8X') return { w: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), h: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) };
      if (kind === 'VP8 ') return { w: dv.getUint16(26, true) & 0x3fff, h: dv.getUint16(28, true) & 0x3fff };
      if (kind === 'VP8L') { const v = dv.getUint32(21, true); return { w: (v & 0x3fff) + 1, h: ((v >> 14) & 0x3fff) + 1 }; }
      return null;
    }
    if (type === 'image/jpeg') {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) return null;
        const m = b[i + 1]; if (m === 0xff) { i++; continue; }
        const len = dv.getUint16(i + 2);
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: dv.getUint16(i + 5), w: dv.getUint16(i + 7) };
        i += 2 + len;
      }
    }
  } catch (_) {}
  return null;
}
// the parts of each format that carry who took a picture, where and with what: what stripMeta() takes out and metaIn() reports
/** the hidden data an image carries that could say who or where: ['exif', 'xmp', 'comment', 'text'...], [] for none. Pure. */
export function metaIn(bytes, type = sniff(bytes)) {
  const found = new Set(); walk(u8(bytes), type, (kind) => { found.add(kind); return true; }); return [...found];
}
/** the same image with its EXIF (camera, time, GPS place), XMP, comments and text chunks taken out, the picture itself untouched; null when the
 *  file cannot be walked (refused). JPEG: APP1 to APP15 except the colour profile, and comments; PNG: eXIf, tEXt, zTXt, iTXt, tIME; GIF: comments
 *  and application blocks but the loop count; WebP: EXIF and XMP chunks, the header flags fixed. Pure. */
export function stripMeta(bytes, type = sniff(bytes)) { return walk(u8(bytes), type, () => false); }
// walks a file's blocks; keep(kind) says whether a metadata block stays. Returns the rebuilt bytes, or null when the file is malformed.
function walk(b, type, keep) {
  const parts = [], dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  try {
    if (type === 'image/jpeg') {
      parts.push(b.subarray(0, 2)); let i = 2;
      for (;;) {
        if (i + 4 > b.length || b[i] !== 0xff) return null;
        const m = b[i + 1];
        if (m === 0xda) { parts.push(b.subarray(i)); break; } // the picture itself, to the end
        if (m === 0xd9) { parts.push(b.subarray(i, i + 2)); break; }
        const len = dv.getUint16(i + 2), seg = b.subarray(i, i + 2 + len); if (i + 2 + len > b.length) return null;
        let kind = '';
        if (m === 0xfe) kind = 'comment';
        else if (m >= 0xe1 && m <= 0xef) { const id = ascii(b, i + 4, Math.min(12, len - 2)); if (!(m === 0xe2 && id.startsWith('ICC_PROFILE'))) kind = /^Exif/.test(id) ? 'exif' : /^http:\/\/ns\.adobe\.com|^XMP/.test(id) ? 'xmp' : 'app'; }
        if (!kind || keep(kind)) parts.push(seg);
        i += 2 + len;
      }
    } else if (type === 'image/png') {
      parts.push(b.subarray(0, 8)); let i = 8;
      for (;;) {
        if (i + 12 > b.length) return null;
        const len = dv.getUint32(i), t = ascii(b, i + 4, 4), end = i + 12 + len; if (end > b.length) return null;
        const kind = t === 'eXIf' ? 'exif' : t === 'iTXt' && ascii(b, i + 8, 17) === 'XML:com.adobe.xmp' ? 'xmp' : /^(?:tEXt|zTXt|iTXt)$/.test(t) ? 'text' : t === 'tIME' ? 'time' : '';
        if (!kind || keep(kind)) parts.push(b.subarray(i, end));
        i = end; if (t === 'IEND') break;
      }
    } else if (type === 'image/gif') {
      let i = 13; if (b[10] & 0x80) i += 3 * 2 ** ((b[10] & 7) + 1);
      parts.push(b.subarray(0, i));
      const subs = (j) => { while (j < b.length && b[j] !== 0) j += b[j] + 1; if (j >= b.length) throw new Error('short'); return j + 1; };
      for (;;) {
        if (i >= b.length) return null;
        const c = b[i];
        if (c === 0x3b) { parts.push(b.subarray(i, i + 1)); break; }
        if (c === 0x2c) { let j = i + 10; if (b[i + 9] & 0x80) j += 3 * 2 ** ((b[i + 9] & 7) + 1); j = subs(j + 1); parts.push(b.subarray(i, j)); i = j; continue; }
        if (c !== 0x21) return null;
        const label = b[i + 1], j = subs(i + 2);
        let kind = '';
        if (label === 0xfe) kind = 'comment';
        else if (label === 0xff) { const id = ascii(b, i + 3, 11); if (id !== 'NETSCAPE2.0' && id !== 'ANIMEXTS1.0') kind = /^XMP Data/.test(id) ? 'xmp' : 'app'; }
        if (!kind || keep(kind)) parts.push(b.subarray(i, j));
        i = j;
      }
    } else if (type === 'image/webp') {
      let i = 12, x = -1; const kept = [];
      while (i + 8 <= b.length) {
        const t = ascii(b, i, 4), len = dv.getUint32(i + 4, true), end = i + 8 + len + (len & 1); if (i + 8 + len > b.length) return null;
        const kind = t === 'EXIF' ? 'exif' : t === 'XMP ' ? 'xmp' : '';
        if (!kind || keep(kind)) { if (t === 'VP8X') x = kept.length; kept.push(b.slice(i, Math.min(end, b.length))); }
        i = end;
      }
      if (x >= 0) kept[x][8] &= ~(0x08 | 0x04); // the VP8X flags: no EXIF, no XMP any more (they were kept only if keep() said so)
      if (x >= 0) for (const k of kept) { const t = ascii(k, 0, 4); if (t === 'EXIF') kept[x][8] |= 0x08; if (t === 'XMP ') kept[x][8] |= 0x04; }
      const size = 4 + kept.reduce((n, k) => n + k.length, 0), head = new Uint8Array(12); head.set(b.subarray(0, 12)); new DataView(head.buffer).setUint32(4, size, true);
      parts.push(head, ...kept);
    } else return null;
  } catch (_) { return null; }
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
/** the image checks the server makes on an upload: { ok, type, ext, w, h, bytes } with its metadata stripped, or { ok: false, why }. Pure. */
export function checkImage(bytes, { max = LIMITS.file, px = LIMITS.px, thumb = false } = {}) {
  const b = u8(bytes);
  if (!b.length) return { ok: false, why: 'the file is empty' };
  if (b.length > max) return { ok: false, why: 'the file is over ' + Math.round(max / 1024) + ' KB' };
  const type = sniff(b); if (!type) return { ok: false, why: 'only JPEG, PNG, GIF and WebP pictures are taken' };
  if (thumb && !/jpeg|webp|png/.test(type)) return { ok: false, why: 'a thumbnail is a JPEG, PNG or WebP' };
  const d = dims(b, type); if (!d || !d.w || !d.h) return { ok: false, why: 'the picture could not be read' };
  if (d.w > px || d.h > px) return { ok: false, why: 'the picture is over ' + px + ' pixels across' };
  const clean = stripMeta(b, type); if (!clean) return { ok: false, why: 'the picture could not be read' };
  if (metaIn(clean, type).length) return { ok: false, why: 'the picture still carries hidden data' };
  return { ok: true, type, ext: TYPES[type], w: d.w, h: d.h, bytes: clean };
}

// ---- the bot check when Turnstile is not set up: proof of work ----
/** how many zero bits a hash starts with. Pure. */
export function zeroBits(hash) {
  const b = u8(hash); let n = 0;
  for (const x of b) { if (x === 0) { n += 8; continue; } n += Math.clz32(x) - 24; break; }
  return n;
}
/** true when sha256(challenge + ':' + nonce) starts with `bits` zero bits. */
export async function workOk(challenge, nonce, bits = POW_BITS) {
  if (typeof challenge !== 'string' || !/^\d{1,12}$/.test(String(nonce))) return false;
  return zeroBits(await crypto.subtle.digest('SHA-256', enc.encode(challenge + ':' + nonce))) >= bits;
}
/** the nonce that does the work (the page runs this; tests too). Resolves to a number. */
export async function doWork(challenge, bits = POW_BITS, batch = 256) {
  for (let n = 0; ; n += batch) {
    const hs = await Promise.all(Array.from({ length: batch }, (_, k) => crypto.subtle.digest('SHA-256', enc.encode(challenge + ':' + (n + k)))));
    const k = hs.findIndex((h) => zeroBits(h) >= bits); if (k >= 0) return n + k;
  }
}

/** the words the page shows a person, one place. */
export const RULES = Object.freeze([
  'Anything legal. Nothing that is illegal where Verse is hosted (the United States) or where you are: no child sexual abuse material, ever, in any form; it is taken down at once, held out of public reach as the law requires, and reported to the NCMEC.',
  'No personal information about anyone who has not made it public themselves (doxxing): names with addresses, phone numbers, workplaces, photos taken to identify someone.',
  'No threats of violence against a real person or place, and no calls to harm someone.',
  'Adult content only on boards marked 18+. Every board says what it is when it is made; keep to it.',
  'No spam, flooding or advertising. One person, one voice: no posting the same thing over and over.',
  'Uploads are pictures (JPEG, PNG, GIF, WebP) of up to 4 MB; their hidden data (camera, time, GPS place) is taken out before they are kept.',
  'Report what breaks a rule with the Report button on the post. Three reports hide a post until it is looked at.',
]);
export const CONTACT = 'atom@a-to-mind.com';
