/**
 * battleship skill — Battleship against Void (skills/battleship-rules.js): "play battleship", "battleship board game".
 * The game of hidden state: the card draws only what you may see (rules view()): your own fleet with Void's shots at it,
 * and of Void's waters only your own shot results and the ships you have sunk. Void's fleet never reaches the screen.
 * The board stands in the void in 3D (mini/battleship.js: the folding case, your ocean flat, your target board upright),
 * lifted by skills/lift3d.js with this card beside it; the flat grids here are the fallback.
 */
import * as B from './battleship-rules.js';
import { lift3d } from './lift3d.js';

export function battleshipOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:let'?s|lets|can we|i want to|wanna)\s+)?(?:play|start|open|new)\s+(?:a\s+)?(?:game\s+of\s+)?(?:battleships?|sea battle)(?:\s+(?:board\s+)?game)?(?:\s+(?:with|against)\s+(?:me|void|you))?$/.test(t)) return { kind: 'game' };
  if (/^(?:a\s+)?game\s+of\s+battleships?$|^(?:a\s+)?battleships?\s+(?:board\s*)?game$/.test(t)) return { kind: 'game' };
  return null;
}

const timers = new WeakMap();

function grid(cls, label) {
  const g = document.createElement('div'); g.className = cls; g.setAttribute('aria-label', label);
  g.style.cssText = 'display:grid;grid-template-columns:repeat(10,1fr);gap:1px;aspect-ratio:1;background:#0d3550;border-radius:6px;padding:2px';
  return g;
}

function mount(th, stageApi) {
  if (!th.state || !th.state.fleet) th.state = B.create();
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card battleship-card';
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(460px, calc(100vw - 20px))';
  el.innerHTML = '<div class="g-head"><span class="g-title">Sea Battle</span><span class="g-sub">you against Void</span></div>';
  const wrap = document.createElement('div'); wrap.className = 'g-board';
  const boards = document.createElement('div'); boards.className = 'bs-boards'; boards.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px';
  const target = grid('bs-target', 'Void’s waters: tap to fire'), ocean = grid('bs-ocean', 'your fleet');
  const tCells = [], oCells = [];
  for (let c = 0; c < 100; c++) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.i = c; b.className = 'bs-cell';
    b.style.cssText = 'border:0;padding:0;background:#1d6a93;cursor:pointer;position:relative'; b.setAttribute('aria-label', 'fire at ' + B.cellName(c));
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('click', (e) => { e.stopPropagation(); shoot(c); });
    target.appendChild(b); tCells.push(b);
    const o = document.createElement('div'); o.style.cssText = 'background:#1d6a93;position:relative'; ocean.appendChild(o); oCells.push(o);
  }
  const cap = (t) => { const d = document.createElement('div'); d.style.cssText = 'font-size:11px;color:var(--muted,#8a8a8a);margin-bottom:3px'; d.textContent = t; return d; };
  const left = document.createElement('div'), right = document.createElement('div');
  left.append(cap('Void’s waters · tap to fire'), target); right.append(cap('Your fleet'), ocean);
  boards.append(left, right); wrap.appendChild(boards);
  const status = document.createElement('div'); status.className = 'g-status bs-status'; status.setAttribute('aria-live', 'polite'); status.style.display = 'block';
  const fleets = document.createElement('div'); fleets.style.cssText = 'font-size:12px;margin:4px 0';
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin:6px 0';
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn ' + cls; b.textContent = label; b.addEventListener('pointerdown', (e) => e.stopPropagation()); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
  const redeal = btn('Move my ships', 'bs-redeal', () => { th.state = B.placeRandom(th.state, 'you'); save(); paint(); });
  const again = btn('New game', 'bs-new', () => { clearTimeout(timers.get(th)); th.state = B.create(); save(); paint(); });
  bar.append(redeal, again);
  const log = document.createElement('div'); log.className = 'bs-log'; log.style.cssText = 'font-size:11.5px;color:var(--muted,#8a8a8a);max-height:110px;overflow:auto;border-top:1px solid rgba(255,255,255,.08);padding-top:4px';
  const save = () => stageApi.save && stageApi.save();
  function shoot(c) { const r = B.fire(th.state, c); if (!r.result) return; th.state = r.s; save(); paint(); voidPlays(); }
  function voidPlays() {
    clearTimeout(timers.get(th));
    if (th.state.over || th.state.turn !== 'void') return;
    timers.set(th, setTimeout(() => { th.state = B.voidFire(th.state).s; save(); paint(); voidPlays(); }, 850));
  }
  const peg = (cell, kind) => { const d = document.createElement('i'); d.style.cssText = 'position:absolute;inset:28%;border-radius:50%;background:' + (kind === 'miss' ? '#f2f6f8' : kind === 'sunk' ? '#7a1d1c' : '#e0332f'); cell.appendChild(d); };
  function paint() {
    const s = th.state, v = B.view(s, 'you'); // only what you may see
    tCells.forEach((b, c) => { b.textContent = ''; const r = v.target.shots[c]; if (r) peg(b, r); b.disabled = !!r || !!v.over || v.turn !== 'you'; b.style.cursor = b.disabled ? 'default' : 'pointer'; });
    const sunkCells = new Set(v.target.sunk.flatMap((x) => x.cells));
    tCells.forEach((b, c) => { b.style.background = sunkCells.has(c) ? '#4b5b66' : '#1d6a93'; });
    const shipAt = new Map(); v.own.ships.forEach((sh) => sh.cells.forEach((c) => shipAt.set(c, sh)));
    oCells.forEach((o, c) => { o.textContent = ''; o.style.background = shipAt.has(c) ? (shipAt.get(c).sunk ? '#4b5b66' : '#8e9aa3') : '#1d6a93'; const r = v.own.shotsAt[c]; if (r) peg(o, r === 'miss' ? 'miss' : 'hit'); });
    status.textContent = v.over ? (v.over === 'you' ? 'You sank Void’s whole fleet. You win!' : 'Void sank your fleet.') : v.turn === 'you' ? 'Your shot · a hit fires again' : 'Void is aiming…';
    fleets.textContent = 'Void still has: ' + (v.target.afloat.join(', ') || 'nothing') + ' · you still have: ' + (v.own.ships.filter((x) => !x.sunk).map((x) => x.name).join(', ') || 'nothing');
    redeal.hidden = Object.keys(s.shots.you).length + Object.keys(s.shots.void).length > 0;
    log.textContent = '';
    for (const l of s.log.slice(-12).reverse()) { const line = document.createElement('div'); line.textContent = l.who + ' ' + l.text; if (l.why) { const w = document.createElement('span'); w.style.color = 'var(--ink,#ddd)'; w.textContent = ' · because ' + l.why; line.appendChild(w); } log.appendChild(line); }
  }
  el.append(wrap, status, fleets, bar, log);
  paint();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
  voidPlays();
  lift3d(th, stageApi, el, { kind: 'battleship', board: target, title: 'Sea Battle', W: 480, H: 420,
    snapshot: () => { const v = B.view(th.state, 'you'); return { own: v.own, target: { shots: v.target.shots, sunk: v.target.sunk } }; } });
}

async function run(text, api) {
  if (!battleshipOf(text)) return 'none';
  const existing = Object.values(api.stage.things()).find((t) => t.kind === 'battleship');
  if (existing) { if (api.stage.center) api.stage.center(existing.id); else api.stage.render(); return 'battleship'; }
  api.summon('battleship', { state: B.create(), x: Math.max(10, Math.round(innerWidth / 2 - 400)), y: 40 });
  api.say('Sea Battle (plays like Battleship) · your ships are placed · tap Void’s waters to fire; a hit fires again');
  return 'battleship';
}

export default {
  name: 'battleship',
  battleshipOf,
  examples: ['play battleship', "let's play battleship", 'battleship board game', 'a game of battleship', 'play battleships against void'],
  nearMisses: ['battleship', 'what is a battleship', 'battleship movie', 'play chess'],
  match(lower, text) { return !!battleshipOf(text); },
  run,
  stageKinds: { battleship: { mount } },
};
