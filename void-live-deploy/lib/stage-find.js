// Tools pack 5, search and history (owner, 2026-10-18; numbers 91 to 97, 99, 100): find things on the stage, by kind, jump to one by
// name, what was recently kept, what changed today, the pile of the last 20 dismissed things and putting one back, bookmarks of asks.
// Pure unless it says it touches the browser. Everything is device-local; nothing here sends anything anywhere.
import { tidy } from './stage-pack.js';

export const PILE_MAX = 20, CHANGES_MAX = 300, BOOKMARKS_MAX = 30;
const SKIP_KEYS = new Set(['id', 'kind', 'x', 'y', 'w', 'h', 'z', 'rot', 'color', 'fav']);

const squeeze = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const strip = (html) => squeeze(String(html || '').replace(/<(script|style|button|svg|canvas|select)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"));

/** every word a stage thing holds, as one lower-case string: its strings, its list items, a kept card's words. Pure. */
export function thingText(th, depth = 0) {
  if (!th || typeof th !== 'object' || depth > 2) return '';
  const out = [];
  for (const [k, v] of Object.entries(th)) {
    if (SKIP_KEYS.has(k)) continue;
    if (typeof v === 'string') out.push(k === 'html' ? strip(v) : v);
    else if (Array.isArray(v)) for (const it of v.slice(0, 60)) out.push(typeof it === 'string' ? it : typeof it === 'object' ? thingText(it, depth + 1) : '');
  }
  return squeeze(out.join(' ')).toLowerCase();
}

/** a short name for a thing: its name, title, first line of words, the ask it kept, or its kind. Pure. */
export function thingLabel(th) {
  if (!th) return '';
  const w = squeeze(th.name || th.title || th.label || '') || squeeze(String(th.text || '').split('\n')[0]) || squeeze(th.ask) || (th.kind === 'kept' ? strip(th.html).slice(0, 60) : '');
  return (w || th.kind || 'thing').slice(0, 80);
}

const words = (q) => squeeze(q).toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(' ').filter((w) => w.length > 0);

/** things holding every word of `q` (in their words, name or kind), best first. opts.kind limits to one kind. Pure. */
export function searchThings(things, q, opts = {}) {
  const ws = words(q);
  if (!ws.length) return [];
  const hits = [];
  for (const th of Object.values(things || {})) {
    if (!th || !th.kind || (opts.kind && th.kind !== opts.kind)) continue;
    const text = thingText(th), label = thingLabel(th).toLowerCase(), kind = String(th.kind).toLowerCase();
    if (!ws.every((w) => text.includes(w) || label.includes(w) || kind === w || kind + 's' === w)) continue;
    const score = ws.reduce((s, w) => s + (label.includes(w) ? 3 : 0) + (kind === w ? 2 : 0) + (text.includes(w) ? 1 : 0), 0);
    hits.push({ id: th.id, kind: th.kind, label: thingLabel(th), score });
  }
  return hits.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
}

/** every thing of one kind. Pure. */
export function byKind(things, kind) {
  return Object.values(things || {}).filter((t) => t && t.kind === kind).map((t) => ({ id: t.id, kind: t.kind, label: thingLabel(t), score: 0 }));
}

const PLUR = { ies: 'y', es: '', s: '' };
/** the stage kind a word names among `kinds` ("timers" -> timer, "notes" -> sticky), or ''. Pure. */
export function kindWord(word, kinds, alias = {}) {
  const w = tidy(word).toLowerCase().replace(/^(?:the|my|all|every|any)\s+/, '').replace(/^(?:the|my)\s+/, '');
  const set = new Set(kinds || []);
  const tries = [w, alias[w]];
  for (const [suf, to] of Object.entries(PLUR)) if (w.endsWith(suf) && w.length > suf.length + 1) { const base = w.slice(0, -suf.length) + to; tries.push(base, alias[base]); }
  for (const c of tries) if (c && set.has(c)) return c;
  return '';
}
export const KIND_ALIAS = { note: 'sticky', notes: 'sticky', 'sticky note': 'sticky', 'sticky notes': 'sticky', stickies: 'sticky', todo: 'list', todos: 'list', picture: 'image', pictures: 'image', photo: 'image', photos: 'image', stopwatch: 'timer', habit: 'habits', 'habit ring': 'habits', 'habit rings': 'habits', 'kept card': 'kept', 'kept cards': 'kept', 'kept item': 'kept', 'kept items': 'kept', calculator: 'calc', calculators: 'calc' };
export const BASIC_KINDS = ['sticky', 'list', 'timer', 'clock', 'counter', 'calc', 'image', 'link', 'kept', 'notepad', 'calendar', 'habits', 'decision', 'figure', 'countdown', 'shape', 'label', 'media'];

const SCOPE = '(stage|kept\\s+(?:items?|cards?|answers?|things)|cards|kept)';
/**
 * What a search-and-history ask wants, or null:
 *  { op: 'search', q, kept } "search kept items for pizza", "find milk on the stage"
 *  { op: 'kind', word }      "show all timers on the stage", "search the stage by kind: timer"
 *  { op: 'jump', phrase }    "jump to the milk note"
 *  { op: 'recent-kept' }     "recently kept", "what did I keep lately"
 *  { op: 'changed' }         "what changed today"
 * Pure. The caller decides whether a kind word or a jump phrase is real (it needs the stage).
 */
export function findIntent(text) {
  const t = tidy(text).toLowerCase().replace(/[?!.\s]+$/, '');
  let m;
  if (/^(?:please\s+)?(?:what\s+(?:has\s+)?changed(?:\s+on\s+(?:the|my)\s+stage)?\s+today|(?:show\s+(?:me\s+)?)?(?:today'?s\s+changes|what\s+changed\s+today|changes\s+today)|what\s+did\s+i\s+change\s+today)$/.test(t)) return { op: 'changed' };
  if (/^(?:please\s+)?(?:show\s+(?:me\s+)?)?(?:recently\s+kept(?:\s+(?:items|cards|things))?|what\s+(?:did\s+i|have\s+i)\s+(?:keep|kept)\s+(?:lately|recently)|my\s+recent(?:ly)?\s+kept(?:\s+(?:items|cards))?)$/.test(t)) return { op: 'recent-kept' };
  if ((m = new RegExp('^(?:please\\s+)?(?:search|find|look\\s+through|look\\s+in)\\s+(?:the\\s+|my\\s+)?' + SCOPE + '\\s+(?:for|:)\\s*(.{1,80})$').exec(t))) {
    return { op: 'search', q: m[2].trim(), kept: /kept|cards/.test(m[1]) };
  }
  if ((m = new RegExp('^(?:please\\s+)?search\\s+(?:the\\s+)?stage\\s+by\\s+(?:kind|type)\\s*:?\\s*(.{1,40})$').exec(t))) return { op: 'kind', word: m[1] };
  if ((m = new RegExp('^(?:please\\s+)?(?:find|search\\s+for|locate)\\s+(.{1,80}?)\\s+(?:on|in)\\s+(?:the\\s+|my\\s+)' + SCOPE + '$').exec(t))) return { op: 'search', q: m[1], kept: /kept|cards/.test(m[2]) };
  if ((m = /^(?:please\s+)?(?:show|list|find|display)\s+(?:me\s+)?(?:all\s+|every\s+|the\s+|my\s+)*([a-z][a-z -]{1,24}?)\s+(?:on|in)\s+(?:the\s+|my\s+)?stage$/.exec(t))) return { op: 'kind', word: m[1] };
  if ((m = /^(?:please\s+)?(?:jump|go|scroll|fly|take\s+me|navigate)\s+to\s+(?:the\s+|my\s+)?(.{1,50})$/.exec(t))) return { op: 'jump', phrase: m[1].replace(/\s+(?:card|thing|object)$/, '') };
  return null;
}

/** the best thing for "jump to <phrase>": a kind word, or the words of its name and text. Pure. */
export function jumpTarget(things, phrase, alias = KIND_ALIAS) {
  const list = Object.values(things || {}).filter((t) => t && t.kind);
  const p = tidy(phrase).toLowerCase().replace(/^(?:the|my)\s+/, '');
  if (!p) return null;
  const kinds = [...new Set(list.map((t) => t.kind))];
  // "the milk note" -> words milk + kind sticky
  const ws = words(p), kindHits = new Set();
  const left = [];
  for (const w of ws) { const k = kindWord(w, kinds, alias); if (k) kindHits.add(k); else if (!['note', 'the', 'my', 'a'].includes(w)) left.push(w); }
  const pool = kindHits.size ? list.filter((t) => kindHits.has(t.kind)) : list;
  const scoped = Object.fromEntries(pool.map((t) => [t.id, t]));
  if (!left.length) return pool.length ? { id: pool[0].id, kind: pool[0].kind, label: thingLabel(pool[0]), score: 1 } : null;
  const hits = searchThings(scoped, left.join(' '));
  return hits[0] || null;
}

// --- what changed: the stage watched between redraws -------------------------------------------------------------

/** a thing's signature without its place: a move is not a change worth listing. Pure. */
export function sigOf(th) {
  try { return JSON.stringify(th, (k, v) => (k === 'x' || k === 'y' || k === 'z' ? undefined : v)).slice(0, 4000); } catch (_) { return ''; }
}

/** { added, removed, changed } ids between the signatures seen last time (a Map id -> sig) and the things now. Pure. */
export function diffStage(prev, things) {
  const added = [], removed = [], changed = [], now = new Map();
  for (const [id, th] of Object.entries(things || {})) {
    if (!th || !th.kind) continue;
    const s = sigOf(th); now.set(id, s);
    if (!prev.has(id)) added.push(id); else if (prev.get(id) !== s) changed.push(id);
  }
  for (const id of prev.keys()) if (!now.has(id)) removed.push(id);
  return { added, removed, changed, now };
}

/** the log with `entries` ({ op, id, kind, label }) added at time `at`, newest first, 300 kept. Pure. */
export function logChanges(log, entries, at) {
  const add = (entries || []).map((e) => ({ at, op: e.op, id: e.id, kind: e.kind, label: String(e.label || '').slice(0, 80) }));
  return add.concat(Array.isArray(log) ? log : []).slice(0, CHANGES_MAX);
}

/** the local-time midnight (ms) at the start of the day containing `now`. Pure. */
export function dayStart(now = Date.now()) { const d = new Date(now); d.setHours(0, 0, 0, 0); return d.getTime(); }

/** log entries from today, newest first, one line per thing and op (a thing changed ten times is one line). Pure. */
export function todaysChanges(log, now = Date.now()) {
  const from = dayStart(now), seen = new Set(), out = [];
  for (const e of Array.isArray(log) ? log : []) {
    if (!e || e.at < from) continue;
    const key = e.op + ':' + e.id;
    if (seen.has(key)) continue;
    seen.add(key); out.push(e);
  }
  return out;
}

/** "added a sticky: buy milk" style line. Pure. */
export const changeLine = (e) => ({ add: 'added', remove: 'dismissed', change: 'edited' }[e.op] || e.op) + ' ' + e.kind + (e.label && e.label !== e.kind ? ': ' + e.label : '');

/** a thing's kept time order: the newest kept first, from the log's "add" entries of kind kept, then the rest of the kept things. Pure. */
export function recentlyKept(things, log) {
  const kept = Object.values(things || {}).filter((t) => t && t.kind === 'kept');
  const order = new Map();
  (Array.isArray(log) ? log : []).forEach((e, i) => { if (e && e.op === 'add' && e.kind === 'kept' && !order.has(e.id)) order.set(e.id, i); });
  return kept.sort((a, b) => (order.has(a.id) ? order.get(a.id) : 1e6) - (order.has(b.id) ? order.get(b.id) : 1e6)).map((t) => ({ id: t.id, kind: t.kind, label: thingLabel(t), score: 0 }));
}

// --- the undo pile -----------------------------------------------------------------------------------------------

/** what a dismissed-pile ask wants: { op: 'show' } | { op: 'restore', n } (1 = the newest) | { op: 'restore-name', name } | null. Pure. */
export function pileIntent(text) {
  const t = tidy(text).toLowerCase().replace(/[?!.\s]+$/, '');
  let m;
  if (/^(?:please\s+)?(?:show\s+(?:me\s+)?)?(?:(?:the\s+|my\s+)?(?:undo\s+pile|dismissed(?:\s+(?:items|things|cards|pile))?)|what\s+(?:i|did\s+i)\s+(?:dismiss(?:ed)?|sent\s+away)(?:\s+(?:lately|recently))?|(?:the\s+)?last\s+20\s+dismissed(?:\s+(?:items|things|cards))?)$/.test(t)) return { op: 'show' };
  if (/^(?:please\s+)?(?:restore|bring\s+back|put\s+back|undismiss|un-dismiss)\s+(?:the\s+)?(?:last|latest|newest|previous)\s+(?:dismissed|one)(?:\s+(?:thing|item|card))?$/.test(t) || /^(?:please\s+)?(?:restore\s+(?:the\s+)?dismissed|undismiss|un-dismiss)(?:\s+(?:thing|item|card))?$/.test(t) || /^(?:please\s+)?bring\s+back\s+what\s+i\s+(?:dismissed|sent\s+away)$/.test(t)) return { op: 'restore', n: 1 };
  if ((m = /^(?:please\s+)?(?:restore|bring\s+back|put\s+back)\s+(?:the\s+)?(?:dismissed\s+)?(?:(?:item|thing|card)\s+)?(?:number\s+|no\.?\s*|#)?(\d{1,2})(?:st|nd|rd|th)?(?:\s+(?:dismissed|from\s+the\s+(?:undo\s+)?pile))?$/.exec(t)) && +m[1] >= 1 && +m[1] <= PILE_MAX) return { op: 'restore', n: +m[1] };
  if ((m = /^(?:please\s+)?(?:restore|undismiss|un-dismiss)\s+(?:the\s+|my\s+)?(.{2,40}?)(?:\s+(?:i\s+)?dismissed)?$/.exec(t)) && !/^(?:dismissed|the dismissed)/.test(m[1])) return { op: 'restore-name', name: m[1] };
  return null;
}

/** the pile with `th` put on top (a copy of it), 20 kept. Pure. */
export function pushPile(pile, th, at) {
  if (!th || !th.kind) return Array.isArray(pile) ? pile : [];
  let copy; try { copy = JSON.parse(JSON.stringify(th)); } catch (_) { return Array.isArray(pile) ? pile : []; }
  const rest = (Array.isArray(pile) ? pile : []).filter((e) => e && e.thing && e.thing.id !== th.id);
  return [{ at, kind: th.kind, label: thingLabel(th), thing: copy }].concat(rest).slice(0, PILE_MAX);
}

/** { entry, pile } taking pile entry n (1 = newest) or the newest whose label holds `name`; entry is null when none. Pure. */
export function takeFromPile(pile, pick) {
  const list = Array.isArray(pile) ? pile : [];
  let i = -1;
  if (typeof pick === 'number') i = pick - 1;
  else if (pick && pick.name) { const n = String(pick.name).toLowerCase(); i = list.findIndex((e) => e && (String(e.label).toLowerCase().includes(n) || String(e.kind).toLowerCase() === n || String(e.kind).toLowerCase() + 's' === n)); }
  if (i < 0 || i >= list.length || !list[i]) return { entry: null, pile: list };
  return { entry: list[i], pile: list.filter((_, j) => j !== i) };
}

// --- bookmarks (favorites of things, bookmarks of asks) ----------------------------------------------------------------

/**
 * { op: 'add-ask', ask } "bookmark this ask: make a clock", "bookmark my last ask" (ask '' = the last one);
 * { op: 'favorite' } / { op: 'unfavorite' } for the picked thing; { op: 'show' } "my bookmarks", "my favorites";
 * { op: 'run', n } "run my second bookmark"; { op: 'remove', n } "remove bookmark 2". Pure.
 */
export function bookmarkIntent(text) {
  const t = tidy(text).toLowerCase().replace(/[?!.\s]+$/, ''), raw = tidy(text).replace(/[?!\s]+$/, '');
  let m;
  if ((m = /^(?:please\s+)?(?:bookmark|save)\s+(?:this|my\s+last|the\s+last)\s+ask(?:\s*:\s*(.+))?$/i.exec(raw))) return { op: 'add-ask', ask: (m[1] || '').trim() };
  if ((m = /^(?:please\s+)?bookmark(?:\s+the\s+ask)?\s*:\s*(.{2,200})$/i.exec(raw))) return { op: 'add-ask', ask: m[1].trim() };
  if (/^(?:please\s+)?(?:favou?rite|star|add\s+to\s+(?:my\s+)?favou?rites)\s+(?:this|it)(?:\s+(?:card|thing|object))?$/.test(t)) return { op: 'favorite' };
  if (/^(?:please\s+)?(?:unfavou?rite|unstar|remove\s+(?:this|it)\s+from\s+(?:my\s+)?favou?rites)(?:\s+(?:this|it))?$/.test(t)) return { op: 'unfavorite' };
  if (/^(?:please\s+)?(?:show\s+(?:me\s+)?)?(?:my\s+)?(?:bookmarks|bookmarked\s+asks|favou?rites|starred(?:\s+(?:things|cards|items))?)$/.test(t)) return { op: 'show' };
  if ((m = /^(?:please\s+)?(?:run|ask)\s+(?:my\s+)?(?:bookmark\s+(?:number\s+|#)?(\d{1,2})|(first|second|third|fourth|fifth)\s+bookmark)$/.exec(t))) return { op: 'run', n: +m[1] || ['first', 'second', 'third', 'fourth', 'fifth'].indexOf(m[2]) + 1 };
  if ((m = /^(?:please\s+)?(?:remove|delete|drop)\s+bookmark\s+(?:number\s+|#)?(\d{1,2})$/.exec(t))) return { op: 'remove', n: +m[1] };
  return null;
}

/** the bookmark list with `ask` added (newest first, no repeats, 30 kept, junk and keys left out). Pure. */
export function addBookmark(list, ask) {
  const a = tidy(ask).slice(0, 200);
  if (!a || /^(?:unlock\s*)+\S{16,}\s*$/i.test(a)) return Array.isArray(list) ? list : [];
  return [a].concat((Array.isArray(list) ? list : []).filter((x) => typeof x === 'string' && x.toLowerCase() !== a.toLowerCase())).slice(0, BOOKMARKS_MAX);
}
