/**
 * zorbleflux skill - Verse's own game (asked by Verse: it was asked "what is a zorbleflux" 154 times and could only refuse; the owner,
 * 2026-10-18: "we should just have a zorbleflux game"). Pilot a glowing zorb through a flux field for 45 seconds: collect motes to
 * grow, dodge the dark bleeds. Pointer, touch drag or arrow keys/WASD. The pure game is lib/zorbleflux.js; the best score stays in
 * this browser only (localStorage), nothing is sent. Reduced motion: the field drifts at 40% speed and nothing glows or flashes.
 */
import * as Z from '../lib/zorbleflux.js';
import { arcadeCard } from './arcade-card.js';
import { motionThrottle } from '../lib/motion-throttle.js'; // asked by Verse: the field slows while someone types in another card

const BEST_KEY = 'void-zorbleflux-best';
/** { kind: 'game' | 'about' } for "zorbleflux" asks, else null. Bare "zorb", "flux capacitor" and "what is flux" are other asks. Pure. */
export function zorbleOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:what\s+(?:is|are)|what'?s|whats|tell me about|explain|define)\s+(?:a\s+|an\s+|the\s+)?zorbleflux(?:\s+game)?$/.test(t)) return { kind: 'about' };
  if (/^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new)?\s*(?:a\s+|the\s+)?(?:game\s+of\s+)?(?:void\s+|(?:verse|v01d)\s+)?zorbleflux(?:\s+game)?$/.test(t)) return { kind: 'game' };
  return null;
}
const bestGet = () => { try { return Z.parseBest(localStorage.getItem(BEST_KEY)); } catch (e) { return 0; } };
const bestPut = (n) => { try { localStorage.setItem(BEST_KEY, String(n)); } catch (e) { /* storage can be blocked: the round still plays */ } }; // void-review: ok (storage can be blocked: the round still plays)

function mount(th, stageApi) {
  const calm = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  let s = Z.create((Date.now() & 0xffff) || 1, { slow: calm }), phase = 'ready', paused = false, best = bestGet(), isNew = false;
  th.state = s;
  const thr = motionThrottle();
  const c = arcadeCard(th, stageApi, { cls: 'zorble-card', title: 'Zorbleflux', sub: 'steer the zorb · 45 seconds', w: Z.W, h: Z.H });
  c.el.dataset.phase = phase; c.again.textContent = 'Play again'; c.el._zorble = () => s; // the round, for the browser test to fast-forward
  if (th.text) { const intro = document.createElement('div'); intro.className = 'zorble-about'; intro.style.cssText = 'font-size:12.5px;margin:0 0 6px'; intro.textContent = th.text; c.el.insertBefore(intro, c.cv); }
  let input = {}; const keys = new Set();
  const begin = () => { if (phase === 'ready') { phase = 'play'; c.el.dataset.phase = phase; } paused = false; };
  const again = () => { s = Z.create((Date.now() & 0xffff) || 1, { slow: calm }); th.state = s; phase = 'play'; paused = false; isNew = false; input = {}; c.el.dataset.phase = phase; c.el.focus({ preventScroll: true }); };
  c.cv.addEventListener('pointermove', (e) => { input = { x: c.local(e).x, y: c.local(e).y }; paused = false; });
  c.cv.addEventListener('pointerdown', (e) => { input = { x: c.local(e).x, y: c.local(e).y }; begin(); c.el.focus({ preventScroll: true }); });
  c.cv.addEventListener('pointerleave', () => { if (!keys.size) input = {}; });
  c.el.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); begin(); e.preventDefault(); } });
  c.el.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  c.again.addEventListener('click', (e) => { e.stopPropagation(); again(); });
  window.addEventListener('blur', () => { if (phase === 'play') paused = true; });
  document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'play') paused = true; });
  const text = (g, str, x, y, size, a) => { g.font = '600 ' + size + 'px system-ui'; g.fillStyle = 'rgba(255,255,255,' + a + ')'; g.textAlign = 'center'; g.fillText(str, x, y); };
  c.start((dt, g) => {
    if (phase === 'play' && !paused && !s.over) {
      const dx = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0), dy = (keys.has('arrowdown') || keys.has('s') ? 1 : 0) - (keys.has('arrowup') || keys.has('w') ? 1 : 0);
      Z.step(s, Math.min(dt, 0.05) * thr.scale(c.el), dx || dy ? { dx, dy } : input);
      if (s.over) { const r = Z.bestOf(best, s.score); best = r.best; isNew = r.isNew; if (r.isNew) bestPut(best); phase = 'over'; c.el.dataset.phase = phase; }
    }
    c.el.dataset.score = s.score; c.el.dataset.best = best;
    g.fillStyle = '#05040c'; g.fillRect(0, 0, Z.W, Z.H);
    // faint flow lines so the field reads as a field
    g.strokeStyle = 'rgba(140,120,255,.10)'; g.lineWidth = 1;
    for (let x = 30; x < Z.W; x += 60) for (let y = 30; y < Z.H; y += 60) { const f = Z.curl(s.seed, x, y, s.t); g.beginPath(); g.moveTo(x, y); g.lineTo(x + f.x * 18, y + f.y * 18); g.stroke(); }
    for (const b of s.bleeds) { const gr = g.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.r); gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(1, 'rgba(30,0,50,0)'); g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill(); }
    for (const m of s.motes) { if (!calm) { g.shadowBlur = 10; g.shadowColor = '#ffd04a'; } g.fillStyle = '#ffd04a'; g.beginPath(); g.arc(m.x, m.y, Z.MOTE_R, 0, 7); g.fill(); } g.shadowBlur = 0;
    const z = s.zorb; if (!calm) { g.shadowBlur = 16; g.shadowColor = '#4ef0a0'; }
    g.globalAlpha = s.hurt > 0 && !calm && Math.floor(s.hurt * 12) % 2 ? 0.45 : 1; g.fillStyle = '#4ef0a0'; g.beginPath(); g.arc(z.x, z.y, z.r, 0, 7); g.fill();
    g.shadowBlur = 0; g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(z.x - z.r * 0.3, z.y - z.r * 0.3, z.r * 0.3, 0, 7); g.fill();
    if (phase === 'ready') { g.fillStyle = 'rgba(5,4,12,.72)'; g.fillRect(0, 0, Z.W, Z.H); text(g, 'ZORBLEFLUX', Z.W / 2, 120, 30, 0.95); text(g, Z.RULES, Z.W / 2, 160, 13, 0.7); text(g, best ? 'Best: ' + best : 'Tap, click or press an arrow key to start', Z.W / 2, 200, 13, 0.55); }
    if (phase === 'over') { g.fillStyle = 'rgba(5,4,12,.72)'; g.fillRect(0, 0, Z.W, Z.H); text(g, s.score + ' flux', Z.W / 2, 140, 34, 0.95); text(g, isNew ? 'a new best' : 'best ' + best, Z.W / 2, 176, 14, 0.7); }
    c.status.textContent = phase === 'ready' ? Z.RULES : paused && phase === 'play' ? 'Paused: move to carry on' : phase === 'over' ? 'Round over: ' + s.score + ' flux' + (isNew ? ' (new best!)' : ' · best ' + best) : Z.status(s) + (best ? ' · best ' + best : '');
    c.why.textContent = phase === 'play' && s.hurt > 0 ? 'a bleed shrank you' : 'Best score is kept on this device only.';
  });
}

async function run(text, api) {
  const q = zorbleOf(text); if (!q) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'zorbleflux');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'zorbleflux'; }
  api.summon('zorbleflux', Object.assign({ x: Math.max(10, Math.round(innerWidth / 2 - 252)), y: 50 }, q.kind === 'about' ? { text: Z.ABOUT } : {}));
  api.say(q.kind === 'about' ? Z.ABOUT : 'Zorbleflux · steer the zorb with the pointer, a finger or the arrow keys');
  return 'zorbleflux';
}

export default {
  name: 'zorbleflux',
  zorbleOf,
  about: Z.ABOUT, // the one line "tell me about <a skill>" (skills/about-skill.js) prefers over the book's
  examples: ['zorbleflux', 'play zorbleflux', 'a zorbleflux game', 'what is a zorbleflux', 'tell me about zorbleflux', "what's a zorbleflux?"],
  nearMisses: ['zorb', 'flux capacitor', 'what is flux', 'play chess'],
  match(lower, text) { return !!zorbleOf(text); },
  run,
  stageKinds: { zorbleflux: { mount } },
};
