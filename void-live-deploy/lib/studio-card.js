// The frame every Verse Studio grid game wears (domains/void.game-studio.md): a card on the stage with a title, a board slot, a status line, Verse's own line
// (what player two did and why), and New game. The game's pure rules live in skills/<game>-rules.js; the card only draws them and sends the person's moves.
// Same look as skills/arcade-card.js, but made of buttons (reachable by keyboard and a screen reader) instead of a canvas.
import { keepOut } from './stage-pack.js';

export function studioCard(th, stageApi, { cls, title, sub, width = 300 }) {
  const el = document.createElement('div');
  el.className = 'thing kept-card game-card studio-card ' + cls; el.dataset.id = th.id; el.tabIndex = 0;
  el.style.cssText = 'left:' + (+th.x || 0) + 'px;top:' + (+th.y || 0) + 'px;width:min(' + width + 'px, calc(100vw - 20px));padding:10px 12px;border-radius:14px;background:rgba(20,20,30,.9);border:1px solid rgba(255,255,255,.14);color:#e8e8e8;font:14px/1.35 system-ui,sans-serif';
  const head = document.createElement('div'); head.className = 'g-head'; head.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px';
  const t = document.createElement('b'); t.className = 'g-title'; t.textContent = title;
  const sb = document.createElement('span'); sb.className = 'g-sub'; sb.style.cssText = 'font-size:11.5px;opacity:.65'; sb.textContent = sub;
  head.append(t, sb);
  const body = document.createElement('div'); body.className = cls + '-board';
  const status = document.createElement('div'); status.className = 'g-status ' + cls + '-status'; status.setAttribute('aria-live', 'polite'); status.style.cssText = 'font-size:13px;margin-top:8px';
  const why = document.createElement('div'); why.className = cls + '-why'; why.style.cssText = 'font-size:11.5px;color:var(--muted,#8a8a8a);min-height:1.4em';
  const tools = document.createElement('div'); tools.className = 'g-tools'; tools.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px';
  const again = document.createElement('button'); again.type = 'button'; again.className = 'g-btn ' + cls + '-new'; again.textContent = 'New game';
  tools.append(again); el.append(head, body, status, why, tools);
  for (const n of [body, again]) keepOut(n);
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
  const button = (label, fn, extra = '') => { const b = document.createElement('button'); b.type = 'button'; b.className = 'g-btn ' + extra; b.textContent = label; keepOut(b); b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); tools.insertBefore(b, again); return b; };
  return { el, body, status, why, again, tools, button };
}

/** run fn every `ms` while the card is on the page and the tab is visible; returns stop(). */
export function every(el, ms, fn) {
  const id = setInterval(() => { if (!el.isConnected) { clearInterval(id); return; } if (!document.hidden) fn(); }, ms);
  return () => clearInterval(id);
}

/** the words for the end of a seat-vs-seat game: 'you', 'void' or 'draw' to one line. */
export const verdict = (over, you = 'You win', verse = 'Verse wins', draw = 'A draw') => (over === 'you' ? you : over === 'void' ? verse : over === 'draw' ? draw : '');
