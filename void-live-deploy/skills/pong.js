/**
 * pong skill — Verse Pong against Verse (skills/pong-rules.js): "pong", "play pong", "void pong", "table tennis game".
 * Move your paddle with the mouse or a finger on the court, or W/S and the arrow keys with the card focused. First to 7.
 */
import * as P from './pong-rules.js';
import { arcadeCard } from './arcade-card.js';
import { pongRecorder, pongGhostY, submit, load, words } from '../lib/arcade-ghost.js';
import { finish } from '../lib/ladder.js'; // a finished match goes on Verse's arcade ladder (asked by Verse)
import { rulesLine } from './game-rules-line.js';

export function pongOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new)?\s*(?:a\s+)?(?:game\s+of\s+)?(?:void\s+|(?:verse|v01d)\s+)?(?:pong|ping\s*pong game|table tennis game)(?:\s+game)?(?:\s+(?:with|against|vs)\s+(?:me|(?:verse|void)|you))?$/.test(t) ? { kind: 'game' } : null;
}

function mount(th, stageApi) {
  th.state = P.create((Date.now() & 0xffff) || 1);
  const c = arcadeCard(th, stageApi, { cls: 'pong-card', title: 'Verse Pong', sub: 'you are left · first to 7', w: P.W, h: P.H });
  let input = {}; const keys = new Set();
  // the ghost (asked by Verse): your best game so far, replayed as a faint paddle; a better game replaces it
  let ghost = load('pong'), rec = pongRecorder(), saved = false, clock = 0;
  const fresh = () => { th.state = P.create((Date.now() & 0xffff) || 1); rec = pongRecorder(); saved = false; clock = 0; };
  c.cv.addEventListener('pointermove', (e) => { input = { y: c.local(e).y }; });
  c.cv.addEventListener('pointerdown', (e) => { input = { y: c.local(e).y }; });
  c.el.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'w', 's'].includes(k)) { keys.add(k); e.preventDefault(); } });
  c.el.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  c.el.appendChild(rulesLine('move your paddle with the mouse, a finger, or the up and down keys; get the ball past Verse. First to 7 wins.'));
  c.again.addEventListener('click', (e) => { e.stopPropagation(); fresh(); });
  c.start((dt, g) => {
    const s = th.state;
    const dir = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
    P.step(s, dt, dir ? { dir } : input);
    if (!s.over) { rec.tick(Math.min(dt, 0.05), s.you.y); clock += Math.min(dt, 0.05); }
    else if (!saved) { saved = true; const r = submit(rec.run(s)); if (r.beat) ghost = r.run; c.el.dataset.ghost = r.beat ? 'new' : 'kept'; }
    g.fillStyle = '#05040c'; g.fillRect(0, 0, P.W, P.H);
    g.strokeStyle = 'rgba(160,140,255,.25)'; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(P.W / 2, 0); g.lineTo(P.W / 2, P.H); g.stroke(); g.setLineDash([]);
    g.font = '600 28px system-ui'; g.fillStyle = 'rgba(255,255,255,.5)'; g.textAlign = 'center'; g.fillText(s.you.score, P.W / 2 - 40, 36); g.fillText(s.void.score, P.W / 2 + 40, 36);
    if (ghost && !s.over) { g.globalAlpha = 0.28; g.fillStyle = '#4ef0a0'; g.fillRect(0, pongGhostY(ghost, clock) - P.PAD_H / 2, P.PAD_W, P.PAD_H); g.globalAlpha = 1; }
    g.shadowBlur = 12; g.shadowColor = '#4ef0a0'; g.fillStyle = '#4ef0a0'; g.fillRect(0, s.you.y - P.PAD_H / 2, P.PAD_W, P.PAD_H);
    g.shadowColor = '#a070ff'; g.fillStyle = '#a070ff'; g.fillRect(P.W - P.PAD_W, s.void.y - P.PAD_H / 2, P.PAD_W, P.PAD_H);
    g.shadowColor = '#fff'; g.fillStyle = '#fff'; g.beginPath(); g.arc(s.ball.x, s.ball.y, P.BALL / 2, 0, 7); g.fill(); g.shadowBlur = 0;
    c.status.textContent = s.over === 'you' ? 'You win ' + s.you.score + '–' + s.void.score + '!' : s.over === 'void' ? 'Verse wins ' + s.void.score + '–' + s.you.score : 'You ' + s.you.score + ' · Verse ' + s.void.score;
    c.why.textContent = (s.lastWhy ? 'Verse: ' + s.lastWhy + ' · ' : '') + words(ghost);
    if (s.over && !s._counted) { s._counted = true; finish('pong', s.over); }
  });
}

async function run(text, api) {
  if (!pongOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'pong');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'pong'; }
  api.summon('pong', { x: Math.max(10, Math.round(innerWidth / 2 - 220)), y: 50 });
  api.say('Verse Pong (plays like the arcade classic) · you are left, Verse is right · move on the court or use W/S');
  return 'pong';
}

export default {
  name: 'pong',
  pongOf,
  examples: ['pong', 'play pong', 'void pong', "let's play pong", 'pong against void', 'a game of pong'],
  nearMisses: ['who invented pong', 'pong history', 'play chess', 'ping'],
  match(lower, text) { return !!pongOf(text); },
  run,
  stageKinds: { pong: { mount } },
};
