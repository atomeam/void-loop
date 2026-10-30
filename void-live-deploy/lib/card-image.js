// The whole Verse card as one picture (owner, 2026-10-16: "the whole card, images and all" copyable and saved; cards will be printed).
// Drawn by us, not a screenshot of the page: cardSvg() builds a standalone SVG at the 63 x 88 mm card ratio (744 x 1039 px at 300 dpi; with
// bleed 3 mm = 35 px more on every side, 814 x 1109) holding the frame, title bar and cost, the art (lib/card-art.js), the type line, the first
// lines of the text, the Power / Resistance / Income plates, the collector number and the foil by rarity. toPng() renders it in the browser.
// Pure except toPng(). Every text field is escaped; nothing is fetched, so the picture never taints a canvas.
import { artSource } from './art-source.js';
import { artInner, rarityKey, RARITY_LOOK } from './card-art.js';
import { safeImg } from './art-rules.js';
import { qrSvg } from './qr.js';

export const CARD_W = 744, CARD_H = 1039, BLEED = 35;
const INK = '#0a0a10';
const GEM = { mythic: '#f0852d', rare: '#e3c15a', uncommon: '#c5ccd6', common: '#6b7280' };
const FOIL = { mythic: ['#ffb347', '#c4561a', '#ffd27a', '#b8430f'], rare: ['#f1dc8a', '#a98a2e', '#f6e7a6', '#8a6d1c'], uncommon: ['#e8edf4', '#8b95a3', '#dfe5ee', '#6f7886'], common: ['#5b6483', '#2c3350', '#5b6483', '#262c46'] };
const esc = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const num = (n) => (Number.isFinite(+n) && n !== null && n !== '' ? String(Math.max(0, Math.min(99, Math.round(+n)))) : '');

/** wrap text into lines of at most `cols` characters, at most `max` lines, the last ending in an ellipsis when cut. Pure. */
export function wrap(text, cols, max) {
  const lines = [];
  for (const para of String(text || '').replace(/\r/g, '').split(/\n+/)) {
    let line = '';
    for (const word of para.trim().split(/\s+/).filter(Boolean)) {
      const w = word.length > cols ? word.slice(0, cols - 1) + '\u2026' : word; // ellipsis-ok: drawn picture or short label, the full text is on the card
      if ((line + ' ' + w).trim().length > cols) { lines.push(line); line = w; } else line = (line + ' ' + w).trim();
    }
    if (line) lines.push(line);
  }
  if (lines.length > max) { const cut = lines.slice(0, max); cut[max - 1] = cut[max - 1].replace(/[\s.,;:…]*$/, '').slice(0, cols - 1) + '…'; return cut; } // ellipsis-ok: drawn picture or short label, the full text is on the card
  return lines;
}

/** the title as one line at the largest size that fits `avail` px, else as two lines at the largest size that fits: { lines, fs }. Never cut. Pure. */
export function fitTitle(title, avail) {
  const t = String(title || '').replace(/\s+/g, ' ').trim() || 'Verse', W = 0.6; // average glyph width in em for bold serif
  for (let fs = 38; fs >= 22; fs--) if (t.length * fs * W <= avail) return { lines: [t], fs };
  for (let fs = 28; fs >= 12; fs--) { const l = wrap(t, Math.floor(avail / (fs * W)), 99); if (l.length <= 2) return { lines: l, fs }; }
  // a long ask (owner, 2026-10-18: "make it show the whole ask"): it keeps its whole length, wrapped at a readable 16 px on as many lines as it needs
  // (the title bar grows: titleExtra, used by cardSvg); a card's title is at most TITLE_MAX (600) characters and ends at a whole sentence or word
  // (lib/card-share.js cutWhole), so 24 lines hold it at the narrowest bar (cost 9); only a longer title from elsewhere is stopped, at 24 lines
  return { lines: wrap(t, Math.floor(avail / (16 * W)), 24), fs: 16 };
}
/** how much taller the title bar must be for `lines` lines at `fs` px: nothing for one or two lines. Pure. */
export const titleExtra = (lines, fs) => (lines > 2 ? (lines - 2) * (fs + 3) : 0);

export const LONG_MIN_FS = 16;
/** a long answer's card (owner, 2026-10-17: "copy card should show the rest of the info, either make a long card or multiple"): the text at the
 * largest size from 23 down to LONG_MIN_FS that fits `h`; when even that is too long, every line at LONG_MIN_FS and `extra` px more card
 * below the art to hold them, so nothing is cut and nothing is too small to read. { lines, fs, lh, extra }. Pure. */
export function fitLong(text, h, w = 624) {
  for (let fs = 23; fs >= LONG_MIN_FS; fs--) { const lh = Math.round(fs * 1.25), l = wrap(text, Math.floor(w / (fs * 0.5)), 9999); if (l.length * lh <= h) return { lines: l, fs, lh, extra: 0 }; }
  const fs = LONG_MIN_FS, lh = Math.round(fs * 1.25), l = wrap(text, Math.floor(w / (fs * 0.5)), 9999);
  return { lines: l, fs, lh, extra: l.length * lh - h };
}
// The self card's picture (owner's redesign, 2026-10-18: the saved "What I think of myself" was a tall PNG holding every ask as raw lines, 16k
// characters). It has the live card's shape instead: Verse's own words as a quotation with an accent bar, "How sure I am of my skills" as a bar per
// family (the proven share; the weakest in amber), then each block's heading with its count and at most SELF_LINES lines. Nothing is a wall.
// `self` comes from the card on the page (lib/card-share.js selfImage): { voice, bars: [{ name, share, label, weak }], sections: [{ title, lines }] }.
export const SELF_LINES = 3, SELF_VOICE_LINES = 5;
/** the self card's text box laid out: { els: [{ k: 'text', x, y, text, fs, bold, italic, fill } | { k: 'rect', x, y, w, h, fill, rx }], height }. Pure. */
export function selfLayout(self, w = 624, soft = '#c9cfe8') {
  const els = [], S = self || {}, cols = (px, fs) => Math.max(8, Math.floor(px / (fs * 0.5)));
  let y = 0;
  const text = (str, x, fs, o = {}) => els.push({ k: 'text', x, y, text: str, fs, bold: !!o.bold, italic: !!o.italic, fill: o.fill || '#e6e1d3' });
  const voice = wrap(S.voice || '', cols(w - 22, 21), 9999); // every sentence, wrapped; the card grows (owner, 2026-10-22: no '...' anywhere)
  if (voice.length) {
    const top = y + 4;
    for (const l of voice) { y += 28; text(l, 20, 21, { italic: true, fill: '#f3efe2' }); }
    els.push({ k: 'rect', x: 0, y: top, w: 4, h: y - top + 8, fill: soft, rx: 2 });
    y += 12;
  }
  const bars = Array.isArray(S.bars) ? S.bars.slice(0, 16) : [];
  if (bars.length) {
    y += 22; text('How sure I am of my skills', 0, 18, { bold: true, fill: '#f3efe2' }); y += 6;
    const tx = 210, tw = w - tx - 64;
    for (const b of bars) {
      y += 18; const share = Math.max(0, Math.min(1, +b.share || 0));
      const nl = wrap(String(b.name || '') + (b.weak ? ' (weakest)' : ''), cols(tx - 12, 14), 99);
      nl.forEach((l, i) => { if (i) y += 16; text(l, 0, 14, { fill: b.weak ? '#ffd45e' : '#d8d4c6' }); });
      els.push({ k: 'rect', x: tx, y: y - 10, w: tw, h: 8, fill: b.weak ? 'rgba(255,176,0,.25)' : 'rgba(255,255,255,.12)', rx: 4, track: true });
      if (share > 0) els.push({ k: 'rect', x: tx, y: y - 10, w: Math.max(4, Math.round(tw * share)), h: 8, fill: b.weak ? '#ffb000' : soft, rx: 4 });
      text(String(b.label || '').replace(/ proven$/, '').replace(' of ', '/'), tx + tw + 10, 13, { fill: '#a9a69a' });
    }
    y += 14;
  }
  for (const sec of (Array.isArray(S.sections) ? S.sections : [])) {
    const head = wrap(sec.title || '', cols(w, 18 * 1.08), 99); head.forEach((l, i) => { y += i ? 21 : 24; text(l, 0, 18, { bold: true, fill: '#f3efe2' }); });
    const all = (sec.lines || []).filter(Boolean), shown = all.slice(0, SELF_LINES), rest = all.length - shown.length;
    if (rest > 0) shown.push('And ' + rest + ' more, every one of them in the saved text.');
    for (const l of shown) { wrap(l, cols(w - 22, 15), 9999).forEach((t, i) => { y += i ? 18 : 19; if (!i) text('\u2022', 4, 15, { fill: soft }); text(t, 22, 15); }); }
    y += 4;
  }
  return { els, height: y + 6 };
}

/** the text at the largest size (23 down to 11 px) whose wrapped lines fit `h` px of the text box: { lines, fs, lh }. Only text beyond even the smallest size is cut. Pure. */
export function fitText(text, h, w = 624) {
  for (let fs = 23; fs >= 11; fs--) { const lh = Math.round(fs * 1.25), l = wrap(text, Math.floor(w / (fs * 0.5)), 999); if (l.length * lh <= h) return { lines: l, fs, lh }; }
  const lh = 14, n = Math.floor(h / lh); return { lines: wrap(text, Math.floor(w / 5.5), n), fs: 11, lh };
}

/** the card as a standalone SVG string. data: { title, cost, typeLine, kind, rarity, hue, chapter, key, text, adds, power, toughness, income, number, tested, season, glyph, fetched }.
 *  bleed: true adds the 3 mm print bleed on every side. */
export function cardSvg(data = {}, { bleed = false } = {}) {
  const d = data || {}, rk = rarityKey(d.rarity), RL = RARITY_LOOK[rk], foil = FOIL[rk], b = bleed ? BLEED : 0;
  const title = String(d.title || d.name || 'Verse').replace(/\s+/g, ' ').trim();
  const cost = Math.max(0, Math.min(6, Math.round(+d.cost) || 0));
  const { lines: tl, fs } = fitTitle(title, 620 - cost * 24), T = titleExtra(tl.length, fs); // T: how much taller a long ask makes the title bar; everything below moves down by it
  const selfBox = d.self && typeof d.self === 'object' ? selfLayout(d.self) : null, box = selfBox ? { els: selfBox.els, extra: Math.max(0, selfBox.height - 246) } : fitLong(d.text, d.adds ? 172 : 246), X = box.extra, W = CARD_W + b * 2, H = CARD_H + X + T + b * 2; // X: a long card's extra height below the art
  const hue = Number.isFinite(+d.hue) ? Math.round(+d.hue) % 360 : 230, id = 'c' + rk[0];
  const edge = 'hsl(' + hue + ' 38% 48%)', dark = 'hsl(' + hue + ' 22% 8%)', mid = 'hsl(' + hue + ' 28% 20%)', soft = 'hsl(' + hue + ' 40% 78%)';
  let s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(title) + ' — Verse card">';
  s += '<defs><linearGradient id="' + id + 'f" x1="0" y1="0" x2="1" y2="1">' + foil.map((c, i) => '<stop offset="' + (i / (foil.length - 1)).toFixed(2) + '" stop-color="' + c + '"/>').join('') + '</linearGradient>';
  s += '<linearGradient id="' + id + 'p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(' + hue + ' 26% 15%)"/><stop offset="1" stop-color="' + dark + '"/></linearGradient>';
  s += '<linearGradient id="' + id + 's" x1="0" y1="0" x2="1" y2="1"><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="' + (rk === 'common' ? 0 : RL.a * 0.9) + '"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>';
  s += '<clipPath id="' + id + 'k"><rect width="' + W + '" height="' + H + '" rx="' + (bleed ? 0 : 34) + '"/></clipPath></defs>';
  s += '<g clip-path="url(#' + id + 'k)"><rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'f)"/><g transform="translate(' + b + ' ' + b + ')">';
  s += '<rect x="22" y="22" width="700" height="' + (995 + X + T) + '" rx="20" fill="url(#' + id + 'p)" stroke="' + INK + '" stroke-width="4"/><rect x="26" y="26" width="692" height="' + (987 + X + T) + '" rx="17" fill="none" stroke="' + edge + '" stroke-width="3"/>';
  // title bar
  s += '<rect x="40" y="44" width="664" height="' + (66 + T) + '" rx="14" fill="' + mid + '" stroke="' + edge + '" stroke-width="3"/>';
  // the whole title shows (owner, 2026-10-17: long titles were cut off with "..."): one line at the largest size that fits, else two lines that shrink
  tl.forEach((l, i) => { s += '<text x="62" y="' + (77 + T / 2 + (i - (tl.length - 1) / 2) * (fs + 3) + fs * 0.35) + '" font-family="Georgia,\'Times New Roman\',serif" font-weight="700" font-size="' + fs + '" fill="#f3efe2">' + esc(l) + '</text>'; });
  for (let i = 0; i < cost; i++) { const x = 684 - i * 24; s += '<path d="M' + x + ' ' + (68 + T / 2) + 'l9 10-9 10-9-10z" fill="' + soft + '" stroke="' + INK + '" stroke-width="2"/>'; }
  // everything below the title bar moves down by T
  s += '<g transform="translate(0 ' + T + ')">';
  // art
  const aw = 664, ah = 440;
  // the card's own picture (a poster, a still), already drawn small onto a canvas by photoData(): true colour, the plate over it as a light texture
  const photo = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(d.photo || '')) ? d.photo : '';
  const source = artSource({ photo, painting: d.painting && safeImg(d.art) }); // lib/art-source.js: the same rule as the page
  if (source === 'photo' && d.poster) {
    // a film's poster keeps its own portrait shape (owner, 2026-10-18), exactly as on the page: the poster at the left, drawn whole, with no plate, seal or texture over it, and the card's type words and new facts stacked to its right
    const pw = 293, tx = 40 + pw + 26, edgeC = edge;
    s += '<image x="40" y="122" width="' + pw + '" height="' + ah + '" preserveAspectRatio="xMidYMid meet" href="' + photo + '"/><rect x="40" y="122" width="' + pw + '" height="' + ah + '" fill="none" stroke="' + edgeC + '" stroke-width="3"/>';
    const tw = wrap(String(d.typeLine || d.kind || '').toUpperCase(), 17, 4), sb = wrap(String(d.sub || ''), 26, 5);
    tw.forEach((l, i) => { s += '<text x="' + tx + '" y="' + (160 + i * 34) + '" font-family="Georgia,serif" font-size="25" letter-spacing="2" fill="' + soft + '">' + esc(l) + '</text>'; });
    const y0 = 160 + tw.length * 34 + 14; if (sb.length) s += '<path d="M' + tx + ' ' + (y0 - 12) + 'h' + (704 - tx) + '" stroke="' + edge + '" stroke-width="1.5"/>';
    sb.forEach((l, i) => { s += '<text x="' + tx + '" y="' + (y0 + 20 + i * 28) + '" font-family="Georgia,serif" font-style="italic" font-size="22" fill="#e6e1d3">' + esc(l) + '</text>'; });
  } else if (source === 'painting') s += '<image x="40" y="122" width="' + aw + '" height="' + ah + '" preserveAspectRatio="xMidYMid slice" href="' + safeImg(d.art) + '"/>'; // a painting is the one picture: no plate or seal under it (lib/art-source.js)
  else if (source === 'photo') s += '<image x="40" y="122" width="' + aw + '" height="' + ah + '" preserveAspectRatio="xMidYMid slice" href="' + photo + '"/>'; // a real picture is the art: no plate, seal or texture over or under it (owner, 2026-10-18)
  else {
  s += '<svg x="40" y="122" width="' + aw + '" height="' + ah + '" viewBox="0 0 ' + aw + ' ' + ah + '"' + '' + '>' + artInner({ key: d.key || d.title || d.name, name: d.name || d.title, kind: d.kind || d.typeLine, chapter: d.chapter, hue, rarity: d.rarity, season: d.season, glyph: d.glyph, nouns: d.nouns }, { w: aw, h: ah }) + (safeImg(d.art) ? '<image href="' + safeImg(d.art) + '" x="0" y="0" width="' + aw + '" height="' + ah + '" preserveAspectRatio="xMidYMid slice"/>' : '') + '</svg>'; // the Art Forge's painted picture (lib/card-forge.js) over the plate when the card has one and no photo: a data URL only, so the canvas is never tainted
  }
  s += '<rect x="40" y="122" width="' + aw + '" height="' + ah + '" fill="none" stroke="' + edge + '" stroke-width="4"/>';
  // type line
  const type = String(d.typeLine || d.kind || '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 52);
  s += '<rect x="40" y="574" width="664" height="48" rx="10" fill="' + mid + '" stroke="' + edge + '" stroke-width="3"/><text x="60" y="606" font-family="Georgia,serif" font-size="22" letter-spacing="2" fill="' + soft + '">' + esc(type) + '</text>';
  s += '<path d="M676 598l11 11-11 11-11-11z" fill="' + GEM[rk] + '" stroke="' + INK + '" stroke-width="2.5"/>';
  // text box
  s += '<rect x="40" y="636" width="664" height="' + (262 + X) + '" rx="10" fill="hsl(' + hue + ' 22% 12%)" stroke="' + edge + '" stroke-width="2"/>';
  // the whole answer shows (owner, 2026-10-17: the last line drew over the box border and was cut): the text shrinks to fit, and a long one makes a long card
  if (box.els) box.els.forEach((e) => { s += e.k === 'rect' ? '<rect x="' + (60 + e.x) + '" y="' + (644 + e.y) + '" width="' + e.w + '" height="' + e.h + '" rx="' + (e.rx || 0) + '" fill="' + esc(e.fill) + '"/>'
    : '<text x="' + (60 + e.x) + '" y="' + (644 + e.y) + '" font-family="Georgia,\'Times New Roman\',serif" font-size="' + e.fs + '"' + (e.bold ? ' font-weight="700"' : '') + (e.italic ? ' font-style="italic"' : '') + ' fill="' + esc(e.fill) + '">' + esc(e.text) + '</text>'; }); // the self card (selfLayout)
  else box.lines.forEach((l, i) => { s += '<text x="60" y="' + (644 + box.fs + i * box.lh) + '" font-family="Georgia,\'Times New Roman\',serif" font-size="' + box.fs + '" fill="#e6e1d3">' + esc(l) + '</text>'; });
  if (d.adds) { const a = wrap('Adds to Verse: ' + d.adds, 58, 2); a.forEach((l, i) => { s += '<text x="60" y="' + (846 + X + i * 24) + '" font-family="Georgia,serif" font-style="italic" font-size="19" fill="' + soft + '">' + esc(l) + '</text>'; }); s += '<path d="M60 ' + (828 + X) + 'h624" stroke="' + edge + '" stroke-width="1.5"/>'; }
  // footer: collector number and the three plates
  const foot = [RL.name === 'Common' && !d.rarity ? '' : (d.rarity ? RL.name : ''), d.number, 'Verse', d.tested ? 'tested ' + d.tested : ''].filter(Boolean).join(' · ');
  const stats = [['P', d.power], ['R', d.toughness], ['I', d.income]].filter(([, v]) => num(v) !== '');
  // the line ends before the first plate: a long one ("MYTHIC · 294/440 · VERSE · TESTED 2026-10-24", ~570 px) is squeezed to fit, never run under it
  const FOOT = foot.toUpperCase().slice(0, 60), room = (stats.length ? 704 - stats.length * 74 - 14 : 700) - 44, wide = FOOT.length * 13.4 > room;
  s += '<text x="44" y="' + (990 + X) + '" font-family="Georgia,serif" font-size="17" letter-spacing="1.5"' + (wide ? ' textLength="' + room + '" lengthAdjust="spacingAndGlyphs"' : '') + ' fill="hsl(' + hue + ' 15% 62%)">' + esc(FOOT) + '</text>';
  stats.forEach(([k, v], i) => { const x = 704 - (stats.length - i) * 74; s += '<rect x="' + x + '" y="' + (926 + X) + '" width="68" height="66" rx="10" fill="' + mid + '" stroke="' + edge + '" stroke-width="3"/><text x="' + (x + 12) + '" y="' + (952 + X) + '" font-family="Georgia,serif" font-size="18" fill="' + soft + '">' + k + '</text><text x="' + (x + 34) + '" y="' + (980 + X) + '" font-family="Georgia,serif" font-weight="700" font-size="34" text-anchor="middle" fill="#f3efe2">' + esc(num(v)) + '</text>'; });
  s += '</g></g><rect width="' + W + '" height="' + H + '" fill="url(#' + id + 's)"/></g></svg>';
  return s;
}

/** a utility card's picture (data-card-plain, lib/card-frame.js): no foil, rarity, art or stats; the title, the card's own words and, when it has
 *  one, its QR code (lib/qr.js qrMatrix) at a size a phone can scan, on the plain dark page. data: { title, text, qr }. Every text field is escaped. Pure. */
export function plainSvg(data = {}) {
  const d = data || {}, W = CARD_W, P = 56, title = String(d.title || 'Verse').replace(/\s+/g, ' ').trim();
  const tl = wrap(title, 30, 3), body = wrap(d.text, 52, 40), q = d.qr && d.qr.modules ? d.qr : null, Q = q ? 300 : 0;
  let y = P + 44, s = '';
  tl.forEach((l) => { s += '<text x="' + P + '" y="' + y + '" font-family="ui-sans-serif,system-ui,\'Segoe UI\',Helvetica,Arial,sans-serif" font-weight="700" font-size="40" fill="#f2f4fa">' + esc(l) + '</text>'; y += 50; });
  y += 10;
  body.forEach((l) => { s += '<text x="' + P + '" y="' + y + '" font-family="ui-sans-serif,system-ui,\'Segoe UI\',Helvetica,Arial,sans-serif" font-size="23" fill="#d9dde8">' + esc(l) + '</text>'; y += 34; });
  if (q) {
    y += 10; const inner = qrSvg(q, { margin: 3, label: 'QR code' }).replace('<svg ', '<svg x="' + P + '" y="' + y + '" width="' + Q + '" height="' + Q + '" ');
    s += '<rect x="' + (P - 6) + '" y="' + (y - 6) + '" width="' + (Q + 12) + '" height="' + (Q + 12) + '" rx="14" fill="#fff"/>' + inner;
    s += '<text x="' + (P + Q + 28) + '" y="' + (y + Q / 2) + '" font-family="ui-sans-serif,system-ui,sans-serif" font-size="22" fill="#b9bfd0">Scan to open</text>';
    y += Q + 16;
  }
  const H = y + 64;
  s += '<text x="' + P + '" y="' + (H - 32) + '" font-family="ui-sans-serif,system-ui,sans-serif" font-size="17" letter-spacing="1.5" fill="#9aa1b5">Verse \u00b7 A-TO-MIND.COM</text>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + esc(title) + '"><rect width="' + W + '" height="' + H + '" rx="34" fill="#12152a"/><rect x="2" y="2" width="' + (W - 4) + '" height="' + (H - 4) + '" rx="32" fill="none" stroke="#2c3252" stroke-width="2"/>' + s + '</svg>';
}

/** the PNG of a card's SVG, in the browser: an Image and a canvas. Resolves a Blob; rejects when the browser cannot draw it. */
export function toPng(svg, scale = 1) {
  const m = /viewBox="0 0 (\d+) (\d+)"/.exec(svg) || [0, CARD_W, CARD_H], w = +m[1], h = +m[2];
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })), img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no png'))), 'image/png');
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('card image failed')); };
    img.src = url;
  });
}

/** where a picture of iw x ih goes in a w x h frame (owner, 2026-10-17: "it needs to center the card pictures better", a Sentry card whose
 *  tall figure lost its head to the crop). A near fit fills the frame, centred, a little high (faces sit near the top); one whose shape is
 *  far from the frame's would lose more than a quarter of itself, so it is shown whole and centred over a dimmed, blurred copy of itself
 *  that fills the frame (as music and photo apps do). { fill: {x,y,w,h}, whole: {x,y,w,h} | null }. Pure. */
export function picturePlan(iw, ih, w, h) {
  const cover = Math.max(w / iw, h / ih), contain = Math.min(w / iw, h / ih);
  const cw = iw * cover, ch = ih * cover, fill = { x: (w - cw) / 2, y: (h - ch) * 0.4, w: cw, h: ch };
  if ((w * h) / (cw * ch) >= 0.75) return { fill, whole: null }; // at most a quarter cropped away: fill the frame
  const ww = iw * contain, wh = ih * contain;
  return { fill: { ...fill, y: (h - ch) / 2 }, whole: { x: (w - ww) / 2, y: (h - wh) / 2, w: ww, h: wh } };
}

/** the card's picture as a small JPEG data URL for the saved image, or '' (browser only). Only the https image already on the card is loaded, with
 *  crossOrigin 'anonymous'; when the site refuses (no CORS), the image fails or the canvas is tainted, it resolves '' and the card falls back to its plate. Never throws. */
export function photoData(url, { w = 664, h = 440 } = {}) {
  return new Promise((resolve) => {
    try {
      if (!/^https:\/\//.test(String(url || ''))) return resolve('');
      const img = new Image(); img.crossOrigin = 'anonymous'; img.referrerPolicy = 'no-referrer';
      const t = setTimeout(() => resolve(''), 8000);
      img.onerror = () => { clearTimeout(t); resolve(''); };
      img.onload = () => {
        clearTimeout(t);
        try {
          const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
          const { fill, whole } = picturePlan(img.naturalWidth, img.naturalHeight, w, h);
          if (whole) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.filter ='blur(14px) brightness(0.45)'; g.drawImage(img, fill.x, fill.y, fill.w, fill.h); g.filter = 'none'; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, h); g.drawImage(img, whole.x, whole.y, whole.w, whole.h); }
          else g.drawImage(img, fill.x, fill.y, fill.w, fill.h);
          resolve(c.toDataURL('image/jpeg', 0.88)); // throws on a tainted canvas
        } catch (_) { resolve(''); }
      };
      img.src = url;
    } catch (_) { resolve(''); }
  });
}
