// /fanfic/'s pure half (owner, 2026-10-29: "build the page", the /fanfic/ spec; and, the same night, "a clean, dedicated fanfiction archive view
// that matches legacy layouts (like Sycophant Hex)", "deep space dark mode", "without raw board form fields", "zero seeded or fake stories").
// The archive is a way of reading and writing the anonymous boards (lib/boards.js, functions/api/boards/[[path]].js) with no endpoint of its own:
// a fandom is a board, a story is a thread, chapter 1 opens it, and a later chapter is a reply its author signs. The author's signature is the
// boards' own tripcode, made from a secret this device keeps (signedName), so nobody types tripcode syntax and nobody can post as another
// device's author. Posting goes through POST /api/boards and its bot check and rates, as any post does. Everything here is pure, so
// tools/fanfic.test.mjs runs it in node; the page is void-live-deploy/fanfic/.
import { LIMITS, codeProblem, cleanLine, excerpt } from './boards.js';

/** a board that belongs on /fanfic/: its code starts with fic (the archive's "Start a fandom" form makes it so), or its line says fan fiction. */
export const isFicBoard = (b) => !!b && (/^fic/.test(String(b.code || '')) || /\bfan ?fic(?:tion)?s?\b|\bfanfic/i.test(String(b.about || '') + ' ' + String(b.title || '')));

/** words in a text: runs of letters or digits, an apostrophe or hyphen inside a word keeps it one word; CJK characters count one each. */
export function words(s) {
  const t = String(s == null ? '' : s);
  const cjk = (t.match(/[぀-ヿ㐀-鿿가-힯]/g) || []).length;
  const rest = t.replace(/[぀-ヿ㐀-鿿가-힯]/g, ' ').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || [];
  return rest.length + cjk;
}
export const WPM = 230; // a usual adult silent-reading pace for fiction
/** minutes to read n words, rounded up; 0 for none. */
export const readMinutes = (n) => (n > 0 ? Math.max(1, Math.ceil(n / WPM)) : 0);
/** "about 4 min read", "under a minute", "nothing yet". */
export const readLabel = (n) => (n <= 0 ? 'nothing yet' : n < WPM / 2 ? 'under a minute' : 'about ' + readMinutes(n) + ' min read');

/** a story cut into posts the boards will take whole (LIMITS.body characters and LIMITS.lines lines each): at a blank line when it can, then at a
 *  line, then at a space, never in the middle of a word unless one word is longer than a post. [] for an empty text. */
export function splitParts(text, max = LIMITS.body, maxLines = LIMITS.lines) {
  const t = String(text == null ? '' : text).replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (!t) return [];
  const out = []; let rest = Array.from(t);
  while (rest.length) {
    let cut = Math.min(rest.length, max);
    const head = rest.slice(0, cut).join(''), nl = head.split('\n');
    if (nl.length > maxLines) cut = Array.from(nl.slice(0, maxLines).join('\n')).length;
    if (cut < rest.length) {
      const s = rest.slice(0, cut).join(''), at = [s.lastIndexOf('\n\n'), s.lastIndexOf('\n'), s.lastIndexOf(' ')].find((i) => i > cut * 0.4);
      if (at != null && at > 0) cut = Array.from(s.slice(0, at)).length;
    }
    const part = rest.slice(0, cut).join('').trim();
    if (part) out.push(part);
    rest = Array.from(rest.slice(cut).join('').replace(/^\s+/, ''));
  }
  return out;
}

/** a local calendar day as YYYY-MM-DD. */
export const dayOf = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
/** the writing streak: days in a row with words written, ending today, or yesterday when nothing is written yet today (the streak is still alive). */
export function streak(days, now = Date.now()) {
  const has = (t) => (days && days[dayOf(t)]) > 0;
  let t = now, n = 0;
  if (!has(t)) t -= 864e5;
  while (has(t) && n < 3660) { n++; t -= 864e5; }
  return n;
}
/** keep the last 400 days of the day-by-day word counts. */
export function trimDays(days, now = Date.now()) {
  const keep = {}, from = dayOf(now - 400 * 864e5);
  for (const [k, v] of Object.entries(days || {})) if (k >= from && v > 0) keep[k] = v;
  return keep;
}

export const PERIODS = Object.freeze({ all: 'All topics', today: 'Today', week: 'This week' });
/** topics whose last post falls in the period: today (since local midnight), this week (the last 7 days), or all. */
export function inPeriod(topics, period, now = Date.now()) {
  if (period === 'today') { const d = new Date(now); d.setHours(0, 0, 0, 0); return topics.filter((x) => (x.bumped || x.at) >= d.getTime()); }
  if (period === 'week') return topics.filter((x) => (x.bumped || x.at) >= now - 7 * 864e5);
  return topics.slice();
}
export const PER_PAGE = 20;
/** one page of a list: { items, page, pages } with the page held between 1 and the last. */
export function pageOf(list, page, per = PER_PAGE) {
  const pages = Math.max(1, Math.ceil(list.length / per)), p = Math.max(1, Math.min(pages, Math.floor(+page) || 1));
  return { items: list.slice((p - 1) * per, p * per), page: p, pages };
}

/** has a topic had a post since this device last read it (or since "Mark all read")? */
export const unread = (x, read) => (x.bumped || x.at) > Math.max((read && read.all) || 0, ((read && read.seen) || {})[x.board + '/' + x.no] || 0);

/** a draft as a link that holds the draft itself after the # (never sent to a server): base64url of UTF-8 JSON. */
export function shareHash(d) {
  const bytes = new TextEncoder().encode(JSON.stringify({ t: String(d.title || '').slice(0, 200), x: String(d.text || '') }));
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return 'room=' + btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const SHARE_MAX = 60000; // characters of link: past this some browsers and chat apps cut it, so the room offers the file instead
/** the draft in a #room= link, or null when it is not one or does not read. */
export function readShare(hash) {
  const m = /^#?room=([A-Za-z0-9_-]{1,200000})$/.exec(String(hash || ''));
  if (!m) return null;
  try {
    const bin = atob(m[1].replace(/-/g, '+').replace(/_/g, '/')), bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const o = JSON.parse(new TextDecoder().decode(bytes));
    return o && typeof o.x === 'string' ? { title: String(o.t || '').slice(0, 200), text: o.x.slice(0, 2e6) } : null;
  } catch (_) { return null; }
}

// Rec lists (sycophanthex.com keeps featured story lists): a reader's own list of stories they recommend, each with a one-line note on why. It is
// kept on this device and sent by a link that holds the list after the # (never sent to a server), so nothing is posted and no list is seeded.
// A story is its fandom's board code and its number; the title and writer are read from the boards when the list is opened.
export const RECS_LIMITS = Object.freeze({ items: 25, note: 140, name: 60 });
/** a rec list as the page keeps it: a name and up to 25 stories, each named once, with a one-line note. */
export function cleanRecs(r = {}) {
  const items = [], seen = new Set();
  for (const x of Array.isArray(r && r.items) ? r.items : []) {
    const f = String((x && x.f) || '').toLowerCase(), s = Math.floor(+(x && x.s));
    if (!/^[a-z0-9]{1,16}$/.test(f) || !(s > 0) || seen.has(f + '/' + s)) continue;
    seen.add(f + '/' + s); items.push({ f, s, note: cleanLine((x && x.note) || '', RECS_LIMITS.note) });
    if (items.length === RECS_LIMITS.items) break;
  }
  return { name: cleanLine((r && r.name) || '', RECS_LIMITS.name), items };
}
const b64 = (str) => { const bytes = new TextEncoder().encode(str); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
/** a rec list as the part of a link after the #: recs= and base64url of a short JSON form. */
export function recsHash(r) { const c = cleanRecs(r); return 'recs=' + b64(JSON.stringify({ n: c.name, i: c.items.map((x) => (x.note ? [x.f, x.s, x.note] : [x.f, x.s])) })); }
/** the rec list in a #recs= link, or null when it is not one or does not read. */
export function readRecs(hash) {
  const m = /^#?recs=([A-Za-z0-9_-]{1,20000})$/.exec(String(hash || ''));
  if (!m) return null;
  try { const o = JSON.parse(unb64(m[1])); return o && Array.isArray(o.i) ? cleanRecs({ name: o.n, items: o.i.map((x) => ({ f: x && x[0], s: x && x[1], note: x && x[2] })) }) : null; } catch (_) { return null; }
}
/** a rec list with a story added at the end (a story already there keeps its place), or taken out when drop is true. */
export function recsWith(r, f, s, drop = false) {
  const c = cleanRecs(r), key = String(f).toLowerCase() + '/' + Math.floor(+s), items = c.items.filter((x) => x.f + '/' + x.s !== key);
  return cleanRecs({ name: c.name, items: drop ? items : items.length < c.items.length ? c.items : [...c.items, { f, s }] });
}
/** a rec list with one story moved up (by -1) or down (by 1); the ends stay where they are. */
export function recsMoved(r, i, by) {
  const c = cleanRecs(r), j = i + by; if (i < 0 || j < 0 || i >= c.items.length || j >= c.items.length) return c;
  const items = c.items.slice(); [items[i], items[j]] = [items[j], items[i]]; return { ...c, items };
}

/** a file name for a draft: its title in lowercase words, or "story". */
export const fileName = (title) => (String(title || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'story') + '.txt';

// ---- a chapter from a file: a writer's story is in a document already, so the post form opens it (.txt, .md, .html, .docx) on this device ----
// Nothing is sent: the file is read here and its text goes into the form as plain text, where the writer sees it before posting. A .docx is a
// zip holding word/document.xml; the page unzips that one entry with the browser's own DecompressionStream (inflate is passed in, so node tests
// pass zlib's). Every size is capped, so a crafted file cannot grow into memory.
export const FILE_MAX = 4 * 1024 * 1024;  // bytes of file the form opens
export const TEXT_MAX = 400000;           // characters of text it takes from one
export const XML_MAX = 16 * 1024 * 1024;  // bytes a .docx's word/document.xml may unpack to
export const FILE_TYPES = '.txt,.md,.text,.htm,.html,.docx,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201c', rdquo: '\u201d' };
const deEntity = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''; }
  return ENTITIES[e.toLowerCase()] ?? m;
});
/** plain text with paragraphs at blank lines: spaces at the line ends gone, no more than one blank line in a row. Pure. */
const tidy = (s) => s.replace(/\r\n?/g, '\n').replace(/[ \t\u00a0]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, '').slice(0, TEXT_MAX);
/** an HTML page's text (a saved web page, or Google Docs' "Web page" download): a block ends a paragraph, <br> a line; scripts, styles and
 *  the head are dropped; no markup is kept. Pure. */
export function htmlText(html) {
  const s = String(html == null ? '' : html).replace(/<!--[\s\S]*?-->/g, '').replace(/<(head|script|style|template|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\b[^>]*>/gi, '\n').replace(/<\/?(p|div|h[1-6]|li|blockquote|section|article|tr|pre|hr)\b[^>]*>/gi, '\n\n').replace(/<[^>]*>/g, '');
  return tidy(deEntity(s).split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).join('\n'));
}
/** a Word document's text from its word/document.xml: each paragraph a paragraph, a line break a line, a tab a tab. Pure. */
export function docxText(xml) {
  const out = [];
  for (const p of String(xml == null ? '' : xml).split(/<\/w:p>/)) {
    let line = '';
    for (const m of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:(br|cr|tab)\b[^>]*\/>/g)) line += m[1] != null ? deEntity(m[1]) : m[2] === 'tab' ? '\t' : '\n';
    out.push(line);
  }
  return tidy(out.join('\n\n'));
}
/** one entry of a zip, as bytes, or null: read through the central directory (stored or deflated; inflate(bytes) is the caller's). */
export async function zipEntry(bytes, name, inflate) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let e = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) return null;
  const count = v.getUint16(e + 10, true); let at = v.getUint32(e + 16, true);
  for (let k = 0; k < count && at + 46 <= b.length; k++) {
    if (v.getUint32(at, true) !== 0x02014b50) return null;
    const method = v.getUint16(at + 10, true), size = v.getUint32(at + 20, true), full = v.getUint32(at + 24, true), nl = v.getUint16(at + 28, true);
    const xl = v.getUint16(at + 30, true), cl = v.getUint16(at + 32, true), local = v.getUint32(at + 42, true);
    if (new TextDecoder().decode(b.subarray(at + 46, at + 46 + nl)) === name) {
      if (full > XML_MAX || local + 30 > b.length || v.getUint32(local, true) !== 0x04034b50) return null;
      const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true), data = b.subarray(start, start + size);
      if (method === 0) return data; if (method === 8) return new Uint8Array(await inflate(data)); return null;
    }
    at += 46 + nl + xl + cl;
  }
  return null;
}
/** the text of a file the writer picked, or '' when it holds none this form can read. inflate is for a .docx. */
export async function fileText(name, bytes, inflate) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), ext = (/\.([a-z0-9]+)$/i.exec(String(name || '')) || [])[1] || '';
  if (b.length > FILE_MAX) return '';
  if (b[0] === 0x50 && b[1] === 0x4b) { // a zip: a .docx is the only one this form takes
    try { const x = await zipEntry(b, 'word/document.xml', inflate); return x ? docxText(new TextDecoder().decode(x)) : ''; } catch (_) { return ''; }
  }
  const t = new TextDecoder().decode(b).replace(/^\ufeff/, '');
  if (t.includes('\u0000')) return ''; // a binary file (an old .doc, a .pdf): no text to take
  return /^html?$/i.test(ext) || (!ext && /^\s*<(!doctype html|html)\b/i.test(t)) ? htmlText(t) : tidy(t);
}
/** a title from a file name: its words, with the type and dashes gone. Pure. */
export const titleOfFile = (name) => cleanLine(String(name || '').replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_-]+/g, ' '), 100);

/** the code for a new fandom's board: fic and the name's letters and digits, 10 at most, with a number on the end when that code is taken or
 *  not allowed. '' when no code is left (it never runs out in practice: 999 tries). */
export function ficCode(name, taken = new Set()) {
  const stem = ('fic' + String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')).slice(0, 10);
  if (!codeProblem(stem, taken)) return stem;
  for (let n = 2; n < 1000; n++) { const c = stem.slice(0, 10 - String(n).length) + n; if (!codeProblem(c, taken)) return c; }
  return '';
}

/** the fandom a typed name means: the fan-fiction board of that name when one is here (any case), else a new code for it. fic: the archive's
 *  fandoms ({ code, title }); taken: every board code on the site. { title, code, existing } or null when the name is blank or makes no code.
 *  The Start a fandom form and the post form's "A new fandom" both use it, so one name never opens two fandoms. */
export function fandomFor(name, fic = [], taken = new Set()) {
  const title = penName(name); if (!title) return null;
  const same = fic.find((b) => String(b.title || '').toLowerCase() === title.toLowerCase());
  if (same) return { title: same.title, code: same.code, existing: true };
  const code = ficCode(title, taken); return code ? { title, code, existing: false } : null;
}

/** a pen name as the archive shows it: one line, no # (the # would start a tripcode), at most the boards' name length; '' when blank. */
export const penName = (raw) => cleanLine(String(raw == null ? '' : raw).replace(/#/g, ''), LIMITS.name);
/** the name field the boards take: the pen name (or Anonymous) and, after #, this device's secret, so the server signs every post from this
 *  device with the same mark. The secret never shows; the visitor only ever types a pen name. */
export const signedName = (pen, secret) => (penName(pen) || 'Anonymous') + (secret ? '#' + secret : '');

// story details (owner, 2026-10-29: the archive must beat sycophanthex.com's catalog, which browses by rating, genre, character and warning): one
// line each above the summary on chapter 1's post ("Rated: Teen", "Genres: Romance, Mystery", "Characters: …", "Warnings: …"), so the boards
// and /boards/ show them as plain text and the archive reads them back into its filters. A story posted before them simply has none.
export const RATINGS = Object.freeze([['General', 'fine for every reader'], ['Teen', 'some violence, strong words or romance'], ['Mature', 'strong themes, for adult readers']]);
export const GENRES = Object.freeze(['Adventure', 'Angst', 'Comedy', 'Drama', 'Family', 'Fantasy', 'Fluff', 'Friendship', 'Horror', 'Hurt/Comfort', 'Mystery', 'Poetry', 'Romance', 'Sci-fi', 'Tragedy']);
export const WARNINGS = Object.freeze(['Violence', 'Major character death', 'Strong language', 'Dark themes']);
// a story's status (sycophanthex.com marks each story completed or in progress): the author says it on chapter 1 ("Status: In progress", or
// "Complete" for a one-shot), and a later chapter that ends the story says "Status: Complete" under its chapter line (chapterPosts done)
export const STATUSES = Object.freeze(['In progress', 'Complete']);
export const DETAIL_LIMITS = Object.freeze({ genres: 3, characters: 6, name: 40, line: 136, part: 999 }); // 136: with a status, the longest detail lines still fit the catalog's 300
// a series (sycophanthex.com groups a writer's stories into series): a name of at most 40 characters and this story's part in it, 1 to 999. The
// series line is written first and takes its length from the characters' 136, so every detail line still fits the catalog's 300.
const seriesLine = (name, part) => (name && part ? 'Series: ' + name + ', part ' + part + '\n' : '');
// the known names in list (an array or a comma list), the first max given, in all's order
const pick = (list, all, max) => {
  const got = [];
  for (const x of Array.isArray(list) ? list : String(list || '').split(',')) { const k = all.find((a) => a.toLowerCase() === String(x).trim().toLowerCase()); if (k && !got.includes(k) && got.length < max) got.push(k); }
  return all.filter((a) => got.includes(a));
};
/** details as the archive keeps them: a known rating or '', known genres (at most 3) and warnings in the lists' order, and at most 6 character
 *  names, each one line of at most 40 characters and 136 in all, the first spelling of a name kept once. Pure. */
export function cleanDetails(d = {}) {
  const r = RATINGS.find(([n]) => n.toLowerCase() === String(d.rating || '').trim().toLowerCase()), seen = new Set(), characters = [];
  const pn = Math.floor(+d.part), series = cleanLine(String(d.series || '').replace(/, part \d+$/i, ''), DETAIL_LIMITS.name).replace(/^[\s,]+|[\s,]+$/g, ''), part = series && pn >= 1 && pn <= DETAIL_LIMITS.part ? pn : 0;
  const room = DETAIL_LIMITS.line - seriesLine(part ? series : '', part).length;
  for (const raw of Array.isArray(d.characters) ? d.characters : String(d.characters || '').split(',')) {
    const c = cleanLine(String(raw).replace(/,/g, ' '), DETAIL_LIMITS.name), k = c.toLowerCase();
    if (c && !seen.has(k) && characters.length < DETAIL_LIMITS.characters && [...characters, c].join(', ').length <= room) { seen.add(k); characters.push(c); }
  }
  const st = STATUSES.find((x) => x.toLowerCase() === String(d.status || '').trim().toLowerCase()) || '';
  return { rating: r ? r[0] : '', genres: pick(d.genres, GENRES, DETAIL_LIMITS.genres), characters, warnings: pick(d.warnings, WARNINGS, WARNINGS.length), status: st, series: part ? series : '', part };
}
/** the detail lines chapter 1 opens with, each "Label: value" and a newline; '' for a story with none. The rating comes last, so in a board's
 *  catalog, where a post is one line of at most 300 characters, the free-text character names end at a label; the lines fit in 300. Pure. */
export function detailLines(d) {
  const c = cleanDetails(d);
  return seriesLine(c.series, c.part) + (c.status ? 'Status: ' + c.status + '\n' : '') + (c.warnings.length ? 'Warnings: ' + c.warnings.join(', ') + '\n' : '') + (c.genres.length ? 'Genres: ' + c.genres.join(', ') + '\n' : '')
    + (c.characters.length ? 'Characters: ' + c.characters.join(', ') + '\n' : '') + (c.rating ? 'Rated: ' + c.rating + '\n' : '');
}
const DETAIL_RE = /^(Series|Status|Rated|Genres|Characters|Warnings): ([^\n]{1,300})\n/;
const listRe = (all) => new RegExp('^((?:' + all.map((x) => x.replace(/[/-]/g, '\\$&')).join('|') + ')(?:, (?:' + all.map((x) => x.replace(/[/-]/g, '\\$&')).join('|') + '))*)(?= |$)');
const FLAT = { Status: listRe(STATUSES), Rated: listRe(RATINGS.map(([n]) => n)), Genres: listRe(GENRES), Warnings: listRe(WARNINGS) };
// the details at the head of a catalog excerpt (newlines made spaces): known words for a rating, genres and warnings; the names up to the next label
function flatDetails(b) {
  const raw = {}; let m;
  while ((m = /^(Series|Status|Rated|Genres|Characters|Warnings): /.exec(b)) && !raw[m[1]]) {
    const rest = b.slice(m[0].length);
    if (m[1] === 'Series') { const v = /^(.{1,40}?, part \d{1,3})(?= |$)/.exec(rest); if (!v) break; raw.Series = v[1]; b = rest.slice(v[1].length).replace(/^ /, ''); continue; }
    if (m[1] === 'Characters') { const n = / (?=(?:Series|Status|Rated|Genres|Warnings|Summary): )/.exec(rest); if (!n) break; raw.Characters = rest.slice(0, n.index); b = rest.slice(n.index + 1); continue; }
    const v = FLAT[m[1]].exec(rest); if (!v) break; raw[m[1]] = v[1]; b = rest.slice(v[1].length).replace(/^ /, '');
  }
  return { raw, b };
}
const SUMMARY_RE = /^Summary: ([^\n]{1,300})\n\n?/;
export const SUMMARY_MAX = 300;
/** chapter 1's text with its details and its summary on first lines of their own ("Rated: Teen", …, "Summary: ..."), the way the archive reads it back. */
export const withSummary = (summary, text, details = null) => { const s = cleanLine(summary, SUMMARY_MAX), d = details ? detailLines(details) : '';
  const t = String(text == null ? '' : text).trim(); return d + (s ? 'Summary: ' + s + '\n\n' : d ? '\n' : '') + t; };
/** { summary, text, details } from chapter 1's post. */
export function readSummary(body) {
  let b = String(body == null ? '' : body), m; const raw = {};
  while ((m = DETAIL_RE.exec(b)) && !raw[m[1]]) { raw[m[1]] = m[2]; b = b.slice(m[0].length); }
  if (!Object.keys(raw).length && !b.includes('\n')) { const f = flatDetails(b); Object.assign(raw, f.raw); b = f.b; }
  const sm = /^(.+), part (\d{1,3})$/.exec(raw.Series || '');
  const details = cleanDetails({ rating: raw.Rated, genres: raw.Genres, characters: raw.Characters, warnings: raw.Warnings, status: raw.Status, series: sm ? sm[1] : '', part: sm ? sm[2] : 0 });
  if (Object.keys(raw).length && !SUMMARY_RE.test(b)) b = b.replace(/^\n/, '');
  m = SUMMARY_RE.exec(b); return m ? { summary: m[1].trim(), text: b.slice(m[0].length), details } : { summary: '', text: b, details };
}

const CHAPTER_RE = /^Chapter (\d{1,4})(?:: ([^\n]{0,100})|(, continued))?\n\n?/;
/** the first line of a chapter's post: "Chapter 3: Title", or "Chapter 3, continued" on the posts that carry the rest of a long chapter. */
export const chapterHead = (n, title = '', more = false) => 'Chapter ' + n + (more ? ', continued' : cleanLine(title, 100) ? ': ' + cleanLine(title, 100) : '') + '\n\n';
const DONE_RE = /^Status: Complete\n\n?/;
/** { n, title, more, done, text } when a post opens with a chapter line, else null; done when the chapter's first post says it ends the story. */
export function readChapter(body) {
  const b = String(body == null ? '' : body), m = CHAPTER_RE.exec(b);
  if (!m) return null;
  const rest = b.slice(m[0].length), d = !m[3] && DONE_RE.exec(rest);
  return { n: +m[1], title: (m[2] || '').trim(), more: !!m[3], done: !!d, text: d ? rest.slice(d[0].length) : rest };
}
/** a review can give the story 1 to 5 stars: its post then opens "Stars: n of 5" and a blank line. Pure. */
const STARS_RE = /^Stars: ([1-5]) of 5\n\n?/;
export function reviewBody(text, stars = 0) { const n = Math.round(+stars); return (n >= 1 && n <= 5 ? 'Stars: ' + n + ' of 5\n\n' : '') + String(text == null ? '' : text); }
/** { stars, text }: stars 0 when the review gives none. Pure. */
export function readReview(body) { const b = String(body == null ? '' : body), m = STARS_RE.exec(b); return m ? { stars: +m[1], text: b.slice(m[0].length) } : { stars: 0, text: b }; }
/** the stars the reviews give: { avg, n }, avg to one decimal, n the reviews that gave stars; { avg: 0, n: 0 } when none did. Pure. */
export function starsOf(reviews = []) {
  const got = reviews.map((p) => readReview(p && p.body).stars).filter(Boolean);
  return got.length ? { avg: Math.round((got.reduce((a, b) => a + b, 0) / got.length) * 10) / 10, n: got.length } : { avg: 0, n: 0 };
}
/** a chapter's text as the posts the boards will take whole, each with its chapter line: the first "Chapter n: title", the rest ", continued".
 *  Chapter 1 has no line on its first post (it opens the thread, after the summary). */
export function chapterPosts(n, title, text, summary = '', details = null, done = false) {
  const first = n === 1 ? withSummary(summary, '', details) : chapterHead(n, title) + (done ? 'Status: Complete\n\n' : ''), more = chapterHead(n, '', true);
  const room = LIMITS.body - Math.max(Array.from(first).length, Array.from(more).length), lines = LIMITS.lines - Math.max(first.split('\n').length, more.split('\n').length);
  return splitParts(text, room, lines).map((p, i) => (i === 0 ? first : more) + p);
}

/** a story out of a thread: the opening post is chapter 1; a reply signed with the opening post's mark and opening with a chapter line is the
 *  author's (a new chapter, or more of one); every other reply is a review. Unsigned stories (posted on /boards/ without a mark) have chapter 1
 *  only. { title, author, trip, summary, chapters: [{ n, title, text, at, nos }], reviews, stars: { avg, n }, words, published, updated } */
export function storyOf(op, posts = []) {
  const { summary, text, details } = readSummary(op.body);
  const chapters = [{ n: 1, title: '', text, at: op.at, nos: [op.no] }], reviews = [];
  let done = details.status === 'Complete';
  for (const p of posts) {
    if (!p || p.no === op.no || p.hidden) continue;
    const c = op.trip && p.trip === op.trip ? readChapter(p.body) : null;
    if (!c) { reviews.push(p); continue; }
    const last = chapters[chapters.length - 1];
    if (c.more && last.n === c.n) { last.text += '\n\n' + c.text; last.nos.push(p.no); continue; }
    if (c.more) { reviews.push(p); continue; }
    chapters.push({ n: chapters.length + 1, title: c.title, text: c.text, at: p.at, nos: [p.no] });
    if (c.done) done = true;
  }
  const updated = chapters.reduce((t, c) => Math.max(t, c.at || 0), op.at || 0);
  if (done) details.status = 'Complete';
  return { title: op.sub || excerpt(text, 60) || 'Untitled', author: op.name || 'Anonymous', trip: op.trip || '', summary, details, chapters, reviews, stars: starsOf(reviews.filter((p) => !op.trip || p.trip !== op.trip)),
    words: chapters.reduce((n, c) => n + words(c.text), 0), published: op.at || 0, updated };
}

/** a story's own figures for its catalog row, from storyOf: chapters and words always, then reviews, the stars readers gave and its hits
 *  (counted reads, /api/fanfic-hits) when it has any. Read from the whole thread: the catalog holds only the opening post, cut short, so a
 *  row never guesses them from that. A story no one has read shows no hits, never a made-up number. Pure. */
export function rowFigures(s, hits = 0) {
  const n = (k, one, many) => k.toLocaleString() + ' ' + (k === 1 ? one : many);
  const out = [n(s.chapters.length, 'chapter', 'chapters'), n(s.words, 'word', 'words')];
  if (s.reviews.length) out.push(n(s.reviews.length, 'review', 'reviews'));
  if (s.stars && s.stars.n) out.push('★ ' + s.stars.avg);
  if (hits > 0) out.push(n(Math.floor(hits), 'hit', 'hits'));
  return out;
}

/** a topic row for the archive's lists, from a thread in a board's catalog. */
export function topicOf(t, board) {
  const { summary, text, details } = readSummary(t.body);
  return { board: board.code, fandom: board.title, nsfw: !!board.nsfw, no: t.no, title: t.sub || excerpt(text, 60) || 'Untitled', author: t.name || 'Anonymous',
    trip: t.trip || '', summary: summary || excerpt(text, 160), replies: t.replies || 0, at: t.at || 0, bumped: t.bumped || t.at || 0, locked: !!t.locked, ...details };
}

/** one author's key: the pen name, and its mark after a ! when it has one, so two writers with the same pen name stay apart. Pure. */
export const authorKey = (t) => (t.author || 'Anonymous') + (t.trip ? '!' + t.trip : '');
/** the archive's authors A to Z (case and accents ignored), each with its key, pen name, mark, how many stories and its newest post. Pure. */
export function authorsOf(topics) {
  const by = new Map();
  for (const t of topics || []) {
    const k = authorKey(t), a = by.get(k) || { key: k, author: t.author || 'Anonymous', trip: t.trip || '', stories: 0, last: 0 };
    a.stories += 1; a.last = Math.max(a.last, t.bumped || t.at || 0); by.set(k, a);
  }
  return [...by.values()].sort((a, b) => byTitle(a.author).localeCompare(byTitle(b.author)) || a.trip.localeCompare(b.trip));
}
/** one series' key: its writer's key, a ~ and the series name folded, so a name two writers use stays two series; '' for a story in none. Pure. */
export const seriesKey = (t) => (t && t.series && t.part ? authorKey(t) + '~' + fold(t.series).trim() : '');
/** the archive's series A to Z: each with its key, name (the first spelling), writer, mark, how many parts are posted and the newest post. Pure. */
export function seriesOf(topics) {
  const by = new Map();
  for (const t of topics || []) {
    const k = seriesKey(t); if (!k) continue;
    const s = by.get(k) || { key: k, name: t.series, author: t.author || 'Anonymous', trip: t.trip || '', parts: 0, last: 0 };
    s.parts += 1; s.last = Math.max(s.last, t.bumped || t.at || 0); by.set(k, s);
  }
  return [...by.values()].sort((a, b) => byTitle(a.name).localeCompare(byTitle(b.name)) || byTitle(a.author).localeCompare(byTitle(b.author)));
}
/** a series' stories in part order (then oldest first). Pure, and stable. */
export const inPartOrder = (list) => (list || []).map((t, i) => [t, i]).sort((x, y) => (x[0].part || 0) - (y[0].part || 0) || (x[0].at || 0) - (y[0].at || 0) || x[1] - y[1]).map((x) => x[0]);
/** one story picked at random from the list, or null for an empty list. rand is Math.random by default, so a test can fix it. Pure apart from rand. */
/** the archive home's featured story, with why it was picked, from what every catalog row already says (no extra reads): never an 18+ or a
 *  locked story; a complete story first, then the most replies (the Replies column: its later chapters and its reviews), then the newest post. null with no story. Pure. */
export function featuredOf(topics) {
  const ok = (topics || []).filter((t) => t && !t.nsfw && !t.locked);
  if (!ok.length) return null;
  const done = ok.filter((t) => t.status === 'Complete'), pool = done.length ? done : ok;
  const t = pool.reduce((a, b) => ((b.replies || 0) > (a.replies || 0) || ((b.replies || 0) === (a.replies || 0) && (b.bumped || 0) > (a.bumped || 0)) ? b : a));
  return { t, why: (done.length ? 'The complete story' : 'The story') + ' with the most replies' + (t.replies ? '' : ' (none have replies yet, so the newest)') + '.' };
}
export const randomOf = (list, rand = Math.random) => (list && list.length ? list[Math.min(list.length - 1, Math.floor(rand() * list.length))] : null);

// writing challenges (sycophanthex.com runs writing contests): a challenge is a thread in a fandom whose first post opens "Writing challenge", then
// "Closes: YYYY-MM-DD" when it has a last day, then the prompt. A story answers it with a reply in the challenge's thread, "Entry: <fandom>/<story>",
// signed with the story's own mark, so only a story's writer can enter it; an entry posted after the last day does not count. A challenge is not
// a story: the archive keeps challenge threads off its story lists.
export const CHALLENGE_LIMITS = Object.freeze({ title: 100, prompt: 2000 });
const CHALLENGE_RE = /^Writing challenge(?:\n|[ ]|$)(?:Closes: (\d{4}-\d{2}-\d{2})(?:\n|[ ]|$))?\n?/;
const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
/** a challenge's first post: its marker line, its last day when it has one (a real YYYY-MM-DD), a blank line, the prompt. Pure. */
export const challengeBody = (prompt, closes = '') => 'Writing challenge\n' + (isDay(closes) ? 'Closes: ' + closes + '\n' : '') + '\n' + String(prompt == null ? '' : prompt).trim().slice(0, CHALLENGE_LIMITS.prompt);
/** { closes, prompt } from a challenge's first post, whole or as a catalog's one-line excerpt; null for any other post. Pure. */
export function readChallenge(body) {
  const b = String(body == null ? '' : body), m = CHALLENGE_RE.exec(b);
  if (!m) return null;
  return { closes: m[1] && isDay(m[1]) ? m[1] : '', prompt: b.slice(m[0].length).trim() };
}
/** open until the end of its last day on this device's calendar, or always when it has none. Pure apart from now. */
export const challengeOpen = (c, now = Date.now()) => !c || !c.closes || dayOf(now) <= c.closes;
/** a challenge row for the archive's list, from a thread in a board's catalog; null when the thread is not a challenge. Pure. */
export function challengeOf(t, board) {
  const c = readChallenge(t && t.body); if (!c) return null;
  return { board: board.code, fandom: board.title, nsfw: !!board.nsfw, no: t.no, title: t.sub || excerpt(c.prompt, 60) || 'Untitled challenge', author: t.name || 'Anonymous',
    trip: t.trip || '', prompt: excerpt(c.prompt, 160), closes: c.closes, replies: t.replies || 0, at: t.at || 0, bumped: t.bumped || t.at || 0, locked: !!t.locked };
}
/** the reply that enters a story in a challenge. Pure. */
export const entryBody = (board, no) => 'Entry: ' + board + '/' + no;
const ENTRY_RE = /^Entry: ([a-z0-9]{1,16})\/(\d{1,9})$/;
/** { board, no } from an entry reply, else null. Pure. */
export function readEntry(body) { const m = ENTRY_RE.exec(String(body == null ? '' : body).trim()); return m ? { board: m[1], no: +m[2] } : null; }
/** a challenge's entries: from the replies in its thread, each story once, in the order entered, only when the reply carries the story's own mark
 *  and went up by the challenge's last day; each is the story's topic with entered (the reply's time). topics are the archive's stories. Pure. */
export function entriesOf(posts, topics, closes = '') {
  const by = new Map((topics || []).map((t) => [t.board + '/' + t.no, t])), seen = new Set(), out = [];
  for (const p of posts || []) {
    const e = p && !p.hidden && readEntry(p.body); if (!e) continue;
    const k = e.board + '/' + e.no, t = by.get(k);
    if (!t || seen.has(k) || !t.trip || p.trip !== t.trip || (closes && dayOf(p.at || 0) > closes)) continue;
    seen.add(k); out.push({ ...t, entered: p.at || 0 });
  }
  return out;
}
/** the reply that names a challenge's winner. Pure. */
export const winnerBody = (board, no) => 'Winner: ' + board + '/' + no;
const WINNER_RE = /^Winner: ([a-z0-9]{1,16})\/(\d{1,9})$/;
/** a challenge's winners, first place first: replies that name an entry, signed with the mark of the one who set the challenge (a challenge set
 *  with no mark has no winners), posted after its last day when it has one; each entry once, at most 3. entries are entriesOf's. Pure. */
export function winnersOf(posts, entries, setterTrip, closes = '') {
  if (!setterTrip) return [];
  const by = new Map((entries || []).map((t) => [t.board + '/' + t.no, t])), out = [];
  for (const p of posts || []) {
    const m = p && !p.hidden && p.trip === setterTrip && WINNER_RE.exec(String(p.body || '').trim()); if (!m) continue;
    const t = by.get(m[1] + '/' + m[2]);
    if (!t || out.includes(t) || (closes && dayOf(p.at || 0) <= closes)) continue;
    out.push(t); if (out.length === 3) break;
  }
  return out;
}

/** the stories a later chapter finished, from the boards' search for "status complete" (posts with board, thread, trip, body): a hit counts only
 *  when it is a chapter's first post that says it ends the story, in that story's thread, signed with the story's own mark. Returns the topics
 *  with status 'Complete' where a hit finished them; the rest unchanged. Pure. */
const FLAT_DONE_RE = /^Chapter \d{1,4}(?:: [^\n]{0,100}?)? Status: Complete(?: |$)/;
export function finishedLater(topics, hits) {
  const done = new Set();
  for (const h of hits || []) {
    if (!h || !h.trip) continue;
    const c = readChapter(h.body), flat = FLAT_DONE_RE.test(String(h.body || '')); // search results come as one-line excerpts
    if ((c && c.done && !c.more) || (!c && flat)) done.add(h.board + '/' + h.thread + '!' + h.trip);
  }
  return (topics || []).map((t) => (t.status !== 'Complete' && t.trip && done.has(t.board + '/' + t.no + '!' + t.trip) ? { ...t, status: 'Complete' } : t));
}

/** the archive's numbers, all counted from what is there: fandoms, stories, posts, and authors (a pen name and its mark count once). */
export function statsOf(boards, topics) {
  const authors = new Set(topics.map((t) => t.author + '!' + t.trip));
  return { fandoms: boards.length, stories: topics.length, posts: topics.reduce((n, t) => n + 1 + (t.replies || 0), 0), authors: authors.size };
}

/** a random secret for this device: 16 bytes as hex. */
export function newSecret(rand = (n) => crypto.getRandomValues(new Uint8Array(n))) { return [...rand(16)].map((x) => x.toString(16).padStart(2, '0')).join(''); }

const fold = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** the stories whose title, fandom or author holds every word of q (case and accents ignored); all of them for an empty q. Pure. */
export function findIn(topics, q) {
  const want = fold(q).split(/\s+/).filter(Boolean); if (!want.length) return topics;
  return topics.filter((t) => { const hay = fold(t.title + ' ' + t.fandom + ' ' + t.author); return want.every((w) => hay.includes(w)); });
}

/** the story list as CSV (a header row, then one row a story), for a spreadsheet: title, fandom, author, replies, rating, last post, link. Pure. */
export function storiesCsv(topics, origin = '') {
  const cell = (v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? '"' + (/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""') + '"' : s; };
  const rows = [['Title', 'Fandom', 'Author', 'Replies', 'Rating', 'Last post', 'Link']].concat((topics || []).map((t) => [t.title, t.fandom, t.author, t.replies || 0,
    t.nsfw ? '18+' : 'All ages', t.bumped ? new Date(t.bumped).toISOString() : '', origin + '/fanfic/?f=' + encodeURIComponent(t.board) + '&s=' + t.no]));
  return rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

// the archive's feed (sycophanthex.com lists its most recent stories and offers them by feed): /fanfic/rss, functions/fanfic/rss.js. The newest
// stories first, at most `max`, adult fandoms' stories left out (a feed reader asks nobody whether they are 18), each item linking its story page.
const xml = (s) => String(s == null ? '' : s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
/** the stories as an RSS 2.0 document, newest post first. An empty list is a channel with no items. Pure. */
export function storiesRss(topics, origin = '', max = 50) {
  const list = (topics || []).filter((t) => !t.nsfw).slice().sort((a, b) => (b.bumped || b.at || 0) - (a.bumped || a.at || 0)).slice(0, max);
  const items = list.map((t) => {
    const link = origin + '/fanfic/?f=' + encodeURIComponent(t.board) + '&s=' + t.no, when = t.bumped || t.at;
    return '<item><title>' + xml(t.title + ' (' + t.fandom + ')') + '</title><link>' + xml(link) + '</link><guid isPermaLink="false">' + xml(t.board + '/' + t.no) + '</guid>'
      + (when ? '<pubDate>' + new Date(when).toUTCString() + '</pubDate>' : '') + '<dc:creator>' + xml(t.author || 'Anonymous') + '</dc:creator><description>' + xml(t.summary || '') + '</description></item>';
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Fan fiction · Verse</title><link>' + xml(origin + '/fanfic/')
    + '</link><description>The newest stories in Verse\'s open fan fiction archive, every fandom.</description><language>en</language>' + items + '</channel></rss>';
}

// the catalog's filters and sorts (sycophanthex.com browses by rating, genre, character and warning, and lists titles A to Z or most recent):
// they combine, and the page keeps them in its address so a filtered list can be shared
export const SORTS = Object.freeze({ recent: 'Most recent post', newest: 'Newest stories', title: 'Title, A to Z', replies: 'Most replies' });
/** the A to Z index letter of a title: its first letter, accents dropped, or '#' for anything else. Pure. */
export const letterOf = (title) => { const c = byTitle(title).charAt(0).toUpperCase(); return /^[A-Z]$/.test(c) ? c : '#'; };
/** the stories that pass every filter given: a rating, every genre asked for, every character name asked for (part of a name is enough, case and
 *  accents ignored), no warnings when noWarnings, and a title letter. Empty filters pass everything. Pure. */
export function filterStories(topics, { rating = '', genres = [], characters = '', noWarnings = false, letter = '', by = '', status = '', series = '' } = {}) {
  const g = pick(genres, GENRES, GENRES.length), names = String(characters || '').split(',').map(fold).map((x) => x.trim()).filter(Boolean), L = String(letter || '').toUpperCase();
  return (topics || []).filter((t) => (!by || authorKey(t) === by) && (!series || seriesKey(t) === series) && (!status || t.status === status) && (!rating || t.rating === rating) && g.every((x) => (t.genres || []).includes(x))
    && names.every((n) => (t.characters || []).some((c) => fold(c).includes(n))) && (!noWarnings || !(t.warnings || []).length) && (!L || letterOf(t.title) === L));
}
const byTitle = (t) => fold(t).replace(/^[^\p{L}\p{N}]+/u, '');
/** the stories in a sort's order (SORTS); an unknown sort keeps the most recent post first. Pure, and stable. */
export function sortStories(topics, sort = 'recent') {
  const by = { newest: (a, b) => (b.at || 0) - (a.at || 0), title: (a, b) => byTitle(a.title).localeCompare(byTitle(b.title)), replies: (a, b) => (b.replies || 0) - (a.replies || 0) }[sort]
    || ((a, b) => (b.bumped || b.at || 0) - (a.bumped || a.at || 0));
  return (topics || []).map((t, i) => [t, i]).sort((x, y) => by(x[0], y[0]) || x[1] - y[1]).map((x) => x[0]);
}
/** the details of a story as one line for its row and its page: "Rated Teen · Romance, Mystery · Characters: … · Warnings: …"; '' for none. Pure. */
export function detailsLine(d) {
  const c = cleanDetails(d || {});
  return [c.part ? 'Part ' + c.part + ' of ' + c.series : '', c.status, c.warnings.length ? 'Warnings: ' + c.warnings.join(', ') : '', c.rating ? 'Rated ' + c.rating : '', c.genres.join(', '), c.characters.length ? 'Characters: ' + c.characters.join(', ') : ''].filter(Boolean).join(' · ');
}
