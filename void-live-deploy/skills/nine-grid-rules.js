/** Nine Grid: a 4 by 4 number grid in four boxes. Verse already knows the fill and waits. */
export const id = 'nine-grid', N = 4, CELL = 36, W = 4 * 36, H = 4 * 36, CAP = 4000;
const BASE = [1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1];
export function create(seed = 1) {
  const k = ((seed >>> 0) % 3) + 1;
  const answer = BASE.map((n) => ((n + k - 1) % 4) + 1);
  const given = answer.map((n, i) => (i % 3 === 0 ? n : 0));
  return { tick: 0, answer, given, cell: 1, over: null, why: 'Verse solved it already and is counting your presses', score: { you: 0, void: 0 }, sfx: 0, presses: 0 };
}
function done(s) { return s.given.every((n, i) => n === s.answer[i]); }
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  if (input.auto) { const i = s.given.findIndex((n, k) => n !== s.answer[k]); if (i >= 0) { s.given[i] = s.answer[i]; s.presses++; s.sfx = 1; } }
  else if (input.step && input.dir) s.cell = (s.cell + ({ left: -1, right: 1, up: -4, down: 4 }[input.dir] || 0) + 16) % 16;
  if (input.fire && !input.dir && !input.auto) { s.given[s.cell] = (s.given[s.cell] % 4) + 1; s.presses++; s.sfx = 1; }
  if (done(s)) { s.over = 'you'; s.score.you = Math.max(1, 40 - s.presses); }
  else if (s.tick >= CAP) { s.over = 'void'; s.score.void = 1; }
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 16; i++) {
    const r = Math.floor(i / 4), c = i % 4;
    g.fillStyle = i === s.cell ? '#241c44' : '#12101c';
    g.fillRect(c * CELL + 2, r * CELL + 2, CELL - 4, CELL - 4);
    if (s.given[i]) { g.fillStyle = '#f4f1ea'; g.font = '16px sans-serif'; g.fillText(String(s.given[i]), c * CELL + 14, r * CELL + 24); }
  }
}
export const how = 'Move the highlight with the arrows and press space to cycle 1, 2, 3, 4. Each 2 by 2 box, each row and each column holds each digit once. Verse has the answer and wins if you run out of steps. A link hands a friend the same grid.';
