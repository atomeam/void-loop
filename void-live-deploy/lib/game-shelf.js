// The game shelf: which games the Arcade shows up front. The owner (2026-11-20): "none of the games are good or fun". A hands-on
// review played every cabinet game on a phone and a desktop and marked eight things from 1 to 10: controls, time to fun, goal,
// challenge, juice (feedback, sound, effects), a reason to replay, polish, and bugs (10 is none). A game is listed only at MIN or
// better AND with a passing fun probe for its current update (tools/game-fun.mjs, checked by tools/game-audit.mjs). The rest stay
// playable under "Being rebuilt" until an update lifts them. Pure data.
export const MIN = 7;
export const MARKS = ['controls', 'start', 'goal', 'challenge', 'juice', 'replay', 'polish', 'bugs'];
const row = (update, m, why) => ({ update, marks: Object.fromEntries(MARKS.map((k, i) => [k, m[i]])), score: Math.round((m.reduce((a, b) => a + b, 0) / m.length) * 10) / 10, why });
export const SHELF = {
  'void-breaker': row(3, [8, 9, 8, 7, 8, 7, 7, 8], 'Rebuilt: shatter, shake, combo music, five power-ups, tougher walls, a daily wall.'),
  'debris-field': row(2, [7, 7, 7, 7, 7, 6, 6, 7], 'Update 2: beatable marks, win moments, real sound, always fires; still a 16:9 picture on a phone and no state hook for the fun probe yet.'),
  'gap-glide': row(1, [5, 6, 6, 4, 4, 3, 5, 7], 'One tap, plain gates, little feedback; it is over before it gets going.'),
  'null-sweep': row(2, [6, 7, 8, 4, 2, 3, 3, 8], 'A plain mine grid: works, but flat squares, one beep and no reason to come back.'),
  'dim-void': row(2, [6, 7, 8, 4, 2, 2, 3, 8], 'A lights-out grid with no feedback beyond a colour swap; solved once, done.'),
  'merge-void': row(2, [6, 7, 6, 3, 3, 3, 3, 8], 'Tiles slide with no motion and no pop; the combo text is the only feedback.'),
  snake: row(2, [6, 6, 7, 4, 2, 3, 2, 8], 'Tiny squares on a big dark field, a single beep, nothing to chase but a number.'),
  pong: row(2, [5, 6, 7, 3, 2, 2, 2, 7], 'Two bars and a dot; rallies feel the same, and the opponent never changes.'),
  jrpg: row(1, [4, 3, 4, 3, 2, 4, 3, 6], 'Slow to start, flat rooms, and it is hard to tell what to do or why.'),
  roguelike: row(1, [5, 5, 5, 5, 3, 5, 3, 7], 'The best ideas (telegraphs, relics) but grey boxes and almost no hit feedback.'),
  adventure: row(1, [6, 6, 4, 3, 2, 4, 4, 7], 'Readable story choices, but a static picture and no stakes you can feel.'),
};
export const scoreOf = (id) => (SHELF[id] ? SHELF[id].score : 0);
/** on the front shelf: marked MIN or better. The fun probe record is checked by the gate, not in the browser. Pure. */
export const listed = (id) => scoreOf(id) >= MIN;
