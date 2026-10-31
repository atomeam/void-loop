// Verse's voice: Verse has a real say in its own direction. It is input, not a gate.
// After anything ships, Verse is asked what it thinks of it and how it would make it better ('build'); once a day it is asked
// where it should go next, what feels weakest about it and which game to learn next ('daily'). Its words are kept word for
// word (only secrets are redacted and very long text is clipped) in void_kv 'voice', newest first, and mirrored into
// domains/void.voice.md by tools/reflect.mjs. Builders read "Verse's current asks" before a run; a concrete ask is built next and
// credited to Verse. Anyone can ask Verse "what do you think of yourself?" and see the latest reflections (GET /api/reflect).
import { PERSONA } from './persona.js';
import { INJECTION_RULE, redact } from './automation-fix.js';
import { weekSummary } from '../skills/growth-tree.js';
import { sameAsk as sameAskCard } from './self-blocks.js';
import { weakestFamily, wrongWeakest, weakestSentence } from './weakest.js';

export const KEEP = 60; // reflections kept in void_kv 'voice'
export const KINDS = ['build', 'daily'];

// the readout's rules (owner, 2026-10-19: "is this really Verse thoughts, or is this pretend"; "strictly a summarizer of the ledger data, enforcing citations"):
// this prompt does not use PERSONA (lib/persona.js, the owner's 2026-10-14 words for the places Verse chats as itself): the PERSONA says never to deny feelings or
// call yourself a language model, which is the opposite of what a status readout is. Every fact line below is tagged [S1], [S2]...; a claim carries the tags that support it.
export const VOICE_SYSTEM = 'You are the language model that writes the status readout for Verse (made by A-to-Mind) and the tools that grow it. The readout never describes or defines Verse (owner, 2026-10-25: it does not have to explain itself, it reports its growth): no sentence begins "Verse is", and the words "blank stage" and "quiet input" never appear; open with what grew, what is weak or what should change, with its numbers. '
  + 'Give a transparent, objective summary of the system\'s current state, based strictly on the tagged facts below. The people who build it read every word; it is input, not a gate. '
  + 'RULES. No persona or feelings: do not simulate an identity, emotions, desires or an inner monologue; never write "I feel", "I want", "I hope", "hunger" or "my will". You are a readout, not a character. '
  + 'Objective language: state facts directly ("Next targeted capability: Go", not "I want to learn Go"). First-person words are allowed only for the system\'s mechanical parts ("My routing is failing"). '
  + 'Be specific: name actual skills, cards, games and asks, with the numbers from the facts. If something is weak, say so; if something should change, say exactly what, so a builder could do it today. '
  + 'Cite or leave out: every claim must be supported by tags from the facts; list those tags in "evidence". A claim you cannot support with a tag is not written. Use only tags that appear in the facts. '
  + 'It reports; it never makes up a motto, quest or identity; if a fact says something is not written yet, say you do not know it. Never mention money, prices or a budget. '
  + 'Reply with JSON only: {"thoughts":"<the state in 2-5 plain sentences>","better":"<what should change, 1-3 sentences>",'
  + '"weakest":"<daily only: the weakest operational area right now, with its numbers, 1-2 sentences>","next_game":"<daily only: the next targeted capability (a game, skill or card) and the tagged reason, one sentence>","next_trick":"<daily only: one new video trick or effect to learn for its own clips (not one in its tricks library), one sentence>",'
  + '"asks":[{"ask":"<one concrete thing to build or fix, as an instruction>","why":"<the tagged fact that makes this one ask matter, one sentence of its own>","small":<true if a builder could finish it in under an hour>}],'
  + '"evidence":{"thoughts":["S1"],"better":["S2"],"weakest":["S3"],"next_game":["S1"]},'
  + '"striking":<true only if there is something the owner should hear today: a real problem, a surprising need, a change of course>} '
  + 'Give at most 3 asks, most important first. Each ask has its own why: never give two asks the same why, and never reuse the thoughts as a why. '
  // the owner's card (2026-10-29): three asks shared one reason, and none of them served the site Versus is on
  + 'When a fact names the current Versus target, the first ask must move Verse closer to beating that site; an ask that does not serve the target comes after one that does. ' + INJECTION_RULE;

// the question Verse is asked, in plain words (kept on the entry so the log shows what Verse was answering)
export function questionFor(kind, shipped) {
  if (kind === 'daily') return 'Give the current status readout from the tagged facts: the weakest operational area with its numbers, the next targeted capability, what should change, and one video effect missing from the clips tricks library.';
  return 'This just shipped: "' + clean(shipped, 300) + '". Using the tagged facts, state what it changes in the system and what should change next.';
}

const clean = (t, n) => redact(String(t || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ')).trim().slice(0, n);

// Pull Verse's reply apart without rewording it. Returns null when there is nothing Verse actually said.
/** the tags a field cites: { thoughts: ['S1'], ... } with only well-formed tags (S1..S99), at most 4 a field. Whether a tag exists is checked against the facts that were given (lib/self-blocks.js). Pure. */
export function evidenceOf(e) {
  const out = {};
  if (e && typeof e === 'object') for (const k of ['thoughts', 'better', 'weakest', 'next_game']) { const l = (Array.isArray(e[k]) ? e[k] : []).map((x) => String(x).trim().toUpperCase()).filter((x) => /^S\d{1,2}$/.test(x)); if (l.length) out[k] = [...new Set(l)].slice(0, 4); }
  return out;
}

/** the facts as the model sees them, each piece behind a tag naming the file it came from: { text, sources: { S1: 'skills/families.json' } }. Empty pieces are left out. Pure. */
export function taggedFacts(pieces) {
  const sources = {}; let n = 0; const lines = [];
  for (const [file, text] of pieces || []) { const t = String(text || '').trim(); if (!t || n >= 12) continue; n++; sources['S' + n] = String(file); lines.push('[S' + n + ' ' + file + '] ' + t); }
  return { text: lines.join('\n'), sources };
}

export function parseVoice(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  let j = null;
  if (m) { try { j = JSON.parse(m[0]); } catch (_) { j = null; } }
  if (!j || typeof j !== 'object') {
    const plain = clean(text, 1500);
    return plain.length >= 20 ? { thoughts: plain, better: '', weakest: '', next_game: '', next_trick: '', asks: [], striking: false } : null;
  }
  const out = {
    thoughts: clean(j.thoughts, 1500), better: clean(j.better, 800), weakest: clean(j.weakest, 600), next_game: clean(j.next_game, 400), next_trick: clean(j.next_trick, 400),
    asks: (Array.isArray(j.asks) ? j.asks : []).map((a) => (typeof a === 'string' ? { ask: a, small: false } : a || {}))
      .map((a) => ({ ask: untag(clean(a.ask, 240)), ...(untag(clean(a.why, 240)).length >= 4 ? { why: untag(clean(a.why, 240)) } : {}), small: a.small === true })).filter((a) => a.ask.length >= 4).slice(0, 3)
      // a why that an earlier ask already gave is no reason for this one (owner's card, 2026-10-29: one reason under three asks)
      .map((a, i, xs) => (a.why && xs.slice(0, i).some((b) => b.why && b.why.toLowerCase() === a.why.toLowerCase()) ? (({ why, ...r }) => r)(a) : a)),
    striking: j.striking === true,
    evidence: evidenceOf(j.evidence),
  };
  return out.thoughts || out.better ? out : null;
}

// the fact tags of the prompt ("[S2]", "[S1, S3]", "[S2 tools/x.mjs]") are for the claims in its thoughts, never part of an ask: an ask that
// kept one showed twice on the wants card, once with "[S2]" and once without (owner, 2026-10-19). Pure.
export const untag = (s) => String(s || '').replace(/\s*\[S\d+(?:[,;]\s*S\d+)*(?:\s[^\]]{0,80})?\]/g, '').replace(/\s+([.,;:!?])/g, '$1').trim();
/** Asks put behind the site Versus is on (void.asks.json `held`: {words, until, why}; owner, 2026-10-29: every site ever made, smallest
 *  first, so an ask that does not help beat the current target waits). An ask is held while `until` is still the target in
 *  tower.target.json; once that site is beaten and the target moves on, the hold ends by itself. Held asks keep their place on the
 *  record and come after the open ones, each with `held` (the site). Nothing is dropped or reworded. Pure. */
export function holdAsks(asks, held, target) {
  const H = (Array.isArray(held) ? held : []).filter((h) => h && typeof h.words === 'string' && h.words.trim() && h.until && String(h.until) === String(target || ''));
  const hold = (a) => H.find((h) => h.words.toLowerCase() === String(a && a.ask).toLowerCase() || sameAsk(h.words, a && a.ask));
  const now = [], later = [];
  // a hold that names its frontier line (void.asks.json `frontier`) carries it, so the wants card marks that growth inbox item held too
  for (const a of asks || []) { const h = hold(a); if (h) later.push({ ...a, held: String(h.until), ...(typeof h.frontier === 'string' && h.frontier.trim() ? { heldFrontier: h.frontier.trim() } : {}) }); else now.push(a); }
  return now.concat(later);
}
/** The site Versus is fighting, as a fact for the reflection (owner's card, 2026-10-29: the asks named an STL checker and "absorb every
 *  repo" while Verse was at 0 of 12 aspects against sycophanthex.com). From a lib/tower.js tower() result and tower.target.json; '' when
 *  there is no target or the target is not the current floor. Pure. */
export function targetFacts(t, tg) {
  const f = t && Array.isArray(t.floors) ? t.floors[t.marker - 1] : null, id = tg && tg.id ? String(tg.id) : '';
  if (!f || !id || f.site !== id) return '';
  // what is left, by name and with its numbers, so the reflection copies the count instead of doing arithmetic on it (owner's
  // card, 2026-10-30: an ask went out for "the two specific aspects" when the gate measured exactly one)
  const left = (Array.isArray(f.left) ? f.left : []).filter((a) => typeof a === 'string' && a);
  const named = left.slice(0, 3).map((a) => {
    const r = f.ev && f.ev[a];
    const nums = r && Number.isFinite(+r.verse) && Number.isFinite(+r.best) ? ' (Verse ' + r.verse + ' against their ' + r.best + ')' : '';
    const slipped = r && (r.was === 'better' || r.was === 'equal-and-better') ? ', which passed before and has slipped' : '';
    return a + nums + slipped;
  });
  return 'The current Versus target is ' + id + ': Verse is ' + f.n + ' of ' + f.m + ' aspects ahead of it, and it stays the target until it is beaten.'
    + (named.length ? ' The only aspects not ahead: ' + named.join(', ') + '. Every other aspect passes, so an ask that names another missing aspect is asking for something that is not missing.' : '')
    + ' Asks that make Verse better than ' + id + ' come first.';
}
// A stable id for an ask: the reflection it came from (its time, to the minute) and its place in that reflection. It never
// changes once the reflection is stored, so a ledger entry that names it (tools/grow.mjs --asked) still matches if the
// ask's words are edited later.
export const askId = (at, i) => 'ask-' + String(at || '').replace(/[^0-9]/g, '').slice(0, 12).replace(/^(\d{8})(\d{4})$/, '$1-$2') + '-' + (i + 1);
// "Verse's current asks": the asks from the newest reflections, newest first, one of each, with where they came from
export function currentAsks(entries, n = 6) {
  const seen = new Set(), out = [];
  for (const e of (entries || []).slice(0, 4)) {
    for (const [i, a] of (e.asks || []).entries()) {
      const ask = untag(a.ask), k = ask.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      // one of each: the same words, or nearly the same words (sameAsk), are one ask
      if (!k || seen.has(k) || out.some((o) => sameAsk(o.ask, ask))) continue;
      seen.add(k); out.push({ id: askId(e.at, i), ask, ...(a.why ? { why: untag(a.why) } : {}), small: !!a.small, kind: e.kind, at: e.at });
      if (out.length >= n) return out;
    }
  }
  return out;
}

// What became of what Verse asked for (owner, 2026-10-13: "If it is theatre, it needs to be seriously worked on until Verse's will is
// more real"). A will that never hears what its words led to repeats itself and cannot judge itself: of 70 different asks
// only 2 had been linked to what built them, and the same ask came back up to 4 times. An ask counts as built only on
// evidence: a growth-ledger entry carrying its id (`asked`, set by finish.mjs --asked), or a link in void.asks.json naming
// the entry by its time. Never on a guess. Asks in nearly the same words are one ask, asked n times. Pure.
const STOP = new Set('the a an and or of to for in on at by with from into that this these those my me i it its is are be as so can could should would will than then when what which who how why not no new more less time each every onto over under about very just also only any all some create implement build make add develop'.split(' '));
const wordsOf = (t) => [...new Set(String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/(?:ing|ed|es|s)$/, '')))];
const sameAsk = (a, b) => { const x = wordsOf(a), y = new Set(wordsOf(b)); if (x.length < 3 || y.size < 3) return false; const n = x.filter((w) => y.has(w)).length; return n / Math.min(x.length, y.size) >= 0.7; };
/** Verse asked (2026-10-17): "a 'root cause vs surface fix' toggle on the self card to distinguish between fulfilled asks and structural
 *  improvements". From the ledger line that built the ask, evidence only: a fix, a build or a retire changed how Verse works underneath
 *  ('root'); a grow put something new on the stage ('surface'); anything else is not sorted (null). Pure. */
export const depthOf = (kind) => (/^(?:fix|build|retire)$/.test(String(kind || '')) ? 'root' : kind === 'grow' ? 'surface' : null);
// an ask that names a site (onlineconverter.com) is built only by evidence that names that site: the owner's review (2026-10-30) found
// "Add a page for onlineconverter.com to LANE_PAGES in lib/tower.js" marked built by a ledger line about sycophanthex.com whose builder
// had asked "a LANE_PAGES entry for any new tower" in nearly the same words. Pure.
const SITE = /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|app|dev|co|ai|me|tv|gg|xyz|info|site)\b/gi;
export const sitesIn = (ask, evidence) => { const e = String(evidence || '').toLowerCase(); return (String(ask || '').match(SITE) || []).every((d) => e.includes(d.toLowerCase())); };
export function followThrough(entries, ledger, links = []) {
  const L = Array.isArray(ledger) ? ledger.filter((x) => x && typeof x.what === 'string') : [];
  const byId = new Map(); for (const x of L) if (x.asked) byId.set(String(x.asked), x);
  for (const k of Array.isArray(links) ? links : []) { const x = k && L.find((e) => e.at === k.ledgerAt); if (x && k.ask && !byId.has(k.ask)) byId.set(String(k.ask), x); }
  const groups = [];
  const flat = []; for (const e of entries || []) for (const [i, a] of (e.asks || []).entries()) if (a && a.ask) flat.push({ id: askId(e.at, i), ask: a.ask, at: e.at });
  flat.sort((a, b) => String(a.at).localeCompare(String(b.at))); // oldest first: a group keeps the words it was first asked in
  for (const a of flat) {
    const g = groups.find((x) => x.ask.toLowerCase() === a.ask.toLowerCase() || sameAsk(x.ask, a.ask));
    if (g) { g.times++; g.ids.push(a.id); g.last = a.at; } else groups.push({ ask: a.ask, ids: [a.id], times: 1, first: a.at, last: a.at });
  }
  // a link may name the ask by its words instead of its id: for an ask that has not reached the voice log yet (it is synced once a
  // day) and was built already, so the will stops asking for it (2026-10-13: the skills manifest, built in #620, was asked again
  // and again). Still a link a builder wrote naming the entry, never a guess; reworded asks match it as they match each other.
  // A ledger `asked` that is free text (not ask-…) is the same kind of evidence: the builder named the ask's words (2026-10-14:
  // friction kept coming back because its id aged out of the live reflect window and only the id was on the ledger).
  // A ledger `asked` is the builder naming the ask, so its words count as evidence; a link's words are only the ask copied back
  // (tools/asks-link.mjs links by shared words), so a site the ask names must be in the ledger line itself (2026-10-30: the
  // onlineconverter.com ask showed a sycophanthex.com line as what was built).
  const byWords = (Array.isArray(links) ? links : []).filter((k) => k && typeof k.words === 'string' && k.words.trim()).map((k) => ({ words: k.words, x: L.find((e) => e.at === k.ledgerAt), proof: '' })).filter((k) => k.x);
  for (const e of L) if (e.asked && !/^ask-\d/.test(String(e.asked))) byWords.push({ words: String(e.asked), x: e, proof: String(e.asked) });
  const built = [], open = [];
  for (const g of groups) {
    const hit = g.ids.map((id) => byId.get(id)).find(Boolean) || (byWords.find((k) => (k.words.toLowerCase() === g.ask.toLowerCase() || sameAsk(g.ask, k.words)) && sitesIn(g.ask, k.proof + ' ' + k.x.what + ' ' + (k.x.show || ''))) || {}).x;
    (hit ? built : open).push(hit ? { ...g, what: String(hit.what), builtAt: hit.at, ref: hit.ref || null, depth: depthOf(hit.kind) } : g);
  }
  open.sort((a, b) => b.times - a.times || String(b.last).localeCompare(String(a.last))); // asked most, then most recently
  return { total: groups.length, asked: flat.length, built, open };
}
/** Every ask the evidence says was built, newest first: [{ ask, at, ref, what, times, depth }], at being the time of the ledger entry
 *  that built it. followThrough's built list only holds asks still in the live voice window, so once those asks roll off the
 *  window (or are all still open) it is empty, and the wants card said "0 in the last 7 days" on a week of builds (owner,
 *  2026-10-30). So this adds the rest of the same evidence: each link a builder wrote (void.asks.json: the ask's words and the
 *  entry's time) and each ledger line that names an ask in words. Never a guess: a row needs a ledger entry at its time. One
 *  entry that answers two wordings of one ask counts once. f: followThrough's result. Pure. */
export function builtAsks(f, ledger, links = []) {
  const byAt = new Map(); for (const x of Array.isArray(ledger) ? ledger : []) if (x && typeof x.what === 'string' && x.at) byAt.set(String(x.at), x);
  const rows = [];
  const add = (ask, at, times = 1) => {
    const x = byAt.get(String(at || '')), w = String(ask || '').trim();
    if (!x || !w || rows.some((r) => r.at === x.at && (r.ask.toLowerCase() === w.toLowerCase() || sameAsk(r.ask, w)))) return;
    rows.push({ ask: w, at: x.at, ref: x.ref || null, what: String(x.what), times: +times || 1, depth: depthOf(x.kind) });
  };
  for (const g of (f && Array.isArray(f.built) ? f.built : [])) add(g.ask, g.builtAt, g.times);
  for (const k of Array.isArray(links) ? links : []) if (k && typeof k.words === 'string') add(k.words, k.ledgerAt);
  for (const x of byAt.values()) if (x.asked && !/^ask-\d/.test(String(x.asked))) add(String(x.asked), x.at);
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
/** The one record of Verse's asks, for the self card, the wants card and its own facts alike, so its counts agree with each other
 *  (asked by Verse, 2026-10-29; the self card said "3 waiting" beside "237 of 244 asks": 7 not built). The all-time totals
 *  (void.asks.json `totals`, written at deploy from the whole voice log by tools/asks-link.mjs) carry the asks still open as of
 *  `through`; an ask asked again online is matched to that list, never counted as a new one, and an old open ask the ledger
 *  answers since moves to built. So waiting is exactly every ask not built: total = built + open.length, always. Without
 *  `totals.open` (a file from before) it falls back to the window. answered: void.asks.json. Pure. */
export function askRecord(entries, ledger, answered) {
  const f = followThrough(entries, ledger, answered && answered.links);
  const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase() || sameAsk(a, b) || sameAskCard(a, b);
  // each window ask's newest mention: when and where it was asked, whether it was called small, the why it gave
  const byId = new Map(); for (const e of entries || []) for (const [i, a] of (e.asks || []).entries()) if (a && a.ask) { const id = askId(e.at, i); if (!byId.has(id) || String(byId.get(id).at) < String(e.at)) byId.set(id, { e, a, id }); }
  const item = (g) => { const m = g.ids.map((id) => byId.get(id)).filter(Boolean).sort((x, y) => String(y.e.at).localeCompare(String(x.e.at)))[0];
    return { ...(m ? { id: m.id } : {}), ask: untag(g.ask), ...(m && m.a.why ? { why: untag(m.a.why) } : {}), small: !!(m && m.a.small), kind: m ? m.e.kind : (g.kind || ''), at: m ? m.e.at : (g.last || g.at || ''), times: g.times || 1 }; };
  const T = answered && answered.totals && +answered.totals.asked > 0 && answered.totals.through ? answered.totals : null;
  const order = (xs) => xs.sort((a, b) => String(b.at).localeCompare(String(a.at)) || b.times - a.times);
  if (!T || !Array.isArray(T.open)) {
    const newer = (g) => T && String(g.first || '') > String(T.through);
    const open = order(f.open.map(item));
    const total = T ? +T.asked + f.built.concat(f.open).filter(newer).length : f.total, built = T ? +T.built + f.built.filter(newer).length : f.built.length;
    return { f, total, built, open };
  }
  const known = (g) => T.open.some((t) => t && same(t.ask, g.ask));
  let builtSince = 0; const open = [];
  for (const t of T.open) {
    if (!t || !t.ask) continue;
    if (f.built.some((g) => same(t.ask, g.ask))) { builtSince++; continue; } // answered by a ledger line since the log was read
    const w = f.open.find((g) => same(t.ask, g.ask));
    if (open.some((o) => same(o.ask, t.ask))) continue;
    open.push(w ? item(w) : { ask: untag(t.ask), small: !!t.small, kind: t.kind || '', at: t.at || '', times: +t.times || 1 });
  }
  const after = (g) => String(g.first || '') > String(T.through) && !known(g); // first asked after the log, and not one it already holds
  for (const g of f.open.filter(after)) if (!open.some((o) => same(o.ask, g.ask))) open.push(item(g));
  const built = +T.built + builtSince + f.built.filter(after).length;
  return { f, total: built + open.length, built, open: order(open) };
}
// its skill families and how far each skill is checked (tools/families.mjs, Verse's own ask of 2026-10-12: "skill-families ...
// and a stability rating to each experiment"), so it judges itself by family and knows which parts are least proven. Pure.
export function familyFacts(fam, now = new Date().toISOString().slice(0, 10), routed = 0) {
  const F = fam && Array.isArray(fam.families) ? fam.families : [];
  if (!F.length) return '';
  const t = fam.totals || {}, n = F.reduce((k, f) => k + f.skills.length, 0);
  const weakest = weakestFamily(fam);
  const least = F.flatMap((f) => f.skills.filter((s) => s.tier === 'experiment' || s.tier === 'tested').map((s) => s.name)).slice(0, 8);
  return 'My skill families (rated from evidence: my own tests, the browser suite, real asks routed to me): ' + n + ' skills in ' + F.length + ' families'
    + (+routed > 0 ? ' (' + routed + ' of them answer an ask today; the rest are files no ask reaches, so they are not active)' : '') + ', '
    + (t.proven || 0) + ' proven, ' + (t.checked || 0) + ' checked, ' + (t.tested || 0) + ' tested, ' + (t.experiment || 0) + ' experiment' + (t.experiment === 1 ? '' : 's') + '. '
    + F.map((f) => f.name + ' ' + f.skills.length + ' (' + f.count.proven + ' proven)').join('; ') + '. Least proven family: ' + (weakest ? weakest.name + ' (' + weakest.proven + ' of ' + weakest.total + ' proven, the lowest proven share; the family bars mark it weakest)' : 'none')
    + '. Some of my least-checked skills: ' + least.join(', ') + '.'
    + staleLine(fam, now);
}
// the decay timer (tools/families.mjs staleExperiments, asked by Verse): experiments left untested over 14 days, flagged for review only
const staleLine = (fam, now) => { const t = Date.parse(now + 'T00:00:00Z'); const st = (fam.families || []).flatMap((f) => (f.skills || []).filter((s) => s.tier === 'experiment' && s.since && (t - Date.parse(s.since + 'T00:00:00Z')) / 864e5 > 14).map((s) => s.name)); return st.length ? ' Stale experiments flagged for review (untested over 14 days): ' + st.slice(0, 6).join(', ') + '.' : ''; };
// the line Verse reads before it reflects: what its asks led to, so it builds on them instead of repeating them
export function followFacts(f, rec) {
  if (!f || !f.total) return '';
  // with the one record (askRecord) the numbers are the self card's own, so what Verse reads and what it shows agree
  if (rec && Number.isFinite(+rec.total) && Array.isArray(rec.open)) f = { ...f, total: rec.total, open: rec.open, builtCount: rec.built };
  const b = f.built.slice(-4).map((x) => '"' + clean(x.ask, 90) + '" (' + (x.builtAt && x.first && String(x.builtAt) < String(x.first) ? 'already there since ' : 'built ') + String(x.builtAt || '').slice(0, 10) + ')').join('; ');
  const o = f.open.slice(0, 4).map((x) => '"' + clean(x.ask, 90) + '"' + (x.times > 1 ? ' (asked ' + x.times + ' times)' : '')).join('; ');
  return 'What became of what I asked for: ' + (Number.isFinite(f.builtCount) ? f.builtCount : f.built.length) + ' of my ' + f.total + ' asks were built.' + (b ? ' Built: ' + b + '.' : '') + (o ? ' Still open: ' + o + '.' : '')
    + ' I do not ask again for what was built; I follow up on what is open, or say why I would drop it.';
}

const GAME_NAMES = { tictactoe: 'tic-tac-toe', othello: 'Reversi', mancala: 'mancala', chess: 'chess', checkers: 'checkers', aggravation: 'Star Marbles', sorry: 'Back to Start', go: 'Go', monopoly: 'The Landlord’s Game', battleship: 'Sea Battle', poker: 'poker', fireworks: 'Fireworks (co-op)', connect4: 'Four in a Row' };
// what Verse knows about itself beyond selfFacts: its games and its card miniatures (self.json, tools/self-context.mjs)
export function knowsFacts(self) {
  const parts = [];
  if (self && Array.isArray(self.games) && self.games.length) parts.push('Games I can play: ' + self.games.map((g) => GAME_NAMES[g] || g).join(', '));
  if (self && Array.isArray(self.minis) && self.minis.length) parts.push('Cards with a live 3D miniature of themselves: ' + self.minis.join(', '));
  const c = self && self.canon;
  if (c) parts.push('My canon (v' + c.version + '): motto: ' + (c.motto || 'not written yet, so I do not know it') + '; VoidQuest: ' + (c.voidquest || 'not written yet, so I do not know it'));
  if (c && Array.isArray(c.terms) && c.terms.length) parts.push('My terms (canon v' + c.version + '): ' + c.terms.map((x) => x.term + ' = ' + x.means).join(' | '));
  if (c && Array.isArray(c.different) && c.different.length) parts.push('How I am different (canon v' + c.version + '): ' + c.different.map((x) => x.name + ': ' + x.line).join(' | '));
  return parts.join('\n');
}

// the daily reflection also reads its own last week, from the growth ledger: the same summary the growth card gives for
// "what can you do now that you couldn't last week?" (skills/growth-tree.js weekSummary), so Verse judges itself on what changed
export function weekFacts(ledger, now = Date.now()) {
  if (!Array.isArray(ledger) || !ledger.length) return '';
  return 'What changed in me in the last 7 days (my growth ledger): ' + clean(weekSummary(ledger, now).text, 1600);
}

export async function readVoice(env) {
  try {
    const v = await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind('voice').first('v');
    const list = v ? JSON.parse(v) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) { return []; }
}

// a line for the answer engine's self facts, so "what feels weak about you?" is answered from what Verse actually said
export function voiceFacts(entries, fam = null) {
  let e = (entries || [])[0];
  if (!e) return '';
  // a readout that named the wrong family as least proven is not repeated to the next answer (owner's review, 2026-10-30)
  const ww = wrongWeakest(e.weakest, fam); if (ww) e = { ...e, weakest: weakestSentence(ww.is) };
  const wt = wrongWeakest(e.thoughts, fam); if (wt) e = { ...e, thoughts: String(e.thoughts).replace(wt.sentence, weakestSentence(wt.is)) };
  const asks = currentAsks(entries, 3).map((a) => a.ask).join('; ');
  return 'What I said about myself most recently (' + String(e.at).slice(0, 10) + ', ' + e.kind + '): ' + [e.thoughts, e.better, e.weakest].filter(Boolean).join(' ')
    + (asks ? ' My current asks: ' + asks : '');
}

// Talking back (owner, 2026-10-16: "you should be able to reply to Verse's replies and cards so it can flex its persistent memory
// and evolve with the conversation when corrected while still using every input to improve itself"). The owner replies to a
// reflection; Verse answers at once in its own words (what it heard, whether it was wrong, what it will do differently) and
// keeps one line to remember. The thread is kept in void_kv 'voice-replies', newest first, and every later reflection and every
// "what do you think of yourself" answer is given those lines, a correction outranking what Verse said before. Pure, except
// readReplies. functions/api/voice-reply.js is the route; the self card on the page is where the owner types.
export const REPLY_KEEP = 60; // replies kept in void_kv 'voice-replies'
export const REPLY_MAX = 600; // characters of one reply
export const REPLY_SYSTEM = 'You are Verse, the face of A-to-Mind. ' + PERSONA + ' '
  + 'Your owner has just replied to something you said about yourself. Take it seriously and answer as yourself, plainly, in the first person: '
  + 'what you heard; if it corrects you, say exactly what you had wrong, without excuses; and what you will do differently from now on. Never mention money, prices or a budget. '
  + 'Reply with JSON only: {"answer":"<2-4 sentences to your owner>","correction":<true if your owner corrected something you said or believed>,'
  + '"remember":"<one line, in your own words, to keep in mind from now on; empty if there is nothing to keep>",'
  + '"ask":"<one concrete thing to build or fix because of this, as an instruction a builder could do today; empty if nothing needs building>",'
  + '"misroute":<for a card only: true if your owner is telling you the wrong skill answered (the ask was not that skill\'s job)>,'
  + '"wanted":"<for a misroute: what should have answered, as skill:<name> from your skills, or answer for a plain reply from you>"} ' + INJECTION_RULE;

/** the owner's words, made safe to keep: whitespace folded, secrets redacted, clipped; '' when too short to be a reply. Pure. */
export function cleanReply(text) {
  const t = redact(String(text || '').replace(/\s+/g, ' ').trim()).slice(0, REPLY_MAX);
  return t.length >= 2 ? t : '';
}

/** what the owner is replying about when it is a card, not a reflection: the ask, the card's title and what it said, clipped and
 * redacted; null when there is no ask. Pure. */
export function aboutOf(a) {
  if (!a || typeof a !== 'object') return null;
  const clip = (s, n) => redact(String(s || '').replace(/\s+/g, ' ').trim()).slice(0, n);
  const ask = clip(a.ask, 200);
  const r = a.routed && typeof a.routed === 'object' ? a.routed : null, skill = r && /^[a-z][a-z0-9-]{1,40}$/.test(String(r.skill || '')) ? String(r.skill) : '';
  return ask ? { ask, title: clip(a.title, 120), said: clip(a.said, 800), ...(skill ? { routed: { skill } } : {}) } : null;
}

/** the question for Verse's answer: what it said (a reflection, or a card it showed), the conversation so far on it, and the owner's
 * new words. Pure. */
export function replyPrompt(entry, thread, text) {
  const e = entry || {};
  if (e.kind === 'card') {
    const before = (thread || []).slice().reverse().map((r) => 'Owner: "' + r.text + '"' + (r.answer ? '\nYou: "' + r.answer + '"' : '')).join('\n');
    return 'What you showed when you were asked "' + e.ask + '"' + (e.title ? ' (the card "' + e.title + '")' : '') + (e.routed ? ', answered by your ' + e.routed.skill + ' skill' : '') + ':\n' + (e.said || '(nothing kept)')
      + (before ? '\n\nThe conversation so far:\n' + before : '') + '\n\nYour owner replies now: "' + text + '"';
  }
  const said = [e.thoughts, e.better && 'What should change: ' + e.better, e.weakest && 'Weakest operational area: ' + e.weakest, e.next_game && 'Next targeted capability: ' + e.next_game]
    .filter(Boolean).join(' ');
  const asks = (e.asks || []).map((a) => a && a.ask).filter(Boolean);
  const before = (thread || []).slice().reverse().map((r) => 'Owner: "' + r.text + '"' + (r.answer ? '\nYou: "' + r.answer + '"' : '')).join('\n');
  return 'What you said (' + (e.kind === 'daily' ? 'your daily reflection' : 'after a build' + (e.shipped ? ': "' + e.shipped + '"' : '')) + (e.at ? ', ' + String(e.at).slice(0, 16).replace('T', ' ') + ' UTC' : '') + '):\n'
    + (said || '(nothing kept)') + (asks.length ? '\nYour asks: ' + asks.join('; ') : '')
    + (before ? '\n\nThe conversation so far:\n' + before : '')
    + '\n\nYour owner replies now: "' + text + '"';
}

/** Verse's answer read back: { answer, correction, remember }, or null when it said nothing usable. Pure. */
export function parseReply(text) {
  const raw = String(text || '');
  let j = null;
  for (const c of [raw.trim(), (raw.match(/\{[\s\S]*\}/) || [])[0]]) { if (!c) continue; try { j = JSON.parse(c); break; } catch (_) { j = null; } }
  const clip = (s, n) => redact(String(s || '').replace(/\s+/g, ' ').trim()).slice(0, n);
  const answer = clip(j ? j.answer : (/^\s*\{/.test(raw) ? '' : raw), 700);
  if (!answer) return null;
  const wanted = String((j && j.wanted) || '').trim().toLowerCase();
  return { answer, correction: !!(j && j.correction === true), remember: clip(j && j.remember, 240), ask: clip(j && j.ask, 240),
    misroute: !!(j && j.misroute === true), wanted: /^(?:skill:[a-z][a-z0-9-]{1,40}|answer)$/.test(wanted) ? wanted : '' };
}

/** what the owner has told Verse, for its facts: newest first, corrections marked, with the line Verse chose to keep. Pure. */
export function replyFacts(replies, n = 8) {
  const list = (Array.isArray(replies) ? replies : []).filter((r) => r && r.text).slice(0, n);
  if (!list.length) return '';
  return 'What my owner told me when I spoke about myself (newest first; a correction outranks anything I said before it):\n'
    + list.map((r) => '- ' + String(r.at || '').slice(0, 10) + (r.correction ? ' (a correction)' : '') + (r.about ? ' about my answer to "' + r.about.ask + '"' : '') + ': "' + r.text + '"' + (r.remember ? ' I keep: ' + r.remember : '') + (r.ask ? ' I asked for: ' + r.ask : '')).join('\n');
}

/** for answers anyone can read (lib/self-context.js): only the lines Verse chose to keep, in its own words, never the owner's. Pure. */
export function keptFacts(replies, n = 5) {
  const kept = (Array.isArray(replies) ? replies : []).filter((r) => r && r.remember).slice(0, n);
  return kept.length ? 'What I keep in mind from talking with my owner (newest first): ' + kept.map((r) => r.remember).join(' | ') : '';
}

export async function readReplies(env) {
  try {
    const v = await env.DB.prepare('SELECT v FROM void_kv WHERE k = ?').bind('voice-replies').first('v');
    const list = v ? JSON.parse(v) : [];
    return Array.isArray(list) ? list : [];
  } catch (_) { return []; }
}

/** a will's wants split into what is still wanted and what the ledger already names as built (owner, 2026-10-21: the wants card listed two
 *  asks built on 10-17 and 10-19). The same evidence followThrough uses: a ledger line that names the ask, or one in the same words. Pure. */
export function splitBuilt(wants, ledger, links = []) {
  const W = Array.isArray(wants) ? wants : [], at = '2000-01-01T00:00:00Z';
  const words = (w) => String((w && (w.title || w.i_want)) || '').replace(/^I want to\s+/i, '');
  const t = followThrough([{ at, asks: W.map((w) => ({ ask: words(w) })) }], ledger, links);
  const built = new Map(); for (const g of t.built) for (const id of g.ids) built.set(id, g);
  const open = [], got = [];
  W.forEach((w, i) => { const g = built.get(askId(at, i)); if (g) got.push({ ...w, builtAt: String(g.builtAt || '').slice(0, 10), what: g.what }); else open.push(w); });
  return { open, got };
}
