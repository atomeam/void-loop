// /fanfic/'s pure half (owner, 2026-10-29: "build the page", the /fanfic/ spec): a writing archive that is only a way of reading the anonymous
// boards (lib/boards.js, functions/api/boards/[[path]].js). No endpoint of its own, nothing seeded, no accounts: a fandom is a board someone
// made, a story is a thread, a chapter is a post, and posting still goes through the boards' own form and bot check. The Writing Room keeps its
// drafts on the device. Everything here is pure so tools/fanfic.test.mjs runs it in node; the page is void-live-deploy/fanfic/.
import { LIMITS } from './boards.js';

/** a board that belongs on /fanfic/: its code starts with fic (the "Start a fandom board" form fills that in), or its line says fan fiction. */
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

// the hand-off to /boards/: the story waits on this device under this key, the board's own form is filled from it, and the visitor posts each
// part themselves through the boards' bot check (boards/app.js). It lapses after six hours so an old story never fills a form by surprise.
export const HANDOFF = 'a2m.void.fanfic.post.v1', HANDOFF_TTL = 6 * 3600e3;
export const handoff = (b, title, text, now = Date.now()) => ({ b, sub: String(title || '').slice(0, LIMITS.sub), parts: splitParts(text), i: 0, t: 0, at: now });
/** the hand-off if it is still good, else null. */
export const liveHandoff = (h, now = Date.now()) => (h && Array.isArray(h.parts) && h.parts.length && typeof h.b === 'string' && now - (h.at || 0) < HANDOFF_TTL && h.i < h.parts.length ? h : null);
