// Pure logic of the safety kit (owner, 2026-10-18, tools pack 8): hide numbers, redact, panic, a casual PIN lock, auto-lock,
// clear clipboard, ephemeral session, confirm before mass delete, the "unverified" badge, and the photo scrub.
// Everything is device-local; nothing here sends anything anywhere. Tests: tools/tools-pack-8.test.mjs.

/** every digit as a dot (hide number mode). Pure. */
export const maskDigits = (s) => String(s == null ? '' : s).replace(/\d/g, '•');

/** text as black blocks, spaces kept so the shape of the line stays (redact). Pure. */
export const redactText = (s) => String(s == null ? '' : s).replace(/[^\s]/g, '█');

const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').toLowerCase();
const POLITE = '(?:please\\s+)?';

/** what a safety ask wants: { op, ... } or null. Short, anchored phrases only, so "hide the numbers in my taxes" is left alone. Pure. */
export function safetyIntent(text) {
  const t = tidy(text);
  let m;
  if (new RegExp('^' + POLITE + '(?:hide|mask|blur)\\s+(?:all\\s+)?(?:my\\s+|the\\s+)?numbers?(?:\\s+(?:on\\s+(?:the\\s+)?stage|here))?$|^(?:privacy|hide[\\s-]?numbers?)\\s+mode(?:\\s+on)?$|^turn\\s+on\\s+(?:privacy|hide[\\s-]?numbers?)\\s+mode$').test(t)) return { op: 'numbers', on: true };
  if (new RegExp('^' + POLITE + '(?:show|unmask|unhide|reveal)\\s+(?:all\\s+)?(?:my\\s+|the\\s+)?numbers?$|^(?:privacy|hide[\\s-]?numbers?)\\s+mode\\s+off$|^turn\\s+off\\s+(?:privacy|hide[\\s-]?numbers?)\\s+mode$').test(t)) return { op: 'numbers', on: false };
  if (new RegExp('^' + POLITE + '(?:redact|black\\s+out)\\s+(?:the\\s+|my\\s+)?(?:selection|selected(?:\\s+text)?|this\\s+selection|what\\s+i\\s+selected)$').test(t)) return { op: 'redact' };
  if (new RegExp('^' + POLITE + '(?:unredact|undo\\s+(?:the\\s+)?redaction|remove\\s+(?:the\\s+)?redactions?)(?:\\s+all)?$').test(t)) return { op: 'unredact' };
  if (new RegExp('^' + POLITE + '(?:panic(?:\\s+(?:hide|button|mode))?(?:\\s+the\\s+stage)?|hide\\s+(?:the\\s+|my\\s+)?(?:whole\\s+)?stage|hide\\s+everything\\s+now)$').test(t)) return { op: 'panic' };
  if (new RegExp('^' + POLITE + 'lock\\s+(?:the\\s+|my\\s+)?(?:stage|screen|tab|(?:verse|void)|page)(?:\\s+now)?$|^lock\\s+now$').test(t)) return { op: 'lock' }; // never a bare "lock it": that locks the picked thing (a note against arrows), not the screen (2026-10-19: it locked the whole stage)
  if (new RegExp('^' + POLITE + '(?:(?:set|make|change|add|use)\\s+(?:me\\s+)?(?:a\\s+|my\\s+)?pin(?:\\s+(?:lock|code))?(?:\\s+for\\s+(?:the\\s+|this\\s+)?(?:stage|tab|(?:verse|void)|page))?|pin\\s+lock(?:\\s+(?:the\\s+)?(?:stage|tab))?|lock\\s+(?:the\\s+)?(?:stage|tab|page)\\s+with\\s+(?:a\\s+)?pin|lock\\s+card)$').test(t)) return { op: 'pincard' };
  if ((m = new RegExp('^' + POLITE + 'auto[\\s-]?lock\\s+(?:after\\s+)?(\\d{1,3})\\s*(?:min(?:ute)?s?|m)(?:\\s+(?:of\\s+)?(?:idle|inactivity|doing\\s+nothing))?$|^' + POLITE + 'lock\\s+(?:the\\s+stage\\s+)?after\\s+(\\d{1,3})\\s*(?:min(?:ute)?s?|m)\\s+(?:idle|of\\s+(?:idle|inactivity|doing\\s+nothing))$').exec(t))) {
    const n = Math.round(+(m[1] || m[2]));
    return n >= 1 && n <= 240 ? { op: 'autolock', minutes: n } : null;
  }
  if (new RegExp('^' + POLITE + '(?:auto[\\s-]?lock\\s+(?:off|never)|(?:turn\\s+off|stop)\\s+auto[\\s-]?lock|no\\s+auto[\\s-]?lock)$').test(t)) return { op: 'autolock', minutes: 0 };
  if (new RegExp('^' + POLITE + '(?:clear|wipe|empty|erase)\\s+(?:my\\s+|the\\s+)?clipboard$').test(t)) return { op: 'clipboard' };
  if (new RegExp('^' + POLITE + '(?:(?:turn\\s+on|start|use|switch\\s+to)\\s+)?(?:ephemeral|incognito|forget[\\s-]?me)\\s+(?:mode|session)(?:\\s+on)?$|^don.?t\\s+(?:save|keep)\\s+this\\s+session$').test(t)) return { op: 'ephemeral', on: true };
  if (new RegExp('^' + POLITE + '(?:turn\\s+off|stop|end|leave)\\s+(?:the\\s+)?(?:ephemeral|incognito|forget[\\s-]?me)\\s+(?:mode|session)$|^(?:ephemeral|incognito|forget[\\s-]?me)\\s+(?:mode|session)\\s+off$|^(?:save|keep)\\s+this\\s+session\\s+again$').test(t)) return { op: 'ephemeral', on: false };
  if (new RegExp('^' + POLITE + '(?:confirm|ask)\\s+(?:me\\s+)?before\\s+(?:a\\s+)?(?:mass\\s+delet(?:e|ing)|delet(?:e|ing)\\s+(?:many|lots|several|a\\s+lot|everything)|clear(?:ing)?\\s+(?:the\\s+)?(?:stage|many|everything)|remov(?:e|ing)\\s+(?:many|several))$|^(?:turn\\s+on\\s+)?confirm\\s+mass\\s+delete$').test(t)) return { op: 'confirm', on: true };
  if (new RegExp('^' + POLITE + '(?:stop\\s+(?:asking|confirming)\\s+before\\s+(?:a\\s+)?(?:mass\\s+delet(?:e|ing)|clearing)|(?:turn\\s+off\\s+)?confirm\\s+mass\\s+delete\\s+off|no\\s+confirm(?:ation)?\\s+(?:before|on)\\s+mass\\s+delete)$').test(t)) return { op: 'confirm', on: false };
  if ((m = /^(?:please\s+)?(?:mark\s+(?:this\s+|a\s+|the\s+)?(?:claim\s+)?(?:as\s+)?unverified|unverified(?:\s+claim)?|flag\s+(?:this\s+)?(?:claim\s+)?(?:as\s+)?unverified)\s*(?::|-|—)\s*(.+)$/i.exec(String(text || '').trim().replace(/\s+/g, ' ')))) {
    const claim = m[1].trim().slice(0, 280);
    return claim ? { op: 'claim', text: claim } : null;
  }
  return null;
}

/** the label and state a claim card shows. Pure. */
export function claimState(th) {
  const checked = !!(th && th.checked);
  return { label: checked ? 'Checked' : 'Unverified', checked, note: String((th && th.note) || '').slice(0, 200) };
}

/** a PIN is 4 to 12 characters. Pure. */
export const pinOk = (pin) => /^.{4,12}$/.test(String(pin || ''));

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');

/** a fresh random salt as hex (16 bytes). `cryptoApi` is the Web Crypto object (the page's, or node's in tests). */
export function makeSalt(cryptoApi) { return hex(cryptoApi.getRandomValues(new Uint8Array(16))); }

/** the PIN hashed with PBKDF2-SHA256 (60000 rounds) and the salt: what is kept on the device instead of the PIN. */
export async function hashPin(pin, salt, cryptoApi) {
  const enc = new TextEncoder(), subtle = cryptoApi.subtle;
  const key = await subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(String(salt)), iterations: 60000 }, key, 256);
  return hex(bits);
}

/** does this PIN match the kept hash */
export async function checkPin(pin, rec, cryptoApi) {
  if (!rec || !rec.hash || !rec.salt) return false;
  return (await hashPin(pin, rec.salt, cryptoApi)) === rec.hash;
}

/** has the stage been idle long enough to lock. minutes 0 means never. Pure. */
export const idleDue = (lastActive, now, minutes) => !!minutes && now - lastActive >= minutes * 60000;

/** is a mass delete of n things worth a question. Pure. */
export const needsConfirm = (n, enabled) => !!enabled && n >= 2;

// ---- the photo scrub: drop the hidden data (camera, time, place) from a picture's bytes without redrawing it ----

const u16 = (b, i) => (b[i] << 8) | b[i + 1];
const u32 = (b, i) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

/** what is in this picture's bytes: { type, removed: [names], bytesRemoved, gps }. type is jpeg, png or '' */
export function scrubReport(bytes) {
  const out = stripMeta(bytes);
  return { type: out.type, removed: out.removed, bytesRemoved: out.bytesRemoved, gps: out.gps };
}

/** the picture's bytes without EXIF/XMP/IPTC/comment segments (JPEG) or exif/text/time chunks (PNG), pixels untouched. Pure. */
export function stripMeta(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) return stripJpeg(b);
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return stripPng(b);
  return { type: '', bytes: b, removed: [], bytesRemoved: 0, gps: false };
}

function stripJpeg(b) {
  const keep = [b.subarray(0, 2)], removed = [];
  let i = 2, gps = false, dropped = 0;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) break; // not a marker: stop reading segments, keep the rest as it is
    const m = b[i + 1];
    if (m === 0xff) { i += 1; continue; }
    if (m === 0xda || m === 0xd9) break; // start of scan / end of image: the rest is pixels
    if (m >= 0xd0 && m <= 0xd7 || m === 0x01) { keep.push(b.subarray(i, i + 2)); i += 2; continue; }
    const len = u16(b, i + 2);
    if (len < 2 || i + 2 + len > b.length) break;
    const seg = b.subarray(i, i + 2 + len), head = String.fromCharCode(...seg.subarray(4, Math.min(seg.length, 4 + 29)));
    let name = '';
    if (m === 0xe1 && head.startsWith('Exif\0')) { name = 'EXIF'; if (hasGpsIfd(seg)) gps = true; }
    else if (m === 0xe1 && /^http:\/\/ns\.adobe\.com\/xap/.test(head)) name = 'XMP';
    else if (m === 0xed) name = 'IPTC';
    else if (m === 0xfe) name = 'comment';
    else if (m === 0xe2 && head.startsWith('MPF')) name = 'multi-picture data';
    if (name) { removed.push(name); dropped += seg.length; } else keep.push(seg);
    i += 2 + len;
  }
  keep.push(b.subarray(i));
  return { type: 'jpeg', bytes: concat(keep), removed: [...new Set(removed)], bytesRemoved: dropped, gps };
}

// a GPS IFD is entry tag 0x8825 in IFD0 of the TIFF block after "Exif\0\0"
function hasGpsIfd(seg) {
  try {
    const t = 10; // marker(2)+len(2)+"Exif\0\0"(6)
    const le = seg[t] === 0x49;
    const r16 = (o) => (le ? seg[o] | (seg[o + 1] << 8) : (seg[o] << 8) | seg[o + 1]);
    const r32 = (o) => (le ? (seg[o] | (seg[o + 1] << 8) | (seg[o + 2] << 16) | (seg[o + 3] << 24)) >>> 0 : ((seg[o] << 24) | (seg[o + 1] << 16) | (seg[o + 2] << 8) | seg[o + 3]) >>> 0);
    const ifd = t + r32(t + 4), n = r16(ifd);
    for (let k = 0; k < n && k < 64; k++) if (r16(ifd + 2 + k * 12) === 0x8825) return true;
  } catch (_) {}
  return false;
}

const PNG_DROP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);
function stripPng(b) {
  const keep = [b.subarray(0, 8)], removed = [];
  let i = 8, dropped = 0;
  while (i + 12 <= b.length) {
    const len = u32(b, i), type = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]), end = i + 12 + len;
    if (end > b.length) break;
    if (PNG_DROP.has(type)) { removed.push(type === 'eXIf' ? 'EXIF' : type === 'tIME' ? 'time stamp' : 'text'); dropped += end - i; } else keep.push(b.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  keep.push(b.subarray(i));
  return { type: 'png', bytes: concat(keep), removed: [...new Set(removed)], bytesRemoved: dropped, gps: false };
}

function concat(parts) {
  const n = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** a sentence about what the scrub did. Pure. */
export function scrubSentence(r) {
  if (!r.type) return 'That is not a JPEG or PNG, so there is nothing I can scrub from it.';
  if (!r.removed.length) return 'Nothing hidden in this ' + r.type.toUpperCase() + ': no camera, time or place data found.';
  return 'Removed ' + r.removed.join(', ') + ' (' + r.bytesRemoved + ' bytes)' + (r.gps ? ', including where it was taken' : '') + '. The picture itself is unchanged.';
}
