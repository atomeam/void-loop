// Forge, component B: three competing mutations of one skill's routing. No git branch is spawned and no
// skill file is edited here: a candidate is data ({ strategy, patterns, note }) that the tournament can
// apply to an in-memory router. That keeps the loop cheap, reversible and safe to run on a timer. The
// champion's patterns are the patch a builder (or the existing verified promotion lane) puts in code.
//
// A (conservative): whole-phrase anchors, one per missed ask. Small, precise, no collateral routing.
// B (adaptive): content-word regexes, so a person can phrase the same intent differently.
// C (synthesis): one alternation of every missed phrase, cheapest to add but easiest to overreach.

import { words } from './evolve-adversary.mjs';

export const escapeRe = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Regexes from the asks the baseline missed. Pure. */
export function mutations({ name, missed = [], cap = 24 } = {}) {
  const asks = [...new Set((Array.isArray(missed) ? missed : []).map((r) => String((r && r.ask) || r || '').trim()).filter(Boolean))]
    .slice(0, Math.max(1, cap | 0 || 24));
  if (!asks.length) return [];
  const exact = asks.map((a) => '^' + escapeRe(a) + '$');
  const tokens = asks.map((a) => {
    const w = words(a).slice(0, 4);
    return w.length > 1 ? '\\b' + w.map(escapeRe).join('\\b.*\\b') + '\\b' : (w[0] ? '\\b' + escapeRe(w[0]) + '\\b' : '^' + escapeRe(a) + '$');
  });
  const uniqueTokens = [...new Set(tokens)];
  const alternation = '(?:' + asks.map(escapeRe).join('|') + ')';
  return [
    { strategy: 'conservative', skill: name, patterns: exact, flags: 'i', note: 'exact phrases that missed, anchored' },
    { strategy: 'adaptive', skill: name, patterns: uniqueTokens, flags: 'i', note: 'content-word backoff for the same intents' },
    { strategy: 'synthesis', skill: name, patterns: [alternation], flags: 'i', note: 'one alternation of every missed phrase' },
  ];
}

/** Source length, the entropy tax's input: a mutation that solves a case in four characters beats one in fifty. Pure. */
export const addedChars = (candidate) => (candidate && Array.isArray(candidate.patterns) ? candidate.patterns : [])
  .reduce((n, p) => n + String(p).length, 0);
