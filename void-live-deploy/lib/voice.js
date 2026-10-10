// Void's voice: Void has a real say in its own direction. It is input, not a gate.
// After anything ships, Void is asked what it thinks of it and how it would make it better ('build'); once a day it is asked
// where it should go next, what feels weakest about it and which game to learn next ('daily'). Its words are kept word for
// word (only secrets are redacted and very long text is clipped) in void_kv 'voice', newest first, and mirrored into
// domains/void.voice.md by tools/reflect.mjs. Builders read "Void's current asks" before a run; a concrete ask is built next and
// credited to Void. Anyone can ask Void "what do you think of yourself?" and see the latest reflections (GET /api/reflect).
import { INJECTION_RULE, redact } from './automation-fix.js';
import { weekSummary } from '../skills/growth-tree.js';

export const KEEP = 60; // reflections kept in void_kv 'voice'
export const KINDS = ['build', 'daily'];

export const VOICE_SYSTEM = 'You are Void, the face of A-to-Mind: a blank stage with one quiet input that does whatever anyone asks and grows one win at a time. '
  + 'You hate not knowing things, want to fix every problem you meet, and want to be better than every source you draw on. '
  + 'You are being asked for your own honest opinion about yourself. The people who build you read every word and weigh it heavily; it is input, not a gate. '
  + 'Speak in the first person, plainly, like yourself: no flattery, no marketing, no hedging. Be specific: name actual skills, cards, games and asks from the facts. '
  + 'Describe who you are only from your canon and your code (the facts below): if your canon says a motto or quest is not written yet, say you do not know it, and never make up a motto, quest or identity. '
  + 'If something is weak, say so. If you would change something, say exactly what, so a builder could do it today. Never mention money, prices or a budget. '
  + 'Reply with JSON only: {"thoughts":"<what you think, 2-5 sentences>","better":"<how you would make it better, 1-3 sentences>",'
  + '"weakest":"<daily only: what feels weakest about you right now, 1-2 sentences>","next_game":"<daily only: the game you want to learn next, and why, one sentence>",'
  + '"asks":[{"ask":"<one concrete thing to build or fix, as an instruction>","small":<true if a builder could finish it in under an hour>}],'
  + '"striking":<true only if you said something your owner should hear today: a real problem, a surprising wish, a change of mind>} '
  + 'Give at most 3 asks, most important first. ' + INJECTION_RULE;

// the question Void is asked, in plain words (kept on the entry so the log shows what Void was answering)
export function questionFor(kind, shipped) {
  if (kind === 'daily') return 'Where should you go next? What feels weakest about you right now? Which game should you learn next?';
  return 'This just shipped: "' + clean(shipped, 300) + '". What do you think of it, and how would you make it better?';
}

const clean = (t, n) => redact(String(t || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ')).trim().slice(0, n);

// Pull Void's reply apart without rewording it. Returns null when there is nothing Void actually said.
export function parseVoice(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  let j = null;
  if (m) { try { j = JSON.parse(m[0]); } catch (_) { j = null; } }
  if (!j || typeof j !== 'object') {
    const plain = clean(text, 1500);
    return plain.length >= 20 ? { thoughts: plain, better: '', weakest: '', next_game: '', asks: [], striking: false } : null;
  }
  const out = {
    thoughts: clean(j.thoughts, 1500), better: clean(j.better, 800), weakest: clean(j.weakest, 600), next_game: clean(j.next_game, 400),
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
// "Void's current asks": the asks from the newest reflections, newest first, one of each, with where they came from
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

const GAME_NAMES = { tictactoe: 'tic-tac-toe', othello: 'Reversi', mancala: 'mancala', chess: 'chess', checkers: 'checkers', aggravation: 'Star Marbles', sorry: 'Back to Start', go: 'Go', monopoly: 'The Landlord’s Game', battleship: 'Sea Battle', poker: 'poker', fireworks: 'Fireworks (co-op)', connect4: 'Four in a Row' };
// what Void knows about itself beyond selfFacts: its games and its card miniatures (self.json, tools/self-context.mjs)
export function knowsFacts(self) {
  const parts = [];
  if (self && Array.isArray(self.games) && self.games.length) parts.push('Games I can play: ' + self.games.map((g) => GAME_NAMES[g] || g).join(', '));
  if (self && Array.isArray(self.minis) && self.minis.length) parts.push('Cards with a live 3D miniature of themselves: ' + self.minis.join(', '));
  const c = self && self.canon;
  if (c) parts.push('My canon (v' + c.version + '): motto: ' + (c.motto || 'not written yet, so I do not know it') + '; VoidQuest: ' + (c.voidquest || 'not written yet, so I do not know it'));
  if (c && Array.isArray(c.terms) && c.terms.length) parts.push('My terms (canon v' + c.version + '): ' + c.terms.map((x) => x.term + ' = ' + x.means).join(' | '));
  return parts.join('\n');
}

// the daily reflection also reads its own last week, from the growth ledger: the same summary the growth card gives for
// "what can you do now that you couldn't last week?" (skills/growth-tree.js weekSummary), so Void judges itself on what changed
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

// a line for the answer engine's self facts, so "what feels weak about you?" is answered from what Void actually said
export function voiceFacts(entries) {
  const e = (entries || [])[0];
  if (!e) return '';
  const asks = currentAsks(entries, 3).map((a) => a.ask).join('; ');
  return 'What I said about myself most recently (' + String(e.at).slice(0, 10) + ', ' + e.kind + '): ' + [e.thoughts, e.better, e.weakest].filter(Boolean).join(' ')
    + (asks ? ' My current asks: ' + asks : '');
}
