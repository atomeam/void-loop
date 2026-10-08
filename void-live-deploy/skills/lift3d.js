/**
 * lift3d — stand an existing 2D game card's board in the void as a 3D board, with the rest of the card (status, buttons,
 * rules) as a separate panel beside it (skills/side-card.js). Not a skill: othello.js, tictactoe.js, mancala.js and
 * aggravation.js import it. The game keeps its rules and its 2D board exactly as they were: the 2D board just hides, and
 *  - a tap on the 3D board clicks the 2D element it names (so every rule, turn lock and Void reply runs unchanged),
 *  - any change the game paints on the 2D board re-sends `snapshot()` to the 3D board.
 * Where WebGL can't run (or the tests switch 3D off) the miniature never loads and the card stays exactly as it was.
 *
 *   lift3d(th, stageApi, el, { kind, board, head, title, W, H, snapshot })
 *     el        the card the game built and put on the stage
 *     board     its 2D board element (hidden once 3D is up)
 *     snapshot  () -> data for skills/mini/<kind>.js; the mini calls data.onTap(selector) to press a 2D element
 */
import { grip, sideCard } from './side-card.js';

const up = new Set(); // miniature keys already drawing: a re-render swaps to 3D at once instead of flashing the 2D board

export function lift3d(th, stageApi, el, { kind, board, title, W, H, snapshot, label }) {
  if (!stageApi.miniature || typeof document === 'undefined') return;
  const key = kind + ':' + th.id;
  const view = document.createElement('div');
  view.className = kind + '-view lift3d-view';
  const shown = 'position:relative;width:100%;height:' + H + 'px';
  // on the page but invisible while it loads (a miniature off the page for ~1.5 s frees itself)
  view.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;visibility:hidden;pointer-events:none';
  view.addEventListener('pointerdown', (e) => e.stopPropagation());
  const press = (sel) => {
    let n = null;
    try { n = board.querySelector(sel); } catch (_) {}
    if (!n) return;
    if (n.click) n.click(); else n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  };
  const data = () => ({ ...snapshot(), onTap: press });
  let mini = null, lifted = false;
  function lift() {
    if (lifted) return;
    lifted = true;
    const card = document.createElement('div');
    card.className = kind + '-side';
    // everything on the card except its board moves to the separate card
    for (const n of [...el.childNodes]) if (n !== view && n !== board && !(n.contains && n.contains(board))) card.appendChild(n);
    const holder = [...el.children].find((n) => n.contains(board));
    if (holder) holder.style.display = 'none';
    el.classList.remove('game-card');
    el.classList.add('free-board');
    el.style.cssText = 'position:absolute;left:' + th.x + 'px;top:' + th.y + 'px;width:' + W + 'px;text-align:center;user-select:none;background:transparent;border:0;box-shadow:none;padding:0';
    view.style.cssText = shown;
    el.append(view, grip(title));
    sideCard(th, stageApi, card, { boardW: W, boardH: H + 24, w: 300 });
  }
  el.appendChild(view);
  if (up.has(key)) lift(); // already 3D: no flash of the flat board on a re-render
  // the game repaints its 2D board after every move (its own, Void's, a new game): follow it
  const obs = new MutationObserver(() => { if (mini) mini.update(data()); });
  obs.observe(board, { subtree: true, childList: true, attributes: true, characterData: true });
  stageApi.miniature(view, kind, data(), { key, label: label || ('3D ' + title + ' board: tap to play; drag to look around'), maxPolar: 1.2, minPolar: 0.12 })
    .then((h) => { mini = h; up.add(key); lift(); h.update(data()); })
    .catch((e) => { obs.disconnect(); up.delete(key); console.warn('[' + kind + '] 3D unavailable, flat board', e); });
}
