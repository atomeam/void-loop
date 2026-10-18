// Small shared bits for the math-transplant stage skills (sheaf-check, spectral-review, task-diagram, gauge-feedback; owner, 2026-10-18).
// Device-local, nothing sent anywhere. Pure unless it says it touches the document.

/** make an element: h('div', { className, style, dataset:{}, onclick }, ...kids). Text goes in through text nodes, never innerHTML. */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

/** a small pill button that is not a drag of its card */
export function pill(label, fn) {
  const b = h('button', { type: 'button', style: 'font:inherit;padding:2px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer' }, label);
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
  for (const ev of ['pointerdown', 'mousedown', 'touchstart']) b.addEventListener(ev, (e) => e.stopPropagation());
  return b;
}

/** copy text to the clipboard; true when it worked. Never throws. */
export async function copyText(text) {
  try { await navigator.clipboard.writeText(String(text)); return true; } catch (_) { return false; }
}

/** split on the separator, trimmed, empties dropped. Pure. */
export const splitOn = (s, re) => String(s || '').split(re).map((x) => x.trim()).filter(Boolean);
