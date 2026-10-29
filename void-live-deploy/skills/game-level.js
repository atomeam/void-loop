/**
 * game-level — one Verse opponent strength shared by every game in the Games family (Adam, 2026-10-15: "board games can
 * all be combined"). The games card (skills/rack.js) sets it; each game asks it before Verse moves.
 *   getLevel() -> 'easy' | 'normal' | 'hard'      setLevel(l)      levelPick(best, options) -> a move
 * Hard always plays Verse's best move. Normal sometimes plays a random legal move; easy often does. Pure apart from the
 * saved choice (localStorage, absent in tests and workers, where the level is 'hard' so self-play and tests stay exact).
 */
export const LEVELS = ['easy', 'normal', 'hard'];
const KEY = 'void.games.level';
const SLIP = { easy: 0.5, normal: 0.15, hard: 0 };
export function getLevel() {
  try { const l = globalThis.localStorage && localStorage.getItem(KEY); return LEVELS.includes(l) ? l : (globalThis.localStorage ? 'normal' : 'hard'); } catch (_) { return 'hard'; }
}
export function setLevel(l) { try { if (LEVELS.includes(l)) localStorage.setItem(KEY, l); } catch (_) { /* private mode: stays for this page only */ } return getLevel(); }
export function levelPick(best, options, level = getLevel(), rnd = Math.random) {
  const opts = (options || []).filter((o) => o !== undefined && o !== null);
  if (!opts.length || rnd() >= (SLIP[level] || 0)) return best;
  return opts[Math.floor(rnd() * opts.length)];
}
