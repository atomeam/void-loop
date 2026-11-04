// How one emoji looks everywhere (owner, 2026-11-03, a rival's "How emoji looks on Apple Iphone, Android and other platforms" grid: "stuff like
// this is what we need to stop overlooking if we want to call ourselves better"). The same emoji as each vendor draws it, from free, keyless,
// hotlink-friendly sources only (the npm and GitHub copies jsDelivr serves, and Google Fonts for Noto's black-and-white set), plus the one this
// device draws itself. A vendor with no stable public copy (Samsung, WhatsApp, HTC, LG, Emojidex, Mozilla's old FxEmoji) is left out rather than
// faked. Used by /emojis/everywhere/, the /emojis/ wall's picked emoji and the emoji card on the stage (skills/emoji.js).
// Nothing is sent anywhere: the images are plain <img> requests for public files, lazy-loaded, and the emoji list (emoji-datasource) is
// read only when a name or shortcode has to be looked up.

const JS = 'https://cdn.jsdelivr.net';
export const DATA_URL = JS + '/npm/emoji-datasource@16.0.0/emoji.json';
const ds = (v) => (h) => [JS + '/npm/emoji-datasource-' + v + '@16.0.0/img/' + v + '/64/' + h + '.png'];
const up = (h) => h.toUpperCase();
/** the vendors, in the order the grid shows them: id, the name a person knows, where it shows up, and the files to try for a hex sequence
 *  ('1f600', '1f469-200d-1f4bb'), the first that loads wins. `font` draws the emoji as text in that web font instead of an image. */
export const VENDORS = Object.freeze([
  { id: 'apple', name: 'Apple', where: 'iPhone, iPad, Mac', src: ds('apple') },
  { id: 'google', name: 'Google', where: 'Android, Gmail, Chrome OS (Noto)', src: ds('google') },
  { id: 'twitter', name: 'X (Twitter)', where: 'X, Discord (Twemoji)', src: ds('twitter') },
  { id: 'facebook', name: 'Facebook', where: 'Facebook, Messenger', src: ds('facebook') },
  { id: 'fluent3d', name: 'Microsoft 3D', where: 'Teams, Windows 11 (Fluent 3D)', src: (h) => [JS + '/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/' + h + '.webp'] },
  { id: 'fluentflat', name: 'Microsoft flat', where: 'Windows 11, Office (Fluent flat)', src: (h) => [JS + '/npm/@lobehub/fluent-emoji-flat@1.1.0/assets/' + h + '.svg'] },
  { id: 'joypixels', name: 'JoyPixels', where: 'apps that license JoyPixels', src: (h) => [JS + '/joypixels/assets/8.0/png/unicode/64/' + h + '.png'] },
  { id: 'emojione', name: 'EmojiOne', where: 'JoyPixels before the rename', src: (h) => [JS + '/npm/emojione-assets@4.5.0/png/64/' + h + '.png'] },
  { id: 'openmoji', name: 'OpenMoji', where: 'open source, colour', src: (h) => [JS + '/npm/openmoji@17.0.0/color/svg/' + up(h) + '.svg'] },
  { id: 'openmoji-line', name: 'OpenMoji outline', where: 'open source, black and white', src: (h) => [JS + '/gh/hfg-gmuend/openmoji@17.0.0/black/svg/' + up(h) + '.svg'] },
  { id: 'toss', name: 'Toss', where: 'Toss, Korea (Tossface)', src: (h) => [JS + '/gh/toss/tossface@37720aa/dist/svg/u' + up(h).replace(/-/g, '_') + '.svg'] },
  { id: 'blob', name: 'Google Blob', where: 'Android 7 and before (Blobmoji)', src: (h) => [JS + '/gh/C1710/blobmoji@7dd14d2/svg/emoji_u' + h.replace(/-/g, '_') + '.svg'] },
  { id: 'notomono', name: 'Noto mono', where: 'Google Fonts, black and white', font: 'Noto Emoji' },
]);

/** an emoji's code points as a hex sequence, lowercase, joined by '-' ('😀' → '1f600'). Pure. */
export const hexOf = (c) => [...String(c || '')].map((x) => x.codePointAt(0).toString(16)).join('-');
/** "U+1F600 U+FE0F" for a person to read. Pure. */
export const codepointOf = (c) => [...String(c || '')].map((x) => 'U+' + x.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
/** the emoji from a hex sequence ('1f600' or 'U+1F600'), or ''. Pure. */
export const charOf = (hex) => { try { return String(hex || '').replace(/u\+/gi, '').split(/[-_\s]+/).filter(Boolean).map((h) => String.fromCodePoint(parseInt(h, 16))).join(''); } catch (_) { return ''; } };
/** the files to try for one vendor: the sequence as written, then without its FE0F variation selectors (the sets disagree), no repeats. Pure. */
export function filesOf(v, c) {
  if (!v || !v.src) return [];
  const h = hexOf(c), bare = h.split('-').filter((x) => x !== 'fe0f').join('-'), out = [];
  for (const x of [h, bare]) for (const u of v.src(x)) if (x && !out.includes(u)) out.push(u);
  return out;
}

let data = null;
/** the emoji list (emoji-datasource: name, short names, category, the Unicode version it came in), read once, or [] when it cannot be read */
export function loadData() {
  if (!data) data = fetch(DATA_URL).then((r) => (r.ok ? r.json() : [])).then((list) => (Array.isArray(list) ? list : []).map((e) => ({ c: charOf(e.unified), n: String(e.name || e.short_name || '').toLowerCase(), sn: e.short_names || [e.short_name], cat: e.category || '', sub: e.subcategory || '', v: e.added_in || '', order: e.sort_order || 0 })).filter((e) => e.c).sort((a, b) => a.order - b.order)).catch(() => (data = null, []));
  return data;
}
/** one emoji's record from the list: the emoji itself, with or without FE0F. Pure. */
export const recordOf = (list, c) => { const bare = (s) => String(s || '').replace(/\uFE0F/g, ''); return (list || []).find((e) => e.c === c) || (list || []).find((e) => bare(e.c) === bare(c)) || null; };
/** the best match in the list for words a person typed ('grinning', 'thumbs up', ':fire:', '😀'), or null: the emoji itself, an exact short
 *  name, an exact name, a name that starts with the words, then one that holds every word. Pure. */
export function findEmoji(list, q) {
  const s = String(q || '').trim(); if (!s) return null;
  if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s) && !/[a-z]/i.test(s)) return recordOf(list, s) || { c: s, n: '', sn: [] };
  const w = s.toLowerCase().replace(/^:|:$/g, '').replace(/[_-]+/g, ' ').replace(/\b(?:the|an?|emojis?|face)\b/g, ' ').replace(/\s+/g, ' ').trim();
  const sn = w.replace(/ /g, '_'), full = s.toLowerCase().replace(/^:|:$/g, '').replace(/[_-]+/g, ' ').replace(/\b(?:the|an?|emojis?)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (!w && !full) return null;
  return list.find((e) => e.sn.includes(sn)) || list.find((e) => e.n === full) || list.find((e) => e.n === w) || list.find((e) => e.n.startsWith(w + ' ') || e.n.startsWith(full))
    || list.find((e) => w.split(' ').every((x) => (' ' + e.n + ' ' + e.sn.join(' ').replace(/_/g, ' ') + ' ').includes(' ' + x)))
    || list.find((e) => w.split(' ').every((x) => e.n.includes(x))) || null;
}
/** words that are a shortcode, ':grinning:'. Pure. */
export const shortcodeOf = (rec) => (rec && rec.sn && rec.sn[0] ? ':' + rec.sn[0] + ':' : '');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
/** the grid's HTML for one emoji: a tile per vendor (its picture, lazy-loaded, its name and where it shows up) and one for this device. Each
 *  tile is a button that copies the emoji. `compact` is the card's small version: smaller pictures, the vendor's name only. Pure. */
export function gridHtml(c, { name = '', compact = false } = {}) {
  const px = compact ? 36 : 64, label = name || 'this emoji', tiles = VENDORS.map((v) => {
    const files = filesOf(v, c), pic = v.font
      ? '<span class="lk-font" style="font-family:\'' + esc(v.font) + '\';font-size:' + Math.round(px * 0.8) + 'px;line-height:' + px + 'px" data-font="' + esc(v.font) + '">' + esc(c) + '</span>'
      : '<img src="' + esc(files[0]) + '" data-alt-src="' + esc(files.slice(1).join(' ')) + '" width="' + px + '" height="' + px + '" loading="lazy" decoding="async" referrerpolicy="no-referrer" alt="' + esc(c + ' ' + label + ' as ' + v.name + ' draws it') + '">';
    return '<li><button type="button" class="lk-tile" data-vendor="' + esc(v.id) + '" data-copy="' + esc(c) + '" title="' + esc('Copy ' + c + ' (' + v.name + ': ' + v.where + ')') + '">' + pic
      + '<span class="lk-name">' + esc(v.name) + '</span>' + (compact ? '' : '<span class="lk-where">' + esc(v.where) + '</span>') + '</button></li>';
  });
  tiles.push('<li><button type="button" class="lk-tile lk-own" data-vendor="device" data-copy="' + esc(c) + '" title="Copy it as this device draws it"><span class="lk-native" style="font-size:' + Math.round(px * 0.8) + 'px;line-height:' + px + 'px" role="img" aria-label="' + esc(c + ' ' + label + ' as this device draws it') + '">' + esc(c) + '</span><span class="lk-name">This device</span>' + (compact ? '' : '<span class="lk-where">your own phone or computer</span>') + '</button></li>');
  return '<ul class="lk-grid' + (compact ? ' lk-compact' : '') + '" aria-label="' + esc(c + ' ' + label + ' on ' + (VENDORS.length + 1) + ' platforms') + '">' + tiles.join('') + '</ul>';
}
export const LOOKS_CSS = '.lk-grid{list-style:none;margin:8px 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}'
  + '.lk-grid.lk-compact{grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:6px}'
  + '.lk-tile{all:unset;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:4px;width:100%;padding:10px 6px;border-radius:12px;border:1px solid var(--lk-line,#2a2a35);background:var(--lk-bg,#12111c);color:var(--lk-ink,#ecebf5);cursor:pointer;text-align:center}'
  + '.lk-compact .lk-tile{padding:6px 4px;gap:2px}'
  + '.lk-tile:hover,.lk-tile:focus-visible{border-color:#8b7bff;outline:none}'
  + '.lk-tile img{display:block;object-fit:contain}'
  + '.lk-name{font-size:13px;font-weight:600}.lk-compact .lk-name{font-size:11px;font-weight:500}'
  + '.lk-where{font-size:11px;opacity:.7;line-height:1.3}'
  + '.lk-tile.lk-none img{display:none}.lk-tile.lk-none::before{content:"not in this set";font-size:11px;opacity:.6;height:36px;display:flex;align-items:center}'
  + '.lk-light{--lk-bg:#f6f6fa;--lk-ink:#16151d;--lk-line:#d9d8e3}';

/** a drawn grid made live: a picture that fails tries the vendor's next file, then says the set has no such emoji; Noto mono's font is asked
 *  for only the characters shown; a tap copies the emoji (onCopy is told which vendor). Returns the element. */
export function wireGrid(el, { onCopy } = {}) {
  if (!el) return el;
  for (const img of el.querySelectorAll('img[data-alt-src]')) {
    img.addEventListener('error', () => {
      const rest = (img.dataset.altSrc || '').split(' ').filter(Boolean);
      if (rest.length) { img.dataset.altSrc = rest.slice(1).join(' '); img.src = rest[0]; } else { const b = img.closest('.lk-tile'); if (b) { b.classList.add('lk-none'); b.title = 'Not in this set'; } }
    });
  }
  const fonts = [...el.querySelectorAll('[data-font]')];
  if (fonts.length && typeof document !== 'undefined') {
    const text = [...new Set(fonts.map((f) => f.textContent).join(''))].join(''), id = 'lk-font-' + hexOf(text).slice(0, 60);
    if (!document.getElementById(id)) { const l = document.createElement('link'); l.id = id; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Noto+Emoji&display=swap&text=' + encodeURIComponent(text); document.head.appendChild(l); }
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.lk-tile'); if (!b || !el.contains(b)) return;
    copyText(b.dataset.copy).then((ok) => { if (onCopy) onCopy(b.dataset.vendor, ok, b); else flash(b, ok); });
  });
  return el;
}
/** copies text, with the old way when the clipboard API is not there; resolves true when it worked */
export function copyText(t) {
  const old = () => { try { const a = document.createElement('textarea'); a.value = t; a.setAttribute('readonly', ''); a.style.position = 'fixed'; a.style.opacity = '0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch (_) { return false; } };
  try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => old()); } catch (_) {}
  return Promise.resolve(old());
}
const flash = (b, ok) => { const n = b.querySelector('.lk-name'); if (!n) return; const was = n.textContent; n.textContent = ok ? 'Copied' : 'Copy failed'; setTimeout(() => { n.textContent = was; }, 1200); };
