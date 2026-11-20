// The free snail card ("show me a snail", "garden snail in 3D"): a small live 3D garden snail in a card, with its real name and one sourced
// line, and a link to the full page (/world/, a UniVerse page: slow time, look inside, change the weather, every fact with its source).
// A card is free; the full page is UniVerse. The 3D is skills/mini/snail.js; where WebGL cannot run, the card is the words and the link.
export const SNAIL_RE = /^(?:(?:show|bring|summon|open|see|view|give)\s+(?:me\s+)?|let me see\s+|i want to see\s+)?(?:a\s+|the\s+|my\s+)?(?:(?:garden|3d|three d)\s+)*snail(?:\s+(?:in\s+3d|in\s+three\s+d|card|model|please))?$/;
/** whether an ask wants the snail card. `clean` is the ask lowercased, trimmed, its trailing ?!. dropped. Pure. */
export const snailOf = (clean) => { const t = String(clean || ''); return SNAIL_RE.test(t) && !/^(?:a\s+|the\s+)?snail$/.test(t); }; // a bare "snail" stays a lookup, as a bare "arcade" does
export const SNAIL_NAME = 'Garden snail';
export const SNAIL_LINE = 'Cornu aspersum, the common garden snail: a soft body under a coiled shell of about four and a half whorls, two long eye stalks that carry its eyes, and a single muscular foot that glides on slime.';
export const SNAIL_PAGE = '/world/';
/** the card's mount: a drag-to-look 3D snail, a line, and the link. */
export function mountSnail(th, stageApi) {
  const phone = Math.min(innerWidth, innerHeight) < 560, W = phone ? Math.min(innerWidth - 20, 360) : 380;
  const el = document.createElement('div');
  el.className = 'thing kept-card snail-card'; el.dataset.id = th.id;
  el.style.cssText = 'left:' + (+th.x || 0) + 'px;top:' + (+th.y || 0) + 'px;width:' + W + 'px;padding:12px 14px;border-radius:14px;background:rgba(20,24,18,.92);border:1px solid rgba(159,214,155,.35);color:#eef2e6';
  const head = document.createElement('div'); head.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px';
  const t = document.createElement('b'); t.className = 'g-title'; t.textContent = SNAIL_NAME;
  const sb = document.createElement('span'); sb.className = 'g-sub'; sb.style.cssText = 'font-size:11.5px;opacity:.7'; sb.textContent = 'drag to look around';
  head.append(t, sb);
  const view = document.createElement('div'); view.className = 'snail-view'; view.style.cssText = 'position:relative;width:100%;height:' + Math.round(W * 0.72) + 'px;border-radius:10px;overflow:hidden;background:#0b0f0a';
  view.addEventListener('pointerdown', (e) => e.stopPropagation());
  const p = document.createElement('p'); p.className = 'snail-line'; p.style.cssText = 'font-size:13px;line-height:1.45;margin:8px 0 4px'; p.textContent = SNAIL_LINE;
  const a = document.createElement('a'); a.className = 'snail-more'; a.href = SNAIL_PAGE; a.style.cssText = 'font-size:13px;color:#b8f5a8'; a.textContent = 'Open the full 3D World page \u2192';
  a.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.append(head, view, p, a);
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
  if (stageApi.miniature) stageApi.miniature(view, 'snail', {}, { key: 'snail:' + th.id, place: 'inside', label: 'A garden snail in 3D: drag to look around', minPolar: 0.4, maxPolar: 1.55 }).catch(() => view.remove());
  else view.remove();
}
