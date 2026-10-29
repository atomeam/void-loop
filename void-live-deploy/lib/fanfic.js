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

/** a file name for a draft: its title in lowercase words, or "story". */
export const fileName = (title) => (String(title || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'story') + '.txt';

/** the code for a new fandom's board: fic and the name's letters and digits, 10 at most, with a number on the end when that code is taken or
 *  not allowed. '' when no code is left (it never runs out in practice: 999 tries). */
export function ficCode(name, taken = new Set()) {
  const stem = ('fic' + String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')).slice(0, 10);
  if (!codeProblem(stem, taken)) return stem;
  for (let n = 2; n < 1000; n++) { const c = stem.slice(0, 10 - String(n).length) + n; if (!codeProblem(c, taken)) return c; }
  return '';
}

/** a pen name as the archive shows it: one line, no # (the # would start a tripcode), at most the boards' name length; '' when blank. */
export const penName = (raw) => cleanLine(String(raw == null ? '' : raw).replace(/#/g, ''), LIMITS.name);
/** the name field the boards take: the pen name (or Anonymous) and, after #, this device's secret, so the server signs every post from this
 *  device with the same mark. The secret never shows; the visitor only ever types a pen name. */
export const signedName = (pen, secret) => (penName(pen) || 'Anonymous') + (secret ? '#' + secret : '');

const SUMMARY_RE = /^Summary: ([^\n]{1,300})\n\n?/;
export const SUMMARY_MAX = 300;
/** chapter 1's text with its summary on a first line of its own ("Summary: ..."), the way the archive reads it back. */
export const withSummary = (summary, text) => { const s = cleanLine(summary, SUMMARY_MAX); return (s ? 'Summary: ' + s + '\n\n' : '') + String(text == null ? '' : text).trim(); };
/** { summary, text } from chapter 1's post. */
export function readSummary(body) { const b = String(body == null ? '' : body), m = SUMMARY_RE.exec(b); return m ? { summary: m[1].trim(), text: b.slice(m[0].length) } : { summary: '', text: b }; }

const CHAPTER_RE = /^Chapter (\d{1,4})(?:: ([^\n]{0,100})|(, continued))?\n\n?/;
/** the first line of a chapter's post: "Chapter 3: Title", or "Chapter 3, continued" on the posts that carry the rest of a long chapter. */
export const chapterHead = (n, title = '', more = false) => 'Chapter ' + n + (more ? ', continued' : cleanLine(title, 100) ? ': ' + cleanLine(title, 100) : '') + '\n\n';
/** { n, title, more, text } when a post opens with a chapter line, else null. */
export function readChapter(body) {
  const b = String(body == null ? '' : body), m = CHAPTER_RE.exec(b);
  return m ? { n: +m[1], title: (m[2] || '').trim(), more: !!m[3], text: b.slice(m[0].length) } : null;
}
/** a chapter's text as the posts the boards will take whole, each with its chapter line: the first "Chapter n: title", the rest ", continued".
 *  Chapter 1 has no line on its first post (it opens the thread, after the summary). */
export function chapterPosts(n, title, text, summary = '') {
  const first = n === 1 ? withSummary(summary, '') : chapterHead(n, title), more = chapterHead(n, '', true);
  const room = LIMITS.body - Math.max(Array.from(first).length, Array.from(more).length), lines = LIMITS.lines - 3;
  return splitParts(text, room, lines).map((p, i) => (i === 0 ? first : more) + p);
}

/** a story out of a thread: the opening post is chapter 1; a reply signed with the opening post's mark and opening with a chapter line is the
 *  author's (a new chapter, or more of one); every other reply is a review. Unsigned stories (posted on /boards/ without a mark) have chapter 1
 *  only. { title, author, trip, summary, chapters: [{ n, title, text, at, nos }], reviews, words, published, updated } */
export function storyOf(op, posts = []) {
  const { summary, text } = readSummary(op.body);
  const chapters = [{ n: 1, title: '', text, at: op.at, nos: [op.no] }], reviews = [];
  for (const p of posts) {
    if (!p || p.no === op.no || p.hidden) continue;
    const c = op.trip && p.trip === op.trip ? readChapter(p.body) : null;
    if (!c) { reviews.push(p); continue; }
    const last = chapters[chapters.length - 1];
    if (c.more && last.n === c.n) { last.text += '\n\n' + c.text; last.nos.push(p.no); continue; }
    if (c.more) { reviews.push(p); continue; }
    chapters.push({ n: chapters.length + 1, title: c.title, text: c.text, at: p.at, nos: [p.no] });
  }
  const updated = chapters.reduce((t, c) => Math.max(t, c.at || 0), op.at || 0);
  return { title: op.sub || excerpt(text, 60) || 'Untitled', author: op.name || 'Anonymous', trip: op.trip || '', summary, chapters, reviews,
    words: chapters.reduce((n, c) => n + words(c.text), 0), published: op.at || 0, updated };
}

/** a topic row for the archive's lists, from a thread in a board's catalog. */
export function topicOf(t, board) {
  const { summary, text } = readSummary(t.body);
  return { board: board.code, fandom: board.title, nsfw: !!board.nsfw, no: t.no, title: t.sub || excerpt(text, 60) || 'Untitled', author: t.name || 'Anonymous',
    trip: t.trip || '', summary: summary || excerpt(text, 160), replies: t.replies || 0, at: t.at || 0, bumped: t.bumped || t.at || 0, locked: !!t.locked };
}

/** the archive's numbers, all counted from what is there: fandoms, stories, posts, and authors (a pen name and its mark count once). */
export function statsOf(boards, topics) {
  const authors = new Set(topics.map((t) => t.author + '!' + t.trip));
  return { fandoms: boards.length, stories: topics.length, posts: topics.reduce((n, t) => n + 1 + (t.replies || 0), 0), authors: authors.size };
}

/** a random secret for this device: 16 bytes as hex. */
export function newSecret(rand = (n) => crypto.getRandomValues(new Uint8Array(n))) { return [...rand(16)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
