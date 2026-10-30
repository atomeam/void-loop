/**
 * snake skill — Verse Snake against Verse (skills/snake-rules.js): "snake", "play snake", "void snake", "snake game".
 * Steer with arrow keys / WASD (card focused) or swipe or tap a side of the board. Each Verse move says why.
 */
import * as S from './snake-rules.js';
import { arcadeCard } from './arcade-card.js';
import { snakeRecorder, snakeGhostBody, submit, load, words } from '../lib/arcade-ghost.js';
import { finish } from '../lib/ladder.js'; // a finished match goes on Verse's arcade ladder (asked by Verse)
import { rulesLine } from './game-rules-line.js';

export function snakeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new)?\s*(?:a\s+)?(?:game\s+of\s+)?(?:void\s+|(?:verse|v01d)\s+)?snake(?:\s+game)?(?:\s+(?:with|against|vs)\s+(?:me|(?:verse|void)|you))?$/.test(t) ? { kind: 'game' } : null;
}
const PX = 16, TICK = 0.13;

function mount(th, stageApi) {
  th.state = S.create((Date.now() & 0xffff) || 7);
  const c = arcadeCard(th, stageApi, { cls: 'snake-card', title: 'Verse Snake', sub: 'you are green · Verse is violet', w: S.N * PX, h: S.N * PX });
  const K = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
  c.el.addEventListener('keydown', (e) => { const d = K[e.key.toLowerCase()]; if (d) { S.turn(th.state, d); go = true; e.preventDefault(); } });
  let start = null, go = false;
  // the ghost (asked by Verse): your best run so far, replayed as a faint outline snake; a longer run replaces it
  let ghost = load('snake'), rec = snakeRecorder(), saved = false;
  c.cv.addEventListener('pointerdown', (e) => { start = c.local(e); c.el.focus({ preventScroll: true }); });
  c.cv.addEventListener('pointerup', (e) => {
    const p = c.local(e), s = start || p; let dx = p.x - s.x, dy = p.y - s.y;
    if (Math.hypot(dx, dy) < 12) { const [hx, hy] = th.state.you.body[0]; dx = p.x - (hx + 0.5) * PX; dy = p.y - (hy + 0.5) * PX; } // a tap: turn toward it
    S.turn(th.state, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); start = null; go = true;
  });
  c.el.appendChild(rulesLine('steer with the arrow keys, WASD or a swipe; eat to grow, and don\u2019t hit a wall, yourself or Verse. Longest snake wins.'));
  c.again.addEventListener('click', (e) => { e.stopPropagation(); th.state = S.create((Date.now() & 0xffff) || 7); go = false; rec = snakeRecorder(); saved = false; });
  let acc = 0;
  c.start((dt, g) => {
    const s = th.state; if (!go) acc = 0; else acc += dt; while (acc >= TICK) { acc -= TICK; S.tick(s); rec.tick(s); }
    if (s.over && !saved) { saved = true; const r = submit(rec.run(s)); if (r.beat) ghost = r.run; c.el.dataset.ghost = r.beat ? 'new' : 'kept'; }
    g.fillStyle = '#05040c'; g.fillRect(0, 0, S.N * PX, S.N * PX);
    g.fillStyle = 'rgba(255,255,255,.03)'; for (let i = 0; i < S.N; i++) for (let j = (i % 2); j < S.N; j += 2) g.fillRect(i * PX, j * PX, PX, PX);
    if (s.food) { g.shadowBlur = 14; g.shadowColor = '#ffd04a'; g.fillStyle = '#ffd04a'; g.beginPath(); g.arc((s.food[0] + 0.5) * PX, (s.food[1] + 0.5) * PX, PX * 0.36, 0, 7); g.fill(); }
    if (ghost && !s.over) { g.globalAlpha = 0.3; g.strokeStyle = '#4ef0a0'; for (const [x, y] of snakeGhostBody(ghost, s.ticks - 1)) g.strokeRect(x * PX + 2, y * PX + 2, PX - 4, PX - 4); g.globalAlpha = 1; }
    for (const [w, col] of [['you', '#4ef0a0'], ['void', '#a070ff']]) {
      const p = s[w]; g.shadowColor = col; g.shadowBlur = p.alive ? 10 : 0; g.globalAlpha = p.alive ? 1 : 0.35;
      p.body.forEach(([x, y], i) => { g.fillStyle = i ? col : '#fff'; g.fillRect(x * PX + 1, y * PX + 1, PX - 2, PX - 2); });
      g.globalAlpha = 1;
    }
    g.shadowBlur = 0;
    c.status.textContent = !go ? 'Press an arrow key or swipe to start' : s.over === 'you' ? 'You win! (' + s.you.body.length + ' long)' : s.over === 'void' ? 'Verse wins (' + s.void.body.length + ' long)' : s.over === 'draw' ? 'A draw' : 'You ' + s.you.body.length + ' · Verse ' + s.void.body.length;
    c.why.textContent = (s.why ? 'Verse: ' + s.why + ' · ' : '') + words(ghost);
    if (s.over && !s._counted) { s._counted = true; finish('snake', s.over); }
  });
}

async function run(text, api) {
  if (!snakeOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'snake');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'snake'; }
  api.summon('snake', { x: Math.max(10, Math.round(innerWidth / 2 - 180)), y: 50 });
  api.say('Verse Snake (plays like the classic) · you are green, Verse is violet · arrows, WASD or swipe');
  return 'snake';
}

export default {
  name: 'snake',
  snakeOf,
  examples: ['snake', 'play snake', 'void snake', 'snake game', "let's play snake", 'snake against void'],
  nearMisses: ['snakes and ladders', 'what is the longest snake', 'snake facts', 'play chess'],
  match(lower, text) { return !!snakeOf(text); },
  run,
  stageKinds: { snake: { mount } },
};
