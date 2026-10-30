/**
 * side-card — a game's board stands in the void as a 3D object, and its card (whose turn, buttons, counts) is a separate
 * panel beside it that you move on its own (Adam, 2026-10-08: "3d in the void and out of the cards; the card should be
 * separate"). Not a skill: go.js, chess.js and checkers.js import it.
 *   grip(label)                         a slim handle under the board: the canvas takes taps and orbits, so this is what you drag
 *   sideCard(th, stageApi, card, opts)  places `card` at th.card (or beside the board, or under it when there is no room),
 *                                       lets it be dragged on its own and remembers where it was left
 *       opts: { boardW, boardH, w = 280, gap = 20 }
 */
import { howTo } from './howto.js';
import { soundButton } from './sfx.js';
import { fitPanel } from '../lib/panel-fit.js';
export { grip } from './grip.js'; // the handle lives on its own so a card that needs only it (skills/eightball.js) loads only it
const SOUNDS = new Set(['sorry', 'aggravation']); // games that make table sounds so far

const CSS = '.side-card{position:absolute;z-index:2;padding:14px 16px 22px;border-radius:var(--radius,16px);background:var(--card-bg,rgba(16,16,18,.94));border:1px solid var(--card-line,rgba(255,255,255,.12));'
  + 'box-shadow:var(--card-shadow,0 18px 50px rgba(0,0,0,.45));color:var(--ink,#eee);font-size:var(--fs-s,13px);line-height:1.45;text-align:left;user-select:none;backdrop-filter:blur(8px);'
  + 'scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.4) rgba(255,255,255,.06);overscroll-behavior:contain}'
  + '.side-card::-webkit-scrollbar{width:8px}.side-card::-webkit-scrollbar-track{background:rgba(255,255,255,.06);border-radius:8px}.side-card::-webkit-scrollbar-thumb{background:rgba(255,255,255,.4);border-radius:8px}.side-card::-webkit-scrollbar-button{display:none}'
  // a card that scrolls says so: a fade and an arrow at its foot until the end is reached
  + '.side-card.scrolls:not(.at-end)::after{content:"\\25BE  more";display:block;position:sticky;bottom:-22px;margin:-6px -16px -22px;padding:16px 0 6px;text-align:center;font-size:11px;letter-spacing:.06em;color:var(--muted,#a9a9b2);pointer-events:none;background:linear-gradient(to bottom,transparent,var(--card-bg,rgba(16,16,18,.94)) 60%)}'
  + '.side-card .g-head{cursor:grab}.side-card button{cursor:pointer}';
function style() {
  if (typeof document === 'undefined' || document.getElementById('side-card-style')) return;
  const s = document.createElement('style'); s.id = 'side-card-style'; s.textContent = CSS; document.head.appendChild(s);
}

export function sideCard(th, stageApi, card, { boardW = 420, boardH = 420, w = 280, gap = 20 } = {}) {
  style();
  const vw = (typeof innerWidth === 'number' ? innerWidth : 1200);
  const beside = th.x + boardW + gap + w <= vw - 8;
  const cw = Math.min(w, vw - 16);
  const fresh = beside ? { x: th.x + boardW + gap, y: th.y + Math.round(boardH * 0.18) } : { x: Math.max(8, th.x + Math.round((boardW - cw) / 2)), y: th.y + boardH + gap };
  // a card never sits on its board: a place kept from a wider window, or a board moved under it, puts it back beside or below
  const onBoard = (p) => p.x < th.x + boardW && p.x + cw > th.x && p.y < th.y + boardH && p.y + 120 > th.y;
  const kept = th.card && Number.isFinite(th.card.x) && Number.isFinite(th.card.y) && !onBoard(th.card) ? th.card : null;
  const at = kept || fresh;
  if (!kept) th.card = { x: at.x, y: at.y }; // from now on the card stays where it is when the board moves
  card.classList.add('side-card');
  howTo(card, th.kind); // every game's card: a "How to play" that opens by itself the first time
  const head = card.querySelector('.g-head');
  if (SOUNDS.has(th.kind) && head && !head.querySelector('.sfx-btn')) head.appendChild(soundButton());
  card.dataset.of = th.id; // not data-id: the stage's own drag and lookups stay on the board
  card.style.position = 'absolute';
  card.style.left = at.x + 'px'; card.style.top = at.y + 'px';
  card.style.width = cw + 'px';
  // it ends above the ask bar and scrolls inside, thin and lit, with a "more" fade: the one box that holds every step (owner, 2026-10-18)
  const dockTop = () => { const d = typeof document !== 'undefined' && document.getElementById('dock'), r = document.getElementById('row'); const t = [d, r].filter(Boolean).map((e) => e.getBoundingClientRect().top).filter((v) => v > 0); return t.length ? Math.min(...t) : (typeof innerHeight === 'number' ? innerHeight : 900) - 120; };
  const fit = () => {
    if (!card.isConnected || !card.parentElement) return;
    const stageTop = card.parentElement.getBoundingClientRect().top, top = parseFloat(card.style.top) || 0, floor = dockTop() - stageTop;
    if (top >= (typeof innerHeight === 'number' ? innerHeight : 900) + 200) return; // far off the screen: leave it
    const had = card.style.maxHeight; card.style.maxHeight = 'none';
    const content = card.scrollHeight + (card.offsetHeight - card.clientHeight); // everything it holds, borders included
    card.style.maxHeight = had;
    const r = fitPanel({ top, content: Math.min(content, Math.max(120, floor - 12 - top)), floor });
    if (card.style.maxHeight !== r.maxHeight + 'px') card.style.maxHeight = r.maxHeight + 'px';
    card.style.overflowY = 'auto';
    if (Math.abs(r.top - top) > 1 && !(th.scale < 1)) { card.style.top = r.top + 'px'; th.card = { x: parseFloat(card.style.left) || 0, y: r.top }; stageApi.save && stageApi.save(); }
    const more = card.scrollHeight > card.clientHeight + 1;
    card.classList.toggle('scrolls', more); card.classList.toggle('at-end', !more || card.scrollTop + card.clientHeight >= card.scrollHeight - 2);
  };
  card.addEventListener('scroll', () => card.classList.toggle('at-end', card.scrollTop + card.clientHeight >= card.scrollHeight - 2), { passive: true });
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => fit()); ro.observe(card); const d = document.getElementById('dock'); if (d) ro.observe(d); }
  if (typeof addEventListener === 'function') { addEventListener('resize', fit); if (window.visualViewport) window.visualViewport.addEventListener('resize', fit); }
  card.style.cursor = 'grab';
  card.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || (e.target && e.target.closest && e.target.closest('button,input,select,a'))) return;
    e.stopPropagation();
    const sx = e.clientX, sy = e.clientY, ox = parseFloat(card.style.left) || 0, oy = parseFloat(card.style.top) || 0;
    const move = (ev) => {
      card.style.left = ox + ev.clientX - sx + 'px'; card.style.top = oy + ev.clientY - sy + 'px';
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up);
      th.card = { x: parseFloat(card.style.left) || 0, y: parseFloat(card.style.top) || 0 };
      stageApi.save && stageApi.save();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  });
  stageApi.stage.appendChild(card);
  fit(); requestAnimationFrame(fit);
  card.fitPanel = fit; // the stage asks for a fresh fit after it moves the card
  return card;
}
