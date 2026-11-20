// The idea engine's core (owner, 2026-11-20: "how can we keep coming up with really good ideas?"; "make sure it checks everything we
// already have"; "consolidate them into ONE idea engine"). Pure: no files, no network. tools/idea-engine.mjs reads and writes.
// One daily pass: inventory every existing thing -> visitor signals (aggregated) -> candidates from five generators -> dedupe against
// the inventory and every older list -> score -> tournament -> the top picks go to the will (tools/will.py) as wants.
// Borrowed methods (public practice): SCAMPER lenses on existing features; morphological mash-ups (pairs across families); the Kano
// model's "delighters"; ICE-style scoring; a seeded round-robin tournament; and a two-armed bandit per generator (grown ideas raise a
// generator's weight, reworked ones lower it). Unused ideas are reworked or relinked, never deleted (docs/RULES.md, owner 2026-10-13).
import { laneOf } from './visible.js';

export const KINDS = ['page', 'skill', 'game', 'card', 'loop', 'egg', 'idea-list'];
const STOP = new Set('the a an of and for to in on with is it my me what how verse page tool make add new your you this that from into its'.split(' '));
export const words = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
export const slug = (t) => words(t).slice(0, 7).join('-').slice(0, 60) || 'idea';
export function overlap(a, b) {
  const A = new Set(words(a)), B = new Set(words(b)); if (!A.size || !B.size) return 0;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size);
}
/** a small seeded random (mulberry32), so a day's pass is the same pass when it is run again. Pure. */
export function rng(seed) {
  let a = 0; for (const c of String(seed)) a = (a * 31 + c.charCodeAt(0)) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---- 1. the inventory: everything Verse already has ----
/** items: [{ kind, id, name, family?, path? }] from the lists the reader found. Same id twice counts once. Pure. */
export function inventory(lists) {
  const seen = new Map();
  for (const [kind, rows] of Object.entries(lists || {})) for (const r of rows || []) {
    const id = String(r.id || r.name || '').trim(); if (!id) continue;
    const key = kind + ':' + id.toLowerCase(); if (!seen.has(key)) seen.set(key, { kind, id, name: r.name || id, family: r.family || '', path: r.path || '', status: r.status || '' });
  }
  const items = [...seen.values()], counts = {};
  for (const it of items) counts[it.kind] = (counts[it.kind] || 0) + 1;
  return { items, counts, total: items.length };
}

// ---- 2. visitor signals: counts only, never a visitor's words unless enough people typed them ----
export const MIN_PEOPLE = 3;
/** misses [{ ask, count }] (already redacted), pages [{ k, n }] (domains/traffic.json), used [{ id, days, opens }]. Pure. */
export function signals({ misses = [], pages = [], used = [] } = {}, items = []) {
  const topics = new Map();
  for (const m of misses) for (const w of new Set(words(m.ask))) if (/^[a-z]{3,20}$/.test(w)) topics.set(w, (topics.get(w) || 0) + Math.max(1, +m.count || 1));
  const wanted = [...topics].filter(([, n]) => n >= MIN_PEOPLE).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([topic, n]) => ({ topic, n, near: nearest(topic, items) }));
  const stay = pages.filter((p) => p && p.k && p.k !== '/').slice(0, 10).map((p) => ({ path: p.k, views: +p.n || 0 }));
  return { misses: misses.reduce((s, m) => s + Math.max(1, +m.count || 1), 0), wanted, stay, used: used.slice(0, 40).map((u) => ({ id: u.id, days: +u.days || 0 })) };
}
export function nearest(text, items, not = '') {
  let best = null;
  for (const it of items) { if (it.id === not || it.kind === 'loop' || it.kind === 'idea-list') continue; const s = overlap(text, it.name + ' ' + it.id.replace(/[-/]+/g, ' ')); if (s > 0 && (!best || s > best.s)) best = { id: it.id, kind: it.kind, s }; }
  return best ? best.id : '';
}

// ---- 3. the five generators ----
// SCAMPER-style lenses on an existing feature: each says how it gets better, more fun, or linked to another one
export const LENSES = [
  { id: 'secret', say: (x) => `Hide a secret in ${x}: a famous phrase about its subject makes it react in a surprising way, counted in the trick hunt`, fun: 5, use: 2, wow: 5, ease: 4 },
  { id: 'juice', for: ['game', 'make', 'page', 'card'], say: (x) => `Make ${x} feel alive: motion, sound and a little celebration when its main action lands`, fun: 4, use: 3, wow: 3, ease: 4 },
  { id: 'link', say: (x, y) => `Link ${x} to ${y}: one tap from a ${x} result opens ${y} with it already filled in`, fun: 3, use: 5, wow: 3, ease: 4 },
  { id: 'daily', for: ['game', 'words', 'page'], say: (x) => `A daily ${x} challenge: one shared puzzle a day, a streak, and a result anyone can share`, fun: 5, use: 3, wow: 3, ease: 3 },
  { id: 'versus', for: ['game'], say: (x) => `Play ${x} against Verse: Verse takes seat 2, explains its move, and learns from the replay`, fun: 5, use: 3, wow: 4, ease: 3 },
  { id: 'quiz', for: ['card', 'words', 'sky', 'page'], say: (x) => `A quick quiz on every ${x} card: three questions from what the card shows, with a score`, fun: 4, use: 4, wow: 2, ease: 4 },
  { id: 'surprise', say: (x) => `"Surprise me" on ${x}: one tap gives a random, delightful result instead of a blank form`, fun: 4, use: 3, wow: 4, ease: 5 },
  { id: 'share', say: (x) => `Turn a ${x} result into a share card: a picture with the result and a link back that opens it live`, fun: 3, use: 4, wow: 2, ease: 4 },
  { id: 'revive', say: (x) => `Bring ${x} back: make it findable from the ask bar and the tools list, then give it one fresh twist`, fun: 3, use: 4, wow: 2, ease: 5 },
];
// pattern study (public game, app and easter-egg design; no rival is named here): what makes things fun, as Verse-original moves
export const PATTERNS = [
  { id: 'literal', name: 'The page does what the words say', how: 'type a word like gravity, tilt or echo and the stage acts it out' },
  { id: 'reference', name: 'Famous references answered with a wink', how: 'a well-known number, film line or game phrase gets its famous meaning first, plus a playful touch' },
  { id: 'hidden-count', name: 'A hunt with a counter', how: 'secrets to find, a quiet counter of how many you have, no list of them anywhere' },
  { id: 'choice', name: 'A meaningful choice', how: 'two doors with different outcomes (dig deeper or go back), never a fake choice' },
  { id: 'juice', name: 'Feedback that feels good', how: 'every action answers with motion, sound and a small reward within a tenth of a second' },
  { id: 'daily', name: 'One shared thing a day', how: 'the same puzzle for everyone today, a streak, a spoiler-free share' },
  { id: 'mastery', name: 'Easy to start, deep to master', how: 'the first move needs no rules; skill shows over many plays' },
  { id: 'collect', name: 'Collect and complete', how: 'cards, stamps or figures you earn by using Verse, shown on one shelf' },
  { id: 'surprise', name: 'Variable delight, never a trap', how: 'a rare extra now and then; no streak loss guilt, no paywall bait' },
  { id: 'social', name: 'Play with someone', how: 'a challenge link a friend opens straight into the same game or puzzle' },
  { id: 'idle', name: 'Reward for waiting', how: 'leave it a few seconds and something small happens by itself' },
  { id: 'remix', name: 'Make something of your own', how: 'the result is a starting point you can change and keep' },
];
const FUN_KINDS = new Set(['game', 'egg', 'card']);
const famOf = (it) => it.family || it.kind;
const MASH = new Set(['game', 'card', 'page', 'words', 'sky', 'make', 'time', 'safety-play']);
const kindOf = (it) => (it.kind === 'game' || it.family === 'games' ? 'game' : it.kind === 'card' ? 'card' : it.kind === 'page' ? 'page' : it.family || it.kind);
/** true when a lens makes sense on this thing (no "play the VAT calculator against Verse"). Pure. */
export const fits = (lens, it) => !lens.for || lens.for.includes(kindOf(it));
// things a visitor meets and that have a name people know: pages, games, cards, and skills outside the internal and business families
export const visibleThing = (it) => ['page', 'game', 'card', 'egg'].includes(it.kind) || (it.kind === 'skill' && it.family && !['self', 'stage'].includes(it.family) && laneOf(it.name) !== 'business');
/** candidates from the inventory, the signals, the patterns and the older idea lists. Pure, seeded by the day. */
export function generate(inv, sig, { day = '', seeds = [], per = 40 } = {}) {
  const r = rng(day), pick = (a) => a[Math.floor(r() * a.length)];
  const feats = inv.items.filter(visibleThing);
  const fun = feats.filter((it) => FUN_KINDS.has(it.kind) || famOf(it) === 'games' || famOf(it) === 'make' || famOf(it) === 'safety-play');
  const out = [];
  const add = (gen, title, o = {}) => out.push({ gen, title, slug: slug(title), ...o });
  // improve: how could X be better, more fun, linked to Y (fun features drawn twice as often)
  for (let i = 0; i < per; i++) {
    const x = r() < 0.6 && fun.length ? pick(fun) : pick(feats); if (!x) break;
    const ok = LENSES.filter((l) => fits(l, x)), lens = pick(ok), y = lens.id === 'link' ? feats.find((f) => f.id === nearest(x.name, feats, x.id)) || pick(feats) : null;
    add('improve', lens.say(x.name, y && y.name), { targets: [x.id, ...(y ? [y.id] : [])], lens: lens.id, prior: lens });
  }
  // mash-up: two features from different families make one new thing
  for (let i = 0; i < per / 2 && fun.length > 1; i++) {
    const a = pick(fun), b = pick(feats.filter((f) => MASH.has(kindOf(f)) && kindOf(f) !== kindOf(a))); if (!b) break;
    add('mashup', `${a.name} meets ${b.name}: ${b.name} becomes a twist inside ${a.name}`, { targets: [a.id, b.id], prior: { fun: 4, use: 2, wow: 5, ease: 2 } });
  }
  // signal: what people typed and did not get, answered by extending the nearest existing thing
  for (const w of sig.wanted || []) add('signal', w.near ? `Answer "${w.topic}" asks well inside ${w.near} (typed ${w.n} times, no good answer)` : `Answer "${w.topic}" asks well (typed ${w.n} times, no good answer)`, { targets: w.near ? [w.near] : [], prior: { fun: 2, use: 5, wow: 2, ease: 3 }, people: w.n });
  // pattern: a fun pattern made Verse's own, on a well-visited place
  for (const p of PATTERNS) { const at = (sig.stay || [])[Math.floor(r() * Math.max(1, (sig.stay || []).length))]; const x = pick(fun) || {}; add('pattern', `${p.name} on ${at ? at.path : x.name}: ${p.how}`, { targets: [at ? at.path : x.id].filter(Boolean), pattern: p.id, prior: { fun: 5, use: 2, wow: 4, ease: 3 } }); }
  // seed: the older idea systems' open items join the same tournament instead of running their own (the consolidation)
  for (const s of seeds) add('seed', String(s.title).slice(0, 200), { from: s.from, targets: s.targets || [], prior: { fun: 3, use: 3, wow: 2, ease: 3 } });
  return out;
}

// ---- 4. dedupe and score ----
export const DUP = 0.75;
/** drops candidates that repeat an existing thing outright, an older list's row, a recent pick, or each other. Pure. */
export function dedupe(cands, inv, { known = [], board = {} } = {}) {
  const names = inv.items.filter((it) => it.kind !== 'loop').map((it) => it.name.toLowerCase());
  const hist = board.history || {}, keep = [], dropped = { exists: 0, listed: 0, picked: 0, twin: 0 };
  for (const c of cands) {
    const h = hist[c.slug];
    if (h && h.status !== 'idea') { dropped.picked++; continue; }
    if (c.gen !== 'improve' && c.gen !== 'mashup' && c.gen !== 'pattern' && names.some((n) => n.length > 3 && overlap(c.title, n) >= 1 && words(c.title).length <= words(n).length + 1)) { dropped.exists++; continue; }
    if (c.gen !== 'seed' && known.some((k) => overlap(c.title, k) >= DUP)) { dropped.listed++; continue; }
    if (keep.some((k) => k.slug === c.slug || overlap(k.title, c.title) >= 0.9)) { dropped.twin++; continue; }
    keep.push(c);
  }
  return { keep, dropped };
}
const clamp = (v) => Math.max(0, Math.min(5, v));
/** Atom's taste: fun first, standard names, a minimal homepage, everything linked, a super page over a new page. 0..5. Pure. */
export function fit(c) {
  const t = c.title, lane = laneOf(t);
  let f = 3;
  if (lane === 'fun' || ['secret', 'daily', 'versus', 'juice', 'surprise'].includes(c.lens) || c.gen === 'pattern' || c.gen === 'mashup') f += 1;
  if (lane === 'business') f -= 2;
  if ((c.targets || []).length) f += 0.5; // grows something that exists (super-page rule)
  if ((c.targets || []).length > 1) f += 0.5; // links two things
  if (/\bnew (?:page|site|app)\b/i.test(t)) f -= 1;
  if (/\bhome ?page\b|\bon the home\b/i.test(t) && !/secret|trick/i.test(t)) f -= 1.5;
  return clamp(f);
}
export const WEIGHTS = { fun: 0.3, use: 0.2, wow: 0.15, ease: 0.15, fit: 0.2 };
/** total 0..100 from the five scores, times the generator's learned weight. Pure. */
export function score(c, gw = {}) {
  const p = c.prior || {}, m = c.model || {};
  const s = { fun: m.fun ?? p.fun ?? 3, use: m.use ?? p.use ?? 3, wow: m.wow ?? p.wow ?? 3, ease: m.ease ?? p.ease ?? 3, fit: fit(c) };
  if (c.people) s.use = clamp(s.use + Math.min(1, c.people / 10));
  const raw = Object.entries(WEIGHTS).reduce((t, [k, w]) => t + w * clamp(s[k]), 0) / 5 * 100;
  return { ...c, scores: s, total: Math.round(raw * (gw[c.gen] || 1)) };
}
/** a seeded round-robin among the top: each idea meets every other once, the higher total wins, near ties go to the funnier, then to
 *  the one that grows more of what exists. Wins rank the board. Pure. */
export function tournament(scored, top = 16) {
  // a varied field: at most two of one lens or pattern, one per first target
  const field = [], per = {}, tgt = new Set();
  for (const c of [...scored].sort((a, b) => b.total - a.total)) {
    if (field.length >= top) break;
    const k = c.gen + ':' + (c.lens || c.pattern || c.from || ''), t = (c.targets || [])[0];
    if ((per[k] || 0) >= 2 || (t && tgt.has(t))) continue;
    per[k] = (per[k] || 0) + 1; if (t) tgt.add(t); field.push({ ...c, wins: 0 });
  }
  for (let i = 0; i < field.length; i++) for (let j = i + 1; j < field.length; j++) {
    const a = field[i], b = field[j], d = a.total - b.total;
    const aw = Math.abs(d) > 2 ? d > 0 : a.scores.fun !== b.scores.fun ? a.scores.fun > b.scores.fun : (a.targets || []).length >= (b.targets || []).length;
    (aw ? a : b).wins++;
  }
  return field.sort((a, b) => b.wins - a.wins || b.total - a.total);
}
/** the day's picks: the top N, at most one per generator and at most one business-lane idea. Pure. */
export function picks(ranked, n = 3) {
  const out = [], gens = new Set(); let biz = 0;
  for (const pass of [0, 1]) for (const c of ranked) {
    if (out.length >= n) break;
    if (out.includes(c) || (pass === 0 && gens.has(c.gen))) continue;
    if (laneOf(c.title) === 'business' && biz++ >= 1) continue;
    gens.add(c.gen); out.push(c);
  }
  return out;
}

// ---- 5. ship small and measure ----
export const GROW_DAYS = 3, REWORK_AFTER = 14, WINDOW = 14;
/** each shipped idea's verdict from its use count (id `idea-<slug>`, lib/used.js): grow when used on GROW_DAYS+ days of the window;
 *  rework when shipped REWORK_AFTER+ days ago and used on at most one day; else wait. Pure. */
export function measure(history, used, now = Date.now()) {
  const by = new Map((used || []).map((u) => [String(u.id), +u.days || 0]));
  const out = {};
  for (const [s, h] of Object.entries(history || {})) {
    if (h.status !== 'shipped' && h.status !== 'grow' && h.status !== 'rework') { out[s] = h; continue; }
    const days = by.get('idea-' + s) || 0, age = (now - Date.parse(h.shippedAt || h.picked || 0)) / 864e5;
    const status = days >= GROW_DAYS ? 'grow' : age >= REWORK_AFTER && days <= 1 ? 'rework' : 'shipped';
    out[s] = { ...h, status, usedDays: days };
  }
  return out;
}
/** the bandit: each generator's weight from its grown and reworked ideas, 0.7..1.4. Pure. */
export function learn(history) {
  const g = {};
  for (const h of Object.values(history || {})) { if (!h.gen) continue; const e = g[h.gen] || (g[h.gen] = { grow: 0, rework: 0 }); if (h.status === 'grow') e.grow++; if (h.status === 'rework') e.rework++; }
  const w = {};
  for (const [k, e] of Object.entries(g)) w[k] = +Math.max(0.7, Math.min(1.4, (1 + e.grow) / (1 + e.rework))).toFixed(2);
  return w;
}
/** the will's want for a pick: what to build, how it is measured, and the gate it ships through. Pure. */
export function wantOf(c) {
  return { kind: 'idea engine', title: (c.pitch || c.title).slice(0, 160), weight: c.pitch ? 36 : 28, source: 'idea engine: ' + c.gen,
    why: `today's idea tournament: ${c.total}/100, ${c.wins} wins (fun ${c.scores.fun}, useful ${c.scores.use}, surprise ${c.scores.wow}, doable ${c.scores.ease}, fits ${c.scores.fit}). `
      + `Grow what exists (${(c.targets || []).join(', ') || 'the nearest page'}), no new page unless nothing fits. Count use with ideaUsed('${c.slug}') from /lib/idea-use.js. Ships only through the stranger test.` };
}

// ---- 6. ideas from Verse's take on an answer card (owner, 2026-11-20: start them the moment Verse has them) ----
export const TAKE_KINDS = { game: { fun: 5, use: 2, wow: 4, ease: 2 }, trick: { fun: 5, use: 2, wow: 5, ease: 4 }, tool: { fun: 3, use: 5, wow: 2, ease: 3 }, page: { fun: 3, use: 4, wow: 3, ease: 2 } };
export const TAKE_BAR = 66;
/** the take's last line "IDEA: <game|trick|tool|page>: <one line>" -> { take (without it), idea: { kind, title } | null }. Pure. */
export function splitTake(text) {
  const lines = String(text || '').split('\n'), last = (lines[lines.length - 1] || '').trim();
  const m = /^IDEA:\s*(game|trick|tool|page)\s*[:\-–]\s*(.{8,160})$/i.exec(last);
  if (!m) return { take: String(text || '').replace(/\n?IDEA:.*$/i, '').trim(), idea: null };
  return { take: lines.slice(0, -1).join('\n').trim(), idea: { kind: m[1].toLowerCase(), title: m[2].replace(/[<>`]/g, '').trim() } };
}
/** a take's idea against what exists (names: page titles, skill and game names; shipped: slugs). -> { slug, total, extend, start }:
 *  an idea that an existing thing already does becomes "grow that thing" (super-page rule); it starts at once when it clears the bar. Pure. */
export function judgeTake(idea, subject, names = [], shipped = []) {
  const title = idea.title, s = slug(title);
  if (shipped.includes(s)) return { slug: s, total: 0, extend: '', start: false, why: 'already built' };
  let extend = '';
  for (const n of names) if (overlap(title, n) >= 0.6 && (!extend || n.length < extend.length)) extend = n;
  const c = score({ gen: 'take', title: (extend ? 'Grow ' + extend + ': ' : '') + title + ' (for ' + subject + ')', lens: idea.kind === 'trick' ? 'secret' : idea.kind === 'game' ? 'daily' : '', targets: extend ? [extend] : [], prior: TAKE_KINDS[idea.kind] || TAKE_KINDS.tool });
  return { slug: s, total: c.total, extend, start: c.total >= TAKE_BAR, why: c.total >= TAKE_BAR ? 'clears the bar' : 'below the bar, waits for the daily tournament' };
}
