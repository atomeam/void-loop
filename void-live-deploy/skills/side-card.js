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

export function grip(label) {
  const g = document.createElement('div');
  g.className = 'board-grip';
  g.title = 'drag to move the board';
  g.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-top:-6px;padding:3px 12px;border-radius:999px;color:var(--muted,#8a8a8a);font-size:11px;letter-spacing:.06em;text-transform:uppercase;cursor:grab;user-select:none;background:rgba(12,12,13,.35)';
  g.textContent = '⠿ ' + label;
  return g;
}

const CSS = '.side-card{position:absolute;z-index:2;padding:14px 16px;border-radius:var(--radius,16px);background:var(--card-bg,rgba(16,16,18,.94));border:1px solid var(--card-line,rgba(255,255,255,.12));'
  + 'box-shadow:var(--card-shadow,0 18px 50px rgba(0,0,0,.45));color:var(--ink,#eee);font-size:var(--fs-s,13px);line-height:1.45;text-align:left;user-select:none;backdrop-filter:blur(8px)}'
  + '.side-card .g-head{cursor:grab}.side-card button{cursor:pointer}';
function style() {
  if (typeof document === 'undefined' || document.getElementById('side-card-style')) return;
  const s = document.createElement('style'); s.id = 'side-card-style'; s.textContent = CSS; document.head.appendChild(s);
}

export function sideCard(th, stageApi, card, { boardW = 420, boardH = 420, w = 280, gap = 20 } = {}) {
  style();
  const vw = (typeof innerWidth === 'number' ? innerWidth : 1200);
  const beside = th.x + boardW + gap + w <= vw - 8;
  const at = th.card && Number.isFinite(th.card.x) && Number.isFinite(th.card.y) ? th.card
    : beside ? { x: th.x + boardW + gap, y: th.y + Math.round(boardH * 0.18) } : { x: Math.max(8, th.x + Math.round((boardW - Math.min(w, vw - 16)) / 2)), y: th.y + boardH + gap };
  if (!th.card) th.card = { x: at.x, y: at.y }; // from now on the card stays where it is when the board moves
  card.classList.add('side-card');
  howTo(card, th.kind); // every game's card: a "How to play" that opens by itself the first time
  card.dataset.of = th.id; // not data-id: the stage's own drag and lookups stay on the board
  card.style.position = 'absolute';
  card.style.left = at.x + 'px'; card.style.top = at.y + 'px';
  card.style.width = Math.min(w, vw - 16) + 'px';
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
  return card;
}
