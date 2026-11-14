/** Jump Stack: both climb the same ledges. You jump as soon as you land. Verse waits, so you reach the top first. */
export const id = 'jump-stack', W = 220, H = 200, CAP = 700;
const LEDGES = [0, 1, 2, 3, 4, 5].map((i) => ({ x: 24, y: 176 - i * 30, w: 170 }));
export function create(seed = 1) {
  return { tick: 0, n: (seed >>> 0) || 1, ledges: LEDGES, you: { y: 176, vy: 0, wait: 0 }, verse: { y: 176, vy: 0, wait: 0 }, over: null, why: 'waiting on a ledge', score: { you: 0, void: 0 }, sfx: 0 };
}
function land(p) {
  if (p.vy <= 0) return;
  for (const L of LEDGES) if (p.prev <= L.y && p.y >= L.y) { p.y = L.y; p.vy = 0; }
}
function body(p, flap) {
  p.prev = p.y;
  if (flap && p.vy === 0) p.vy = -5.1;
  else p.vy = Math.min(6, p.vy + 0.28);
  p.y += p.vy;
  land(p);
}
export function tick(s, input = {}) {
  if (s.over) return s;
  s.tick++; s.sfx = 0;
  const youJump = input.auto ? s.you.vy === 0 : !!input.flap;
  s.verse.wait = s.verse.vy === 0 ? s.verse.wait + 1 : 0;
  const verseJump = s.verse.wait > 22;
  s.why = verseJump ? 'jumping, after a pause' : 'standing on the ledge';
  if (youJump || verseJump) s.sfx = 1;
  body(s.you, youJump); body(s.verse, verseJump);
  if (s.you.y <= 26) { s.over = 'you'; s.score.you = 1; }
  else if (s.verse.y <= 26) { s.over = 'void'; s.score.void = 1; }
  else if (s.tick >= CAP) s.over = 'draw';
  return s;
}
export function selfPlay(seed, cap = CAP) { const s = create(seed); while (!s.over && s.tick < cap) tick(s, { auto: true }); return { over: s.over, tick: s.tick, score: { ...s.score } }; }
export function draw(g, s) {
  g.fillStyle = '#07060f'; g.fillRect(0, 0, W, H); g.fillStyle = '#3a2a78';
  for (const L of s.ledges) g.fillRect(L.x, L.y, L.w, 6);
  const dot = (p, color, x) => { g.fillStyle = color; g.beginPath(); g.arc(x, p.y - 8, 6, 0, 7); g.fill(); };
  dot(s.verse, '#b79bff', 78); dot(s.you, '#4fe3e3', 140);
}
export const how = 'Press space or tap to jump to the next ledge. Verse climbs the same tower and waits on every ledge, so a quick jump reaches the top first. A link hands a friend the same tower.';
