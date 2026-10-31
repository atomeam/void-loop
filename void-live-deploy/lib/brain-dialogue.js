// brain-dialogue, Verse Brain's conversation orb: what this visitor asked Verse and what Verse answered, kept on their own device, so a
// repeated ask and a follow-up build on the first one instead of starting again. Owner, 2026-10-30 (the conversation orb): "the brain
// already feels memories from other cards; this would let it feel this visitor's history with it, survive reloads, and turn a repeated
// question from a failure into an upgrade". Owner, 2026-10-29: "combine all the builds into one entity", "dont fake it".
//   1. the log: each ask the stage heard (lib/brain-host.js hear) is an entry { ask, at, day, words }; when the answer engine shows its
//      answer (void.html showAnswer), the entry gets the answer's first words (answered). At most MAX entries, the oldest go first.
//   2. recall: before an ask is logged, it is compared with the log. A repeat is the same ask (its words the same as an earlier ask's, at
//      least REPEAT of them) asked on an earlier day, or more than GAP after it. A follow-up shares a word with an earlier ask or with the
//      start of its answer, inside FOLLOW_DAYS, and is not a repeat. The newest such entry is the one it builds on.
//   3. what the card says: for a repeat, the day it was asked, what Verse said then, and whether its answer now is the same or changed;
//      for a follow-up, the ask it follows. Those are the entries' own words and times, nothing more.
//   4. the proxy for "Out in the world" (lib/art-rules.js): a follow-up is kept when it was answered and the visitor did not ask it again
//      within GAP. Correctness is not measured; this is the nearest thing a page can see. The proxy holds when kept follow-ups fall on at
//      least 2 separate days (UTC).
//   As an organ: when an ask recalls an earlier one, the earlier ask's ideas light up again in the workspace and leave a memory where they
//   are, so the brain feels this visitor's history with it.
// Nothing here is sent anywhere: the log is part of what lib/brain-mind.js knowledgeOf keeps on this device, and Forget clears it. An owner
// key ("unlock" and a long key) is never logged. selfOf gets counts only, never the words.
// Pure: no DOM, no clock (every time is passed in), no Math.random.
import { cleanWords } from './brain-organs.js';
import { deposit } from './brain-workspace.js';

export const MAX = 60, ASK_MAX = 160, ANSWER_MAX = 240, DAY = 86400000, GAP = 10 * 60000, FOLLOW_DAYS = 30, REPEAT = 0.8, MATCH_MS = 5 * 60000;
const KEY_ASK = /^\s*(?:unlock\s*)+\S{16,}/i;

/** an empty log. */
export const makeDialogue = () => ({ log: [], pending: [], repeats: 0, follows: 0, since: 0 });
/** the UTC day number of a time. */
export const dayOf = (at) => Math.floor(at / DAY);
/** an answer's first words as plain text: tags, markdown marks and spare space gone, at most ANSWER_MAX characters. */
export const snippet = (text) => String(text == null ? '' : text).replace(/<[^>]*>/g, ' ').replace(/[#*_`>[\]]+/g, ' ').replace(/\(https?:[^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, ANSWER_MAX);
const same = (a, b) => { if (!a.length || !b.length) return 0; const B = new Set(b); let n = 0; for (const w of new Set(a)) if (B.has(w)) n++; return n / new Set([...a, ...b]).size; };
const flat = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** what `ask` at time `at` builds on in the log: { kind: 'repeat' | 'follow', entry } or null. Pure. */
export function recall(D, ask, at) {
  const words = cleanWords(ask), f = flat(ask);
  if (!f) return null;
  for (let i = D.log.length - 1; i >= 0; i--) {
    const e = D.log[i];
    if (!(at - e.at >= GAP || dayOf(at) !== e.day)) continue;
    if (flat(e.ask) === f || (words.length && same(words, e.words) >= REPEAT)) return { kind: 'repeat', entry: e };
  }
  if (!words.length) return null;
  for (let i = D.log.length - 1; i >= 0; i--) {
    const e = D.log[i]; if (at - e.at > FOLLOW_DAYS * DAY) break;
    if (flat(e.ask) === f || same(words, e.words) >= REPEAT) continue; // asked again inside GAP: not a follow-up of itself
    const near = new Set([...e.words, ...cleanWords(e.answer || '')]);
    if (words.some((w) => near.has(w))) return { kind: 'follow', entry: e };
  }
  return null;
}

/** the visitor asked `ask` at `at`: it is logged, and what it builds on is returned ({ kind, entry } or null). An owner key is not logged. */
export function heard(D, ask, at) {
  const t = String(ask == null ? '' : ask).trim().slice(0, ASK_MAX);
  if (!t || KEY_ASK.test(t) || !Number.isFinite(at)) return null;
  const r = recall(D, t, at);
  // the same ask again inside GAP says the last answer did not do: that entry is not kept
  for (let i = D.log.length - 1; i >= 0; i--) { const e = D.log[i]; if (at - e.at >= GAP) break; if (flat(e.ask) === flat(t)) e.again = true; }
  const entry = { ask: t, at, day: dayOf(at), words: cleanWords(t), answer: null };
  if (r) { entry.link = { kind: r.kind, at: r.entry.at }; if (r.kind === 'repeat') D.repeats++; else D.follows++; D.pending.push(r.entry.words.slice()); if (D.pending.length > 4) D.pending.shift(); }
  D.log.push(entry); if (D.log.length > MAX) D.log.splice(0, D.log.length - MAX);
  return r ? { kind: r.kind, entry: { ...r.entry } } : null;
}

/** the answer engine showed `answer` for `ask` at `at`: the newest unanswered entry with that ask (asked inside MATCH_MS) gets the answer.
 *  Returns null when no entry matches, or { kind, prior, same } where kind is 'repeat', 'follow' or null, prior is the entry it built on
 *  ({ ask, at, answer }) and same says whether this answer starts as the earlier one did (repeats only). */
export function answered(D, ask, answer, at) {
  const f = flat(ask), s = snippet(answer); if (!f || !s) return null;
  let e = null; for (let i = D.log.length - 1; i >= 0; i--) { const x = D.log[i]; if (at - x.at > MATCH_MS) break; if (x.answer == null && flat(x.ask) === f) { e = x; break; } }
  if (!e) return null;
  e.answer = s;
  const p = e.link ? D.log.find((x) => x.at === e.link.at) || null : null;
  const out = { kind: e.link && p ? e.link.kind : null, prior: p ? { ask: p.ask, at: p.at, answer: p.answer } : null, same: null };
  if (out.kind === 'repeat' && p && p.answer) out.same = flat(p.answer).slice(0, 120) === flat(s).slice(0, 120);
  return out;
}

/** the counts, at time `at`: asks logged, answered, repeats and follow-ups heard, follow-ups kept (answered, not asked again within GAP,
 *  and GAP has passed), the separate days those fell on, and whether the proxy holds (kept follow-ups on 2 or more days). Pure. */
export function dialogueStats(D, at) {
  const kept = D.log.filter((e) => e.link && e.link.kind === 'follow' && e.answer && !e.again && at - e.at >= GAP);
  const days = new Set(kept.map((e) => e.day)).size;
  return { asks: D.log.length, answered: D.log.filter((e) => e.answer).length, repeats: D.repeats, follows: D.follows, kept: kept.length, days, met: days >= 2 };
}

/** what is kept on this device (lib/brain-mind.js knowledgeOf): the log and the two counts. */
export const dialogueOf = (D) => ({ log: D.log.map((e) => ({ ask: e.ask, at: e.at, answer: e.answer, ...(e.link ? { link: e.link } : {}), ...(e.again ? { again: true } : {}) })), repeats: D.repeats, follows: D.follows });
/** put a kept log back. A wrong shape changes nothing. Returns true when it restored entries. */
export function loadDialogue(D, k) {
  if (!k || !Array.isArray(k.log)) return false;
  const log = k.log.filter((e) => e && typeof e.ask === 'string' && e.ask.trim() && !KEY_ASK.test(e.ask) && Number.isFinite(e.at) && (e.answer == null || typeof e.answer === 'string'))
    .slice(-MAX).map((e) => ({ ask: e.ask.slice(0, ASK_MAX), at: e.at, day: dayOf(e.at), words: cleanWords(e.ask), answer: e.answer == null ? null : snippet(e.answer),
      ...(e.link && (e.link.kind === 'repeat' || e.link.kind === 'follow') && Number.isFinite(e.link.at) ? { link: { kind: e.link.kind, at: e.link.at } } : {}), ...(e.again === true ? { again: true } : {}) }));
  if (!log.length) return false;
  D.log = log; D.repeats = Number.isInteger(k.repeats) && k.repeats >= 0 ? k.repeats : 0; D.follows = Number.isInteger(k.follows) && k.follows >= 0 ? k.follows : 0;
  return true;
}
/** Forget: the log and its counts are gone. */
export const forgetDialogue = (D) => { D.log = []; D.pending = []; D.repeats = 0; D.follows = 0; return D; };

export const dialogue = {
  id: 'dialogue', name: 'Dialogue', job: 'remembers what this visitor asked and what Verse answered, so a repeated ask or a follow-up builds on the first one',
  want: (b) => (b.dialogue.pending.length ? 0.6 : 0),
  rests: (b) => !b.dialogue.pending.length, // with no recalled ask it takes no run from the others
  run(b) {
    const D = b.dialogue, words = D.pending.shift(); if (!words) return 0;
    const C = b.concepts, N = b.ws.nodes; let lit = 0, sx = 0, sy = 0;
    for (const w of words) {
      const i = C.words.indexOf(w); if (i < 0) continue;
      const n = C.node[i]; N.act[n] = Math.max(N.act[n], 0.8); deposit(b.ws, 'memory', N.x[n], N.y[n], 0.05, 1.5, 'dialogue'); sx += N.x[n]; sy += N.y[n]; lit++;
    }
    if (lit) b.board.dialogue = { x: sx / lit, y: sy / lit, lit, tick: b.ticks };
    return lit ? 1 : 0;
  }
};
