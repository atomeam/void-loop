// brain-route, Verse Brain picks which skill answers an ask (owner, 2026-10-30: "give the brain more to do and more power in the site").
// Before this the stage took the first skill in /skills/index.json order whose match() passed, and the brain only heard the ask after.
// Now, when more than one skill can answer, the brain chooses. It weighs three things, all its own:
//   order      the page's order is where it starts: the first skill gets a head start of 0.1 over the next, so with nothing learned
//              the brain picks what the page always picked (no change for anyone until the brain has learned something)
//   outcomes   what happened after its past picks on this device, word by word: a card the visitor kept counts for that skill and
//              those words; a card closed at once, undone, or followed by the same ask in other words counts against it
//   attention  the words the brain is thinking about now (its active ideas, lib/brain-mind.js goals) that are in a skill's name
// Every pick is an action in its log (actionsOf), with what it chose, what the page would have chosen, and why. undo() takes back
// what an outcome taught it, so every lesson can be undone from /brain/. Pure: no DOM, no storage (lib/brain-mind.js keeps it).
import { cleanWords } from './brain-organs.js';

export const HEAD_START = 0.1, MAX_WORDS = 400, MAX_SKILLS_A_WORD = 6, MAX_LOG = 40, MAX_CANDS = 8, ATTENTION = 0.15;

/** a fresh router. */
export const createRoutes = () => ({ w: {}, picks: 0, changed: 0, good: 0, bad: 0, seq: 0, log: [] });

const wordsOf = (ask) => cleanWords(ask).filter((x) => x.length > 2);
/** what the outcomes on this device say about `skill` for these words: the sum, word by word, of (kept - not kept) / (seen + 2). */
export function learnedOf(R, words, skill) {
  let s = 0;
  for (const w of words) { const c = R.w[w] && R.w[w][skill]; if (c) s += (c[0] - c[1]) / (c[0] + c[1] + 2); }
  return s;
}

/** choose among `cands` (skill names in the page's order; the first is what the page would pick). focus: words the brain attends to
 *  now. skills: skill names it attends to now (lib/brain-watch.js focusOf: the skills that answer for a break that stands); they are
 *  names, not words of the ask, so the ask's own words never drop them, and a name counts whole ("team-chat"). Returns { pick, first, changed, scores: [{ name, score }], why, id } and logs the action; null when there is no choice. */
export function route(R, ask, cands, focus = [], at = Date.now(), skills = []) {
  const names = [...new Set((cands || []).map(String).filter(Boolean))].slice(0, MAX_CANDS);
  if (names.length < 2) return null;
  // attention is what it was thinking about before this ask: the ask's own words (it hears each ask as a goal before the page routes
  // it) are not, or "find milk on the stage" would go to stage-find over note-tools for the word "stage" alone (2026-10-30, shard 1)
  const words = wordsOf(ask), own = new Set(cleanWords(ask)), hot = new Set((focus || []).map((x) => String(x).toLowerCase()).filter((x) => !own.has(x)));
  const hotSkills = new Set((skills || []).map((x) => String(x).toLowerCase()));
  const scores = names.map((name, i) => {
    const learned = learnedOf(R, words, name), parts = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const attention = parts.some((p) => hot.has(p)) || hotSkills.has(name.toLowerCase()) ? ATTENTION : 0;
    return { name, score: Math.round((-HEAD_START * i + learned + attention) * 1000) / 1000, learned: Math.round(learned * 1000) / 1000, attention };
  });
  let best = scores[0]; for (const s of scores) if (s.score > best.score) best = s; // a tie keeps the page's order
  const first = names[0], changed = best.name !== first, top = scores[0];
  const why = !changed ? (best.learned > 0 ? 'kept ' + first + ': it was kept before for these words' : 'kept ' + first + ': the page\'s first choice, and nothing learned says otherwise')
    : best.learned - top.learned > 0 ? 'chose ' + best.name + ' over ' + first + ': for these words ' + (top.learned < 0 ? first + ' was left or asked again before' : best.name + ' was kept before')
      : 'chose ' + best.name + ' over ' + first + ': it is thinking about ' + best.name;
  const id = 'r' + (++R.seq);
  R.picks++; if (changed) R.changed++;
  R.log.push({ id, at, kind: 'route', ask: String(ask).slice(0, 80), cands: names, pick: best.name, first, why, outcome: null });
  if (R.log.length > MAX_LOG) R.log.splice(0, R.log.length - MAX_LOG);
  return { pick: best.name, first, changed, scores, why, id };
}

const bump = (R, words, skill, k, by) => {
  for (const w of words) {
    const row = R.w[w] || (R.w[w] = {}), c = row[skill] || (row[skill] = [0, 0]); c[k] = Math.max(0, c[k] + by);
    if (!c[0] && !c[1]) delete row[skill];
    if (!Object.keys(row).length) { delete R.w[w]; continue; }
    const ks = Object.keys(row); if (ks.length > MAX_SKILLS_A_WORD) { ks.sort((p, q) => (row[p][0] + row[p][1]) - (row[q][0] + row[q][1])); delete row[ks[0] === skill ? ks[1] : ks[0]]; }
  }
  const ws = Object.keys(R.w); if (ws.length > MAX_WORDS) for (const w of ws.slice(0, ws.length - MAX_WORDS)) if (!words.includes(w)) delete R.w[w];
};

/** what happened after pick `id`: good (the card was kept) or not (closed at once, undone, or the same ask again in other words). Only
 *  the first outcome counts. Returns true when it was learned. */
export function outcome(R, id, good) {
  const a = R.log.find((x) => x.id === id); if (!a || a.outcome) return false;
  a.outcome = good ? 'kept' : 'left'; good ? R.good++ : R.bad++;
  bump(R, wordsOf(a.ask), a.pick, good ? 0 : 1, 1);
  return true;
}

/** take back what pick `id` taught it (Undo on /brain/). Returns true when there was a lesson to take back. */
export function undo(R, id) {
  const a = R.log.find((x) => x.id === id); if (!a || !a.outcome || a.outcome === 'undone') return false;
  const good = a.outcome === 'kept'; bump(R, wordsOf(a.ask), a.pick, good ? 0 : 1, -1); good ? R.good-- : R.bad--;
  a.outcome = 'undone'; return true;
}

/** an ask typed on a tool page's ask box (lib/toolkit.js), heard when the brain next starts: logged with where the page sent it. */
export function heard(R, ask, from, to, at = Date.now()) {
  if (/^\s*(?:unlock\s*)+\S{16,}/i.test(String(ask))) return null; // an owner key is never kept
  const id = 'h' + (++R.seq);
  R.log.push({ id, at, kind: 'heard', ask: String(ask).slice(0, 80), cands: [String(to || '').slice(0, 80)], pick: String(to || '').slice(0, 80), first: String(from || '').slice(0, 80), why: 'asked on ' + (from || 'a tool page') + '; that page sent it to ' + (to || 'the stage'), outcome: null });
  if (R.log.length > MAX_LOG) R.log.splice(0, R.log.length - MAX_LOG);
  return id;
}
export const HEARD_KEY = 'a2m.brain.heard.v1', HEARD_MAX = 24;

/** its picks, newest first, for the log on /brain/. */
export const actionsOf = (R, top = 12) => R.log.slice(-top).reverse().map((a) => ({ ...a }));

/** what to keep on this device (the visitor's own words). */
export const routesOf = (R) => ({ w: R.w, picks: R.picks, changed: R.changed, good: R.good, bad: R.bad, seq: R.seq, log: R.log.slice(-MAX_LOG) });
/** put kept routes back; wrong shapes are ignored. */
export function loadRoutes(R, k) {
  if (!k || typeof k !== 'object' || !k.w || typeof k.w !== 'object') return false;
  const n = (x) => (Number.isFinite(x) && x >= 0 ? Math.round(x) : 0), w = {};
  for (const [word, row] of Object.entries(k.w).slice(0, MAX_WORDS)) {
    if (!row || typeof row !== 'object') continue; const r = {};
    for (const [s, c] of Object.entries(row).slice(0, MAX_SKILLS_A_WORD)) if (Array.isArray(c) && c.length === 2) r[String(s).slice(0, 40)] = [n(c[0]), n(c[1])];
    if (Object.keys(r).length) w[String(word).slice(0, 24)] = r;
  }
  R.w = w; R.picks = n(k.picks); R.changed = Math.min(n(k.changed), R.picks); R.good = n(k.good); R.bad = n(k.bad); R.seq = n(k.seq);
  R.log = (Array.isArray(k.log) ? k.log : []).filter((a) => a && typeof a.id === 'string' && Array.isArray(a.cands)).slice(-MAX_LOG)
    .map((a) => ({ id: a.id, at: n(a.at), kind: a.kind === 'heard' ? 'heard' : 'route', ask: String(a.ask || '').slice(0, 80), cands: a.cands.map(String).slice(0, MAX_CANDS), pick: String(a.pick || ''), first: String(a.first || ''), why: String(a.why || ''), outcome: ['kept', 'left', 'undone'].includes(a.outcome) ? a.outcome : null }));
  return true;
}
