/**
 * merge-void skill — Merge Verse, Verse's sliding-merge puzzle (skills/merge-void-rules.js; research in domains/void.game-research.md):
 * "merge void", "play 2048", "2048 game", "sliding tiles", "tile merge game". Slide the cards; equal cards fuse; reach 1024 first, or end with the
 * higher score. Player two is Verse: it plays the same seed beside you, a slide every 1.1 seconds, and says why. Arrow keys or WASD (card focused),
 * a swipe, or the four buttons. A finished game goes on Verse's arcade ladder.
 */
import * as M from './merge-void-rules.js';
import { studioCard, every, verdict } from '../lib/studio-card.js';
import { finish } from '../lib/ladder.js';

export function mergeVoidOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:(?:play|start|open|new)\s+)?(?:a\s+)?(?:game\s+of\s+)?(?:(?:verse|void|v01d)\s+)?(?:merge\s+(?:void|verse)|(?:play\s+)?2048(?:\s+game)?|sliding\s+(?:tiles?|cards?)(?:\s+game)?|tile\s+merge(?:\s+game)?|merge\s+(?:puzzle|game))(?:\s+(?:with|against|vs)\s+(?:me|(?:verse|void)|you))?$/.test(t) && (/\b(merge|sliding|tile|play|game|let|start|open|wanna|can we|new)\b/.test(t));
}

const tint = (v) => (v ? 'hsl(' + (210 + Math.log2(v) * 17) + ' 55% ' + (v >= 512 ? 56 : 38) + '%)' : 'rgba(255,255,255,.07)');
const KEYS = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };

function mount(th, stageApi) {
  const c = studioCard(th, stageApi, { cls: 'mvoid', title: 'Merge Verse', sub: 'you against Verse, one seed', width: 320 });
  let you, vs, result = '', stop = null, started = false;
  const grid = (px) => { const g = document.createElement('div'); g.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:' + px + 'px'; return g; };
  const big = grid(4); big.className = 'mv-you'; big.style.touchAction = 'none';
  // the board takes the room above the ask bar, like the marble board (.ag-wrap): at full width the card stood 587 px tall, more than the
  // 583 px a 720 px window leaves above the bar, so New game sat under the ask bar and a press went to the bar (main ac07cc0, shard 4)
  big.style.width = 'min(100%, max(180px, calc(100dvh - var(--dock-space, 120px) - 350px)))'; big.style.margin = '0 auto';
  const mini = grid(2); mini.className = 'mv-verse'; mini.style.cssText += ';width:96px;flex:none';
  const tiles = (g, n, size) => Array.from({ length: n }, () => { const d = document.createElement('div'); d.style.cssText = 'aspect-ratio:1;border-radius:' + (size ? 3 : 8) + 'px;display:flex;align-items:center;justify-content:center;font:700 ' + (size ? 9 : 20) + 'px system-ui;color:#fff'; g.appendChild(d); return d; });
  const yt = tiles(big, 16, false), vt = tiles(mini, 16, true);
  c.body.appendChild(big);
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;align-items:center;margin-top:8px'; const vinfo = document.createElement('div'); vinfo.className = 'mv-vinfo'; vinfo.style.cssText = 'font-size:12px;line-height:1.35'; row.append(mini, vinfo); c.body.appendChild(row);
  for (const [label, dir] of [['←', 'left'], ['↑', 'up'], ['↓', 'down'], ['→', 'right']]) { const b = c.button(label, () => go(dir), 'mv-dir'); b.setAttribute('aria-label', 'slide ' + dir); }
  c.el.addEventListener('keydown', (e) => { const d = KEYS[e.key.toLowerCase()]; if (d) { e.preventDefault(); go(d); } });
  let sx = 0, sy = 0;
  big.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  big.addEventListener('pointerup', (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) < 24) return; go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); });

  function reset() { const seed = (Date.now() & 0xffff) || 7; you = M.create(seed); vs = M.create(seed); result = ''; started = false; if (stop) stop(); stop = null; c.el.dataset.result = ''; paint(); }
  function go(dir) {
    if (result || you.over) return;
    M.move(you, dir);
    if (!started) { started = true; stop = every(c.el, 1100, verse); }
    if (you.over && !result && stop) { stop(); stop = every(c.el, 200, verse); } // you are done: Verse finishes quickly, then the scores are compared
    settle(); paint();
  }
  function verse() { if (result || vs.over) return; const m = M.botMove(vs); if (!m) return; M.apply(vs, m); settle(); paint(); }
  function settle() {
    if (result) return;
    if (you.over === 'win') result = 'you'; else if (vs.over === 'win') result = 'void';
    else if (you.over && vs.over) result = you.score > vs.score ? 'you' : vs.score > you.score ? 'void' : 'draw';
    if (result) { if (stop) stop(); stop = null; c.el.dataset.result = result; try { finish('merge-void', result); } catch (_) { /* the ladder is a convenience */ } }
  }
  function paint() {
    you.grid.forEach((v, i) => { yt[i].textContent = v || ''; yt[i].style.background = tint(v); yt[i].setAttribute('aria-label', v ? String(v) : 'empty'); });
    vs.grid.forEach((v, i) => { vt[i].textContent = v || ''; vt[i].style.background = tint(v); });
    vinfo.textContent = 'Verse · best ' + M.best(vs) + ' · score ' + vs.score + (vs.over ? ' · ' + (vs.over === 'win' ? 'reached ' + M.TARGET : 'stuck') : '');
    c.status.textContent = result ? verdict(result, you.over === 'win' ? 'You reached ' + M.TARGET + ' first' : 'You win on score', vs.over === 'win' ? 'Verse reached ' + M.TARGET + ' first' : 'Verse wins on score') + ' · ' + you.score + ' to ' + vs.score
      : you.over ? 'You are stuck at ' + you.score + ' · Verse is finishing' : 'Score ' + you.score + ' · best ' + M.best(you) + (started ? '' : ' · arrow keys, WASD or swipe to start · reach ' + M.TARGET);
    c.why.textContent = started && vs.why ? 'Verse: ' + vs.why : '';
  }
  c.again.addEventListener('click', (e) => { e.stopPropagation(); reset(); });
  reset();
}

async function run(text, api) {
  if (!mergeVoidOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'merge-void');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'merge-void'; }
  api.summon('merge-void', { x: Math.max(10, Math.round(innerWidth / 2 - 160)), y: 50 });
  api.say('Merge Verse · you and Verse slide the same seed · reach ' + M.TARGET + ' first');
  return 'merge-void';
}

export default {
  name: 'merge-void',
  mergeVoidOf,
  examples: ['merge void', 'merge verse', 'play 2048', '2048 game', 'sliding tiles', 'tile merge game', "let's play merge void"],
  nearMisses: ['2048', 'what is 2048 divided by 4', 'merge two pdfs', 'merge sort', 'the year 2048', 'play chess', 'sliding doors'],
  match(lower, text) { return !!mergeVoidOf(text); },
  run,
  stageKinds: { 'merge-void': { mount } },
};
