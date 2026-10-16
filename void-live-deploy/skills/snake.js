/**
 * snake skill — Void Snake against V01D (skills/snake-rules.js): "snake", "play snake", "void snake", "snake game".
 * Steer with arrow keys / WASD (card focused) or swipe or tap a side of the board. Each V01D move says why.
 */
import * as S from './snake-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js'; // a finished match goes on V01D's arcade ladder (asked by Void)

export function snakeOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new)?\s*(?:a\s+)?(?:game\s+of\s+)?(?:void\s+|v01d\s+)?snake(?:\s+game)?(?:\s+(?:with|against|vs)\s+(?:me|void|you))?$/.test(t) ? { kind: 'game' } : null;
}
const PX = 16, TICK = 0.13;

function mount(th, stageApi) {
  th.state = S.create((Date.now() & 0xffff) || 7);
  const c = arcadeCard(th, stageApi, { cls: 'snake-card', title: 'Void Snake', sub: 'you are green · V01D is violet', w: S.N * PX, h: S.N * PX });
  const K = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
  c.el.addEventListener('keydown', (e) => { const d = K[e.key.toLowerCase()]; if (d) { S.turn(th.state, d); go = true; e.preventDefault(); } });
  let start = null, go = false;
  c.cv.addEventListener('pointerdown', (e) => { start = c.local(e); c.el.focus({ preventScroll: true }); });
  c.cv.addEventListener('pointerup', (e) => {
    const p = c.local(e), s = start || p; let dx = p.x - s.x, dy = p.y - s.y;
    if (Math.hypot(dx, dy) < 12) { const [hx, hy] = th.state.you.body[0]; dx = p.x - (hx + 0.5) * PX; dy = p.y - (hy + 0.5) * PX; } // a tap: turn toward it
    S.turn(th.state, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); start = null; go = true;
  });
  c.again.addEventListener('click', (e) => { e.stopPropagation(); th.state = S.create((Date.now() & 0xffff) || 7); go = false; });
  let acc = 0;
  c.start((dt, g) => {
    const s = th.state; if (!go) acc = 0; else acc += dt; while (acc >= TICK) { acc -= TICK; S.tick(s); }
    g.fillStyle = '#05040c'; g.fillRect(0, 0, S.N * PX, S.N * PX);
    g.fillStyle = 'rgba(255,255,255,.03)'; for (let i = 0; i < S.N; i++) for (let j = (i % 2); j < S.N; j += 2) g.fillRect(i * PX, j * PX, PX, PX);
    if (s.food) { g.shadowBlur = 14; g.shadowColor = '#ffd04a'; g.fillStyle = '#ffd04a'; g.beginPath(); g.arc((s.food[0] + 0.5) * PX, (s.food[1] + 0.5) * PX, PX * 0.36, 0, 7); g.fill(); }
    for (const [w, col] of [['you', '#4ef0a0'], ['void', '#a070ff']]) {
      const p = s[w]; g.shadowColor = col; g.shadowBlur = p.alive ? 10 : 0; g.globalAlpha = p.alive ? 1 : 0.35;
      p.body.forEach(([x, y], i) => { g.fillStyle = i ? col : '#fff'; g.fillRect(x * PX + 1, y * PX + 1, PX - 2, PX - 2); });
      g.globalAlpha = 1;
    }
    g.shadowBlur = 0;
    c.status.textContent = !go ? 'Press an arrow key or swipe to start' : s.over === 'you' ? 'You win! (' + s.you.body.length + ' long)' : s.over === 'void' ? 'V01D wins (' + s.void.body.length + ' long)' : s.over === 'draw' ? 'A draw' : 'You ' + s.you.body.length + ' · V01D ' + s.void.body.length;
    c.why.textContent = s.why ? 'V01D: ' + s.why : '';
    if (s.over && !s._counted) { s._counted = true; finish('snake', s.over); }
  });
}

async function run(text, api) {
  if (!snakeOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'snake');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'snake'; }
  api.summon('snake', { x: Math.max(10, Math.round(innerWidth / 2 - 180)), y: 50 });
  api.say('Void Snake (plays like the classic) · you are green, V01D is violet · arrows, WASD or swipe');
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
