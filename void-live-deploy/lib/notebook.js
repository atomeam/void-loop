// The notebook's logic (the frontier's "absorb and connect every repo": linked notes with backlinks and a daily note, then "what am I missing"
// over those notes; owner, 2026-10-15: "all the projects are Verse"). Written here in Verse's own code: a note is { id, title, text, at }, a link is
// [[Another note]] in the text, and everything below is pure so the card (skills/notebook.js) only draws what these return.
//   linksOf(text)            the titles a note links to, once each, in order
//   backlinksOf(notes, t)    the notes that link to title t
//   dailyTitle(date)         today's note title, YYYY-MM-DD in the person's own day
//   ensureDaily(notes, date) the notes with today's note added when it is not there yet (never a second one)
//   missingOf(notes)         what the notebook is missing: links to notes that do not exist, plain mentions of a note that are not links, notes nothing links to or from
//   linkMention(text, t)     the text with the first plain mention of note t wrapped as a link
//   outlinksOf(notes, note)  the notes a note links to, in order, each with its id ('' when that note is not made yet)
//   padText(note)            a note as notepad text: the title, then the text with each [[link]] as its plain title
export const MAX_NOTES = 200, MAX_TITLE = 60, MAX_TEXT = 8000;
const LINK = /\[\[([^\[\]\n]{1,60})\]\]/g;

/** a title as a lookup key: lower case, spaces collapsed. Pure. */
export const keyOf = (t) => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
/** a title as it is kept: trimmed, one line, at most MAX_TITLE characters. Pure. */
export const cleanTitle = (t) => String(t || '').replace(/[\[\]\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE);

/** the titles a note's text links to with [[...]], once each (by key), in the order they first appear. Pure. */
export function linksOf(text) {
  const seen = new Set(), out = [];
  for (const m of String(text || '').matchAll(LINK)) { const t = cleanTitle(m[1]), k = keyOf(t); if (k && !seen.has(k)) { seen.add(k); out.push(t); } }
  return out;
}

/** the notes whose text links to `title` (not the note itself), in the order they are kept. Pure. */
export const backlinksOf = (notes, title) => (notes || []).filter((n) => keyOf(n.title) !== keyOf(title) && linksOf(n.text).some((l) => keyOf(l) === keyOf(title)));

/** the notes `note` links to, in the order its text links them: { title, id }, id '' when no note has that title yet; never the note itself. Pure. */
export function outlinksOf(notes, note) {
  if (!note) return [];
  return linksOf(note.text).filter((t) => keyOf(t) !== keyOf(note.title)).map((t) => {
    const n = (notes || []).find((x) => x && keyOf(x.title) === keyOf(t));
    return { title: n ? n.title : t, id: n ? n.id : '' };
  });
}

/** a note as notepad text: its title on the first line, then its text with each [[link]] written as the plain title, at most MAX_TEXT characters. Pure. */
export function padText(note) {
  if (!note) return '';
  const head = cleanTitle(note.title), body = String(note.text || '').replace(LINK, (_, t) => cleanTitle(t)).replace(/\s+$/, '');
  return (head && body ? head + '\n' + body : head || body).slice(0, MAX_TEXT);
}

const pad = (n) => String(n).padStart(2, '0');
/** today's note title: the date as YYYY-MM-DD, in the person's own local day. Pure. */
export const dailyTitle = (date = new Date()) => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());

/** the notes with today's note added when there is none with that title: a second call the same day changes nothing. Pure. */
export function ensureDaily(notes, date = new Date(), make = (title) => ({ id: 'n' + Date.now().toString(36), title, text: '', at: date.getTime() })) {
  const title = dailyTitle(date), list = Array.isArray(notes) ? notes : [];
  if (list.some((n) => keyOf(n.title) === keyOf(title))) return { notes: list, title, created: false };
  return { notes: [...list, make(title)].slice(-MAX_NOTES), title, created: true };
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// a plain mention: the title as whole words, not already inside [[...]], and not part of a longer word
// the title is escaped here (esc) before it is a pattern, so a title with . * ( or [ in it is read as plain words
const mentionRe = (title, flags = 'i') => new RegExp('(?<![\\w\\[])' + esc(cleanTitle(title)).replace(/\s+/g, '\\s+') + '(?![\\w\\]])', flags);
const stripLinks = (text) => String(text || '').replace(LINK, ' ');

/** what the notebook is missing, from the notes alone:
 *  dangling: titles some notes link to that have no note: [{ title, from: [note titles] }], most linked first
 *  unlinked: a note's text names another note in plain words without a link: [{ title, in }] (a title shorter than 3 characters is never mentioned by chance)
 *  orphans:  notes no note links to and that link to none (today's note excepted: it is the place to start)
 *  Pure. */
export function missingOf(notes, today = dailyTitle()) {
  const list = (notes || []).filter((n) => n && keyOf(n.title)), have = new Map(list.map((n) => [keyOf(n.title), n]));
  const want = new Map();
  for (const n of list) for (const l of linksOf(n.text)) if (!have.has(keyOf(l))) { const e = want.get(keyOf(l)) || { title: l, from: [] }; if (!e.from.includes(n.title)) e.from.push(n.title); want.set(keyOf(l), e); }
  const dangling = [...want.values()].sort((a, b) => b.from.length - a.from.length || (a.title < b.title ? -1 : 1));
  const unlinked = [];
  for (const n of list) {
    const text = stripLinks(n.text), linked = new Set(linksOf(n.text).map(keyOf));
    for (const o of list) if (o !== n && cleanTitle(o.title).length >= 3 && !linked.has(keyOf(o.title)) && mentionRe(o.title).test(text)) unlinked.push({ title: o.title, in: n.title });
  }
  const orphans = list.filter((n) => keyOf(n.title) !== keyOf(today) && !linksOf(n.text).length && !backlinksOf(list, n.title).length).map((n) => n.title);
  return { dangling, unlinked, orphans };
}

/** the text with the first plain mention of `title` wrapped as [[title]] (as written in the text); unchanged when there is none. Pure. */
export function linkMention(text, title) {
  const t = String(text || '');
  // the first mention that is not inside an existing link
  const spans = [...t.matchAll(LINK)].map((x) => [x.index, x.index + x[0].length]);
  for (const hit of t.matchAll(mentionRe(title, 'gi'))) if (!spans.some(([a, b]) => hit.index >= a && hit.index < b)) return t.slice(0, hit.index) + '[[' + hit[0] + ']]' + t.slice(hit.index + hit[0].length);
  return t;
}

/** the notes as they are kept: only well-formed ones, titles cleaned and unique, text capped. Pure. */
export function tidyNotes(notes) {
  const seen = new Set(), out = [];
  for (const n of Array.isArray(notes) ? notes : []) {
    const title = cleanTitle(n && n.title), k = keyOf(title);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push({ id: String((n && n.id) || 'n' + out.length), title, text: String((n && n.text) || '').slice(0, MAX_TEXT), at: Number(n && n.at) || 0 });
  }
  return out.slice(-MAX_NOTES);
}

/** the ask as the notebook reads it: { open: true } | { daily: true } | { backlinks: 'title' } | { missing: true } | { make: 'title' }, or null. A title keeps its case. Pure. */
export function parseAsk(text) {
  const t = String(text || '').trim().replace(/[’]/g, "'").replace(/\s+/g, ' ').replace(/[?.!]+$/, '');
  if (/^(?:please\s+)?(?:(?:open|show|start|make|write|give me|add)\s+)?(?:(?:me|up)\s+)?(?:my\s+|the\s+|a\s+)?(?:daily|today'?s)\s+note(?:\s+for\s+today)?$/i.test(t) || /^todays\s+note$/i.test(t)) return { daily: true };
  if (/^(?:what|which)\s+(?:am i|are we)\s+missing\s+(?:in|from|across)\s+(?:my\s+|the\s+)?(?:linked\s+)?(?:notes|notebook)$/i.test(t) || /^(?:what(?:'s| is)\s+)?missing\s+(?:in|from)\s+(?:my\s+|the\s+)?(?:linked\s+)?(?:notes|notebook)$/i.test(t)) return { missing: true };
  let m = /^(?:what\s+links\s+to|backlinks\s+(?:for|to|of)|show\s+(?:the\s+)?backlinks\s+(?:for|to|of))\s+(?:the\s+note\s+)?(.{1,60})$/i.exec(t);
  if (m) return { backlinks: cleanTitle(m[1]) };
  m = /^(?:new|make|add|create)\s+(?:a\s+)?(?:linked\s+)?note\s+(?:called|named|titled)\s+(.{1,60})$/i.exec(t);
  if (m) return { make: cleanTitle(m[1]) };
  if (/^(?:please\s+)?(?:(?:open|show|start|make)\s+)?(?:me\s+)?(?:my\s+|the\s+|a\s+)?(?:linked\s+notes?(?:\s+with\s+backlinks)?|notebook)$/i.test(t)) return { open: true };
  return null;
}
