/**
 * void-breaker skill — Verse Breaker, Verse's bounce-and-clear arcade game (skills/void-breaker-rules.js; research in domains/void.game-research.md):
 * "void breaker", "breakout", "brick breaker", "play breakout". Your paddle is at the bottom, Verse's at the top, the bricks in between; a brick breaks for
 * whoever touched the ball last. Move the pointer, or use the arrow keys / A and D with the card focused. Verse says what it is doing. A finished game goes
 * on Verse's arcade ladder. The game steps at a fixed 60 a second whatever the screen does, so a game is a seed plus the pointer.
 */
import * as V from './void-breaker-rules.js';
import { arcadeCard } from './arcade-card.js';
import { finish } from '../lib/ladder.js';

export function voidBreakerOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:(?:play|start|open|new)\s+)?(?:a\s+)?(?:game\s+of\s+)?(?:(?:verse|void|v01d)\s+)?(?:(?:void|verse)\s+breaker|break\s?out|brick\s+breaker|brick\s+smash(?:er)?|bounce\s+and\s+clear)(?:\s+game)?(?:\s+(?:with|against|vs)\s+(?:me|(?:verse|void)|you))?$/.test(t)
    && (/\b(void|verse|play|game|let|start|open|wanna|new|brick|bounce)\b/.test(t));
}

const STEP = 1 / 60;

function mount(th, stageApi) {
  const c = arcadeCard(th, stageApi, { cls: 'vbreak', title: 'Verse Breaker', sub: 'you are cyan · Verse is violet', w: V.W, h: V.H });
  let s = V.create((Date.now() & 0xffff) || 7), go = false, acc = 0, x = V.W / 2, keys = 0, done = false;
  c.cv.addEventListener('pointermove', (e) => { x = c.local(e).x; go = true; });
  c.cv.addEventListener('pointerdown', (e) => { x = c.local(e).x; go = true; c.el.focus({ preventScroll: true }); });
  c.el.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a') { keys = -1; go = true; e.preventDefault(); } else if (k === 'arrowright' || k === 'd') { keys = 1; go = true; e.preventDefault(); } });
  c.el.addEventListener('keyup', (e) => { const k = e.key.toLowerCase(); if (['arrowleft', 'a', 'arrowright', 'd'].includes(k)) keys = 0; });
  c.again.addEventListener('click', (e) => { e.stopPropagation(); s = V.create((Date.now() & 0xffff) || 7); go = false; acc = 0; x = V.W / 2; done = false; });
  c.start((dt, g) => {
    if (go && !s.over) { acc = Math.min(acc + dt, 0.25); while (acc >= STEP) { acc -= STEP; if (keys) x = Math.max(0, Math.min(V.W, x + keys * 5)); V.tick(s, { x }); } }
    const BK = ['#7b5cff', '#a070ff', '#c39bff', '#e0ccff'];
    g.fillStyle = '#05040c'; g.fillRect(0, 0, V.W, V.H);
    g.fillStyle = 'rgba(255,255,255,.03)'; for (let i = 0; i < V.W; i += 20) g.fillRect(i, 0, 1, V.H);
    s.bricks.forEach((k, i) => { if (!k.alive) return; g.fillStyle = BK[Math.floor(i / V.COLS) % BK.length]; g.fillRect(k.x + 1, k.y + 1, V.BW - 2, V.BH - 2); });
    g.shadowBlur = 10; g.shadowColor = '#a070ff'; g.fillStyle = '#a070ff'; g.fillRect(s.p2 - V.PW / 2, V.P2Y, V.PW, V.PH);
    g.shadowColor = '#4fe3e3'; g.fillStyle = '#4fe3e3'; g.fillRect(s.p1 - V.PW / 2, V.P1Y, V.PW, V.PH);
    g.shadowColor = '#fff'; g.fillStyle = '#fff'; g.beginPath(); g.arc(s.ball.x, s.ball.y, V.R, 0, 7); g.fill(); g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,.55)'; g.font = '11px system-ui'; g.textBaseline = 'middle';
    g.textAlign = 'left'; g.fillText('you ' + s.score.you + ' · ' + '♥'.repeat(Math.max(0, s.lives.you)), 6, V.H - 8);
    g.textAlign = 'right'; g.fillText('Verse ' + s.score.void + ' · ' + '♥'.repeat(Math.max(0, s.lives.void)), V.W - 6, 6);
    c.status.textContent = s.over ? (s.over === 'you' ? 'You win' : s.over === 'void' ? 'Verse wins' : 'A draw') + ' · ' + s.score.you + ' to ' + s.score.void : !go ? 'Move the pointer, or press an arrow key, to serve' : V.bricksLeft(s) + ' bricks left';
    c.why.textContent = go && s.why ? 'Verse: ' + s.why : '';
    if (s.over && !done) { done = true; c.el.dataset.result = s.over; try { finish('void-breaker', s.over); } catch (_) { /* the ladder is a convenience */ } }
  });
}

async function run(text, api) {
  if (!voidBreakerOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'void-breaker');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'void-breaker'; }
  api.summon('void-breaker', { x: Math.max(10, Math.round(innerWidth / 2 - 130)), y: 40 });
  api.say('Verse Breaker · you are at the bottom, Verse at the top · move the pointer');
  return 'void-breaker';
}

export default {
  name: 'void-breaker',
  voidBreakerOf,
  examples: ['void breaker', 'verse breaker', 'breakout game', 'brick breaker', 'play breakout', "let's play void breaker", 'bounce and clear game'],
  nearMisses: ['breakout session ideas', 'prison breakout movie', 'brick wall pattern', 'how to break a habit', 'play chess', 'wedding breaker'],
  match(lower, text) { return !!voidBreakerOf(text); },
  run,
  stageKinds: { 'void-breaker': { mount } },
};
