// stage pack C (owner, 2026-10-18): the pure logic behind four device-local skills - the living codex (skills/codex.js),
// the echo chamber (skills/echo-chamber.js), the time capsule (skills/time-capsule.js) and the whisper network
// (skills/whisper-network.js). Everything here is plain code over the values handed in: no network, nothing sent, nothing
// appears until asked. The skills keep the results in this browser's localStorage (lib/state.js names the keys).
import { clean } from './ask-text.js';
import { read, write } from './state.js';

const low = (s) => clean(s).toLowerCase().replace(/[’]/g, "'");
const DAY = 864e5;
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const cut = (s, n) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);

// ---------- the Living Codex ----------

/** what a codex ask means: null, or { op: 'file' } | { op: 'open', topic } | { op: 'about', topic }. Pure. */
export function codexOf(text) {
  const t = low(text).replace(/^(?:please|void),?\s+/, '');
  if (/^(?:file|add|put|save|store|keep)\s+(?:this|that|it|the\s+(?:last\s+|current\s+)?(?:card|answer))\s+(?:in|into|to)\s+(?:the|my)\s+codex$/.test(t)) return { op: 'file' };
  let m = /^(?:open|show|browse)\s+(?:the|my)\s+codex(?:\s+(?:on|about|for)\s+(.+))?$/.exec(t);
  if (m) return { op: 'open', topic: cut(m[1] || '', 60) };
  m = /^what\s+(?:have\s+i|did\s+i)\s+(?:collected|collect|filed|file|gathered|saved)\s+(?:about|on|for)\s+(.+?)(?:\s+in\s+(?:the|my)\s+codex)?$/.exec(t);
  if (m) return { op: 'about', topic: cut(m[1], 60) };
  return null;
}

/** one filed item from a card: { id, ask, title, text, skill, t }; null when there is nothing to file. Pure. */
export function codexItem({ ask, title, text, skill }, now = Date.now()) {
  const a = cut(ask, 120), body = cut(text, 500), ti = cut(title || ask, 80);
  if (!a && !body) return null;
  const id = (a + '|' + body).toLowerCase().replace(/[^a-z0-9|]+/g, '').slice(0, 80);
  return { id, ask: a, title: ti, text: body, skill: cut(skill, 40), t: now };
}

/** the codex with an item filed: the same item twice is one (newest wins); the oldest go past 200. Pure. */
export function fileItem(items, item) {
  if (!item) return Array.isArray(items) ? items : [];
  const rest = (Array.isArray(items) ? items : []).filter((x) => x && x.id !== item.id);
  return [...rest, item].slice(-200);
}

/** items whose ask, title, text or skill hold every word of the topic; no topic is all. Pure. */
export function searchCodex(items, topic) {
  const words = low(topic).split(/\s+/).filter((w) => w.length > 1);
  return (Array.isArray(items) ? items : []).filter((x) => {
    if (!x) return false;
    const hay = (x.ask + ' ' + x.title + ' ' + x.text + ' ' + x.skill).toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** items grouped by the family their skill sits in (skills/families.json): [{ family, items }], families in file order, "Other" last. Pure. */
export function groupByFamily(items, families) {
  const of = new Map();
  for (const f of (families && families.families) || []) for (const s of f.skills || []) of.set(s.name, f.name);
  const groups = new Map();
  for (const it of items) {
    const g = of.get(it.skill) || 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(it);
  }
  const order = [...((families && families.families) || []).map((f) => f.name), 'Other'];
  return order.filter((n) => groups.has(n)).map((family) => ({ family, items: groups.get(family).slice().sort((a, b) => b.t - a.t) }));
}

// ---------- the Echo Chamber ----------

/** a day or span in words as { from, to } ms (to exclusive), or null. today, yesterday, this week (the last 7 days), last week, this month, [last|on] <weekday>. Pure. */
export function rangeOf(phrase, now = Date.now()) {
  const p = low(phrase).replace(/^(?:from|on|in|during|since)\s+/, '');
  const today = startOfDay(now);
  if (p === 'today') return { from: today, to: today + DAY };
  if (p === 'yesterday') return { from: today - DAY, to: today };
  if (p === 'this week') return { from: today - 6 * DAY, to: today + DAY };
  if (p === 'last week') return { from: today - 13 * DAY, to: today - 6 * DAY };
  if (p === 'this month') { const d = new Date(now); return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: today + DAY }; }
  const m = /^(last\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)$/.exec(p);
  if (m) {
    const want = WEEKDAYS.indexOf(m[2]);
    let back = (new Date(now).getDay() - want + 7) % 7;
    if (m[1] && back === 0) back = 7; // "last tuesday" said on a tuesday is a week ago
    return { from: today - back * DAY, to: today - back * DAY + DAY };
  }
  return null;
}

/** an echo ask: null, or { kind: 'best' | 'decide', range: {from,to}|null, label }. A range word it cannot read makes it not this ask. Pure. */
export function echoOf(text, now = Date.now()) {
  const t = low(text).replace(/^(?:please|void),?\s+/, '');
  let m = /^replay\s+my\s+(?:best\s+|top\s+|kept\s+)?answers(?:\s+(?:from\s+)?(.+))?$/.exec(t);
  let kind = 'best';
  if (!m) { m = /^what\s+did\s+i\s+(?:decide|choose|conclude)(?:\s+(.+))?$/.exec(t); kind = 'decide'; }
  if (!m) return null;
  const phrase = (m[1] || '').trim();
  if (!phrase) return { kind, range: null, label: 'all that is kept on this device' };
  const range = rangeOf(phrase, now);
  return range ? { kind, range, label: phrase } : null;
}

const DECIDING = /\b(?:should i|decide|choose|pick|which|versus|vs)\b|\bor\b.+\?|\bbetter\b/i;
/**
 * what the echo chamber replays, newest first: this device's loop log (a2m.void.loop.v1: entries { t, ask, score, note }) and
 * the codex. "best" is an answer a skill gave (score pass) or a filed item; "decide" is an ask that was a choice. Pure.
 */
export function echoes({ log, codex }, { kind, range }, limit = 20) {
  const inRange = (t) => { const ms = typeof t === 'number' ? t : Date.parse(t); return !isNaN(ms) && (!range || (ms >= range.from && ms < range.to)); };
  const seen = new Set(), out = [];
  const add = (x) => { const k = x.ask.toLowerCase(); if (!x.ask || seen.has(k)) return; seen.add(k); out.push(x); };
  const rows = [];
  for (const e of Array.isArray(log) ? log : []) {
    if (!e || !e.ask || !inRange(e.t) || !/^skill:/.test(String(e.note || '')) || e.score !== 'pass') continue;
    if (/^(?:replay|what\s+did\s+i\s+(?:decide|choose))/i.test(e.ask)) continue; // an echo is not itself echoed
    rows.push({ t: Date.parse(e.t), ask: cut(e.ask, 120), via: String(e.note).slice(6), filed: false });
  }
  for (const c of Array.isArray(codex) ? codex : []) if (c && c.ask && inRange(c.t)) rows.push({ t: c.t, ask: c.ask, via: c.skill || 'codex', filed: true, text: c.text });
  rows.sort((a, b) => b.t - a.t);
  for (const r of rows) if (kind === 'decide' ? DECIDING.test(r.ask) : true) add(r);
  // a filed item is the best a person marked, so it leads a "best" replay
  if (kind === 'best') out.sort((a, b) => Number(b.filed) - Number(a.filed) || b.t - a.t);
  return out.slice(0, limit);
}

// ---------- the Time Capsule ----------

/** a date as YYYY-MM-DD, "1 january 2027" or "january 1 2027" -> ms at local midnight; NaN when it is none. Pure. */
export function dateOf(s) {
  const t = low(s).replace(/(\d)(?:st|nd|rd|th)\b/g, '$1').replace(/,/g, '');
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3]); return d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d.getTime() : NaN; }
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const mon = (x) => MONTHS.findIndex((n) => n === x || (x.length >= 3 && n.startsWith(x)));
  m = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/.exec(t);
  let day, mi, yr;
  if (m) { day = +m[1]; mi = mon(m[2]); yr = +m[3]; }
  else if ((m = /^([a-z]+)\s+(\d{1,2})\s+(\d{4})$/.exec(t))) { day = +m[2]; mi = mon(m[1]); yr = +m[3]; }
  else return NaN;
  if (mi < 0) return NaN;
  const d = new Date(yr, mi, day);
  return d.getMonth() === mi && d.getDate() === day ? d.getTime() : NaN;
}

/** a capsule ask: null, { op:'seal', until: ms } | { op:'seal', word } | { op:'open', word } | { op:'due' }. Pure. */
export function capsuleOf(text) {
  const raw = clean(text).replace(/^(?:please|void),?\s+/i, ''), t = raw.toLowerCase();
  let m = /^seal\s+(?:a\s+|my\s+)?(?:time\s+)?capsule\s+until\s+(.+)$/.exec(t);
  if (m) { const until = dateOf(m[1]); return isNaN(until) ? null : { op: 'seal', until }; }
  m = /^seal\s+(?:a\s+|my\s+)?(?:time\s+)?capsule\s+for\s+the\s+word\s+["'“]?([^\s"'”]{2,40})["'”]?$/.exec(t);
  if (m) return { op: 'seal', word: m[1] };
  m = /^open\s+(?:the\s+|my\s+)?(?:time\s+)?capsule\s+["'“]?([^\s"'”]{2,40})["'”]?$/.exec(t);
  if (m) return { op: 'open', word: m[1] };
  if (/^open\s+(?:the\s+|my\s+)(?:time\s+)?capsules$/.test(t)) return { op: 'due' };
  return null;
}

/** the SHA-256 of a word (lower-cased, trimmed) as hex: the only form in which a capsule's word is ever kept. Needs crypto.subtle. */
export async function hashWord(word) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(word).trim().toLowerCase())));
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const MAX_CAPSULE = 150000; // characters of snapshot per capsule: a stage of notes, never a stage of photos
/** the snapshot of a stage's things (an object by id, or a list): plain copies, no ids that clash; { things } or { error }. Pure. */
export function snapshotOf(things) {
  const list = Array.isArray(things) ? things : Object.values(things || {});
  if (!list.length) return { error: 'The stage is empty, so there is nothing to seal.' };
  let copy;
  try { copy = JSON.parse(JSON.stringify(list)); } catch (_) { return { error: 'The stage could not be copied.' }; }
  if (JSON.stringify(copy).length > MAX_CAPSULE) return { error: 'The stage is too big for one capsule (images are the usual reason); clear some and try again.' };
  return { things: copy };
}

/** a capsule record. Date capsules hold { until }; word capsules hold { hash } and never the word. Pure over a hash handed in. */
export function newCapsule({ until, hash }, things, now = Date.now()) {
  return { id: 'cap' + now.toString(36), sealed: now, ...(until ? { until } : { hash }), things };
}

/** can this capsule be opened: a date capsule once its day has come; a word capsule when the hash of the typed word matches. Pure. */
export function openable(cap, { now = Date.now(), hash = '' } = {}) {
  if (!cap) return false;
  if (cap.until) return now >= cap.until;
  return !!cap.hash && cap.hash === hash;
}

/** what a card says about a capsule that cannot be opened yet: no contents, ever. Pure. */
export function sealedLine(cap) {
  return cap.until ? 'Sealed until ' + new Date(cap.until).toLocaleDateString() + '. Nothing shows before then.' : 'Sealed with a word. Nothing shows until the word is typed.';
}

/** a short line for a snapshotted thing: its kind and the words it held. Pure. */
export function thingLine(th) {
  const words = cut((th && (th.label || th.text || th.title || th.body || th.name)) || '', 60);
  return (th && th.kind ? th.kind : 'thing') + (words ? ': ' + words : '');
}

/** the things of a capsule ready to put back: fresh ids so nothing already on the stage is overwritten. Pure. */
export function restorable(cap, idOf) {
  return (cap.things || []).map((th, i) => ({ ...th, id: idOf(th, i) }));
}

// ---------- the Whisper Network ----------

/** a whisper ask: null, or { target: 'the clock', text }. The note is everything after the first colon. Pure. */
export function whisperOf(text) {
  const raw = String(text || '').trim().replace(/\s+/g, ' ');
  const m = /^(?:please\s+)?leave\s+a\s+whisper\s+(?:on|for|at|in)\s+(.+?)\s*:\s*(.+)$/i.exec(raw);
  if (!m) return null;
  const note = cut(m[2], 200);
  return note ? { target: m[1].trim().toLowerCase(), text: note } : null;
}

/** the id of the stage thing a phrase names ({ self } / { kind } / { kind, name } / { name } from skills/label.js refOf): the selected one, or the single best match; '' when none or unclear. Pure. */
export function findThingId(things, ref, selectedId = '') {
  const list = Array.isArray(things) ? things : Object.values(things || {});
  if (!ref) return '';
  if (ref.self) return list.some((t) => t.id === selectedId) ? selectedId : '';
  const hits = list.filter((t) => (!ref.kind || t.kind === ref.kind) && (!ref.name || String(t.label || '').toLowerCase() === ref.name));
  return hits.length === 1 ? hits[0].id : hits.length > 1 && ref.kind && !ref.name ? hits[hits.length - 1].id : '';
}

/** the whispers with one added; at most 50 and 3 on any one thing. Pure. */
export function addWhisper(list, thingId, text, now = Date.now()) {
  const keep = (Array.isArray(list) ? list : []).filter(Boolean);
  const same = keep.filter((w) => w.thing === thingId);
  const drop = same.length >= 3 ? same[0] : null;
  return [...keep.filter((w) => w !== drop), { thing: thingId, text: cut(text, 200), t: now }].slice(-50);
}

// ---------- the device's own store (lib/state.js names the keys) ----------

/** the list kept under a state name, [] when empty or broken */
export function loadList(name, s) { try { const v = JSON.parse(read(name, s) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
/** keep a list under a state name; false when the browser would not hold it */
export function saveList(name, list, s) { return write(name, JSON.stringify(list), s); }

/** { shown, rest }: the whispers on a thing (surfaced once) and the list without them. Pure. */
export function takeWhispers(list, thingId) {
  const all = (Array.isArray(list) ? list : []).filter(Boolean);
  return { shown: all.filter((w) => w.thing === thingId), rest: all.filter((w) => w.thing !== thingId) };
}
