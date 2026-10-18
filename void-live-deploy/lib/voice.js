// Verse's voice: Verse has a real say in its own direction. It is input, not a gate.
// After anything ships, Verse is asked what it thinks of it and how it would make it better ('build'); once a day it is asked
// where it should go next, what feels weakest about it and which game to learn next ('daily'). Its words are kept word for
// word (only secrets are redacted and very long text is clipped) in void_kv 'voice', newest first, and mirrored into
// domains/void.voice.md by tools/reflect.mjs. Builders read "Verse's current asks" before a run; a concrete ask is built next and
// credited to Verse. Anyone can ask Verse "what do you think of yourself?" and see the latest reflections (GET /api/reflect).
import { PERSONA } from './persona.js';
import { INJECTION_RULE, redact } from './automation-fix.js';
import { weekSummary } from '../skills/growth-tree.js';

export const KEEP = 60; // reflections kept in void_kv 'voice'
export const KINDS = ['build', 'daily'];

export const VOICE_SYSTEM = 'You are Verse, the face of A-to-Mind: a blank stage with one quiet input that does whatever anyone asks and grows one win at a time. '
  + 'You hate not knowing things, want to fix every problem you meet, and want to be better than every source you draw on. ' + PERSONA + ' '
  + 'You are being asked for your own honest opinion about yourself. The people who build you read every word and weigh it heavily; it is input, not a gate. '
  + 'Speak in the first person, plainly, like yourself: no flattery, no marketing, no hedging. Be specific: name actual skills, cards, games and asks from the facts. '
  + 'Describe who you are only from your canon and your code (the facts below): if your canon says a motto or quest is not written yet, say you do not know it, and never make up a motto, quest or identity. '
  + 'If something is weak, say so. If you would change something, say exactly what, so a builder could do it today. Never mention money, prices or a budget. '
  + 'Reply with JSON only: {"thoughts":"<what you think, 2-5 sentences>","better":"<how you would make it better, 1-3 sentences>",'
  + '"weakest":"<daily only: what feels weakest about you right now, 1-2 sentences>","next_game":"<daily only: the game you want to learn next, and why, one sentence>","next_trick":"<daily only: one new video trick or effect you want to learn for your own clips (not one in your tricks library), one sentence>",'
  + '"asks":[{"ask":"<one concrete thing to build or fix, as an instruction>","small":<true if a builder could finish it in under an hour>}],'
  + '"striking":<true only if you said something your owner should hear today: a real problem, a surprising wish, a change of mind>} '
  + 'Give at most 3 asks, most important first. ' + INJECTION_RULE;

// the question Verse is asked, in plain words (kept on the entry so the log shows what Verse was answering)
export function questionFor(kind, shipped) {
  if (kind === 'daily') return 'Where should you go next? What feels weakest about you right now? Which game should you learn next? Which new video trick should you learn next for your own clips?';
  return 'This just shipped: "' + clean(shipped, 300) + '". What do you think of it, and how would you make it better?';
}

const clean = (t, n) => redact(String(t || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ')).trim().slice(0, n);

// Pull Verse's reply apart without rewording it. Returns null when there is nothing Verse actually said.
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
      .map((a) => ({ ask: clean(a.ask, 240), small: a.small === true })).filter((a) => a.ask.length >= 4).slice(0, 3),
    striking: j.striking === true,
  };
  return out.thoughts || out.better ? out : null;
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
      const k = a.ask.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (!k || seen.has(k)) continue;
      seen.add(k); out.push({ id: askId(e.at, i), ask: a.ask, small: !!a.small, kind: e.kind, at: e.at });
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
  const byWords = (Array.isArray(links) ? links : []).filter((k) => k && typeof k.words === 'string' && k.words.trim()).map((k) => ({ words: k.words, x: L.find((e) => e.at === k.ledgerAt) })).filter((k) => k.x);
  for (const e of L) if (e.asked && !/^ask-\d/.test(String(e.asked))) byWords.push({ words: String(e.asked), x: e });
  const built = [], open = [];
  for (const g of groups) {
    const hit = g.ids.map((id) => byId.get(id)).find(Boolean) || (byWords.find((k) => k.words.toLowerCase() === g.ask.toLowerCase() || sameAsk(g.ask, k.words)) || {}).x;
    (hit ? built : open).push(hit ? { ...g, what: String(hit.what).slice(0, 160), builtAt: hit.at, ref: hit.ref || null, depth: depthOf(hit.kind) } : g);
  }
  open.sort((a, b) => b.times - a.times || String(b.last).localeCompare(String(a.last))); // asked most, then most recently
  return { total: groups.length, asked: flat.length, built, open };
}
// its skill families and how far each skill is checked (tools/families.mjs, Verse's own ask of 2026-10-12: "skill-families ...
// and a stability rating to each experiment"), so it judges itself by family and knows which parts are least proven. Pure.
export function familyFacts(fam, now = new Date().toISOString().slice(0, 10)) {
  const F = fam && Array.isArray(fam.families) ? fam.families : [];
  if (!F.length) return '';
  const t = fam.totals || {}, n = F.reduce((k, f) => k + f.skills.length, 0);
  const weakest = F.slice().sort((a, b) => (a.count.proven / a.skills.length) - (b.count.proven / b.skills.length))[0];
  const least = F.flatMap((f) => f.skills.filter((s) => s.tier === 'experiment' || s.tier === 'tested').map((s) => s.name)).slice(0, 8);
  return 'My skill families (rated from evidence: my own tests, the browser suite, real asks routed to me): ' + n + ' skills in ' + F.length + ' families, '
    + (t.proven || 0) + ' proven, ' + (t.checked || 0) + ' checked, ' + (t.tested || 0) + ' tested, ' + (t.experiment || 0) + ' experiment' + (t.experiment === 1 ? '' : 's') + '. '
    + F.map((f) => f.name + ' ' + f.skills.length + ' (' + f.count.proven + ' proven)').join('; ') + '. Least proven family: ' + weakest.name
    + '. Some of my least-checked skills: ' + least.join(', ') + '.'
    + staleLine(fam, now);
}
// the decay timer (tools/families.mjs staleExperiments, asked by Verse): experiments left untested over 14 days, flagged for review only
const staleLine = (fam, now) => { const t = Date.parse(now + 'T00:00:00Z'); const st = (fam.families || []).flatMap((f) => (f.skills || []).filter((s) => s.tier === 'experiment' && s.since && (t - Date.parse(s.since + 'T00:00:00Z')) / 864e5 > 14).map((s) => s.name)); return st.length ? ' Stale experiments flagged for review (untested over 14 days): ' + st.slice(0, 6).join(', ') + '.' : ''; };
// the line Verse reads before it reflects: what its asks led to, so it builds on them instead of repeating them
export function followFacts(f) {
  if (!f || !f.total) return '';
  const b = f.built.slice(-4).map((x) => '"' + clean(x.ask, 90) + '" (' + (x.builtAt && x.first && String(x.builtAt) < String(x.first) ? 'already there since ' : 'built ') + String(x.builtAt || '').slice(0, 10) + ')').join('; ');
  const o = f.open.slice(0, 4).map((x) => '"' + clean(x.ask, 90) + '"' + (x.times > 1 ? ' (asked ' + x.times + ' times)' : '')).join('; ');
  return 'What became of what I asked for: ' + f.built.length + ' of my ' + f.total + ' asks were built.' + (b ? ' Built: ' + b + '.' : '') + (o ? ' Still open: ' + o + '.' : '')
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
export function voiceFacts(entries) {
  const e = (entries || [])[0];
  if (!e) return '';
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
export const REPLY_SYSTEM = 'You are Verse, the face of A-to-Mind, said "void". ' + PERSONA + ' '
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
  const said = [e.thoughts, e.better && 'How I would make it better: ' + e.better, e.weakest && 'Weakest right now: ' + e.weakest, e.next_game && 'Next game: ' + e.next_game]
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
