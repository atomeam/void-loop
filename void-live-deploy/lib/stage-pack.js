// Shared bits of stage pack A (minimap, ask-clipboard, decision-matrix, habit-ring, recipe-stack; owner, 2026-10-18).
// Everything is device-local and client-side: nothing here sends anything anywhere. Pure unless it says it touches the stage.

/** HTML-escape a value before it goes into markup. Pure. */
export const escHtml = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** a calendar day on this device as YYYY-MM-DD (local time, not UTC). Pure. */
export function localDay(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** the ask without its polite edges, lower-cased. Pure. */
export const tidy = (s) => String(s || '').trim().replace(/\s+/g, ' ').replace(/[.!]+$/, '');

/** put a new thing of `kind` on the stage (fanned a little so two never sit on top of each other); it becomes the picked one */
export function addThing(stageApi, kind, props = {}) {
  const things = stageApi.things(), st = stageApi.stage, n = Object.values(things).filter((t) => t && t.kind === kind).length;
  const w = st.clientWidth || 800, h = st.clientHeight || 600;
  const th = { id: kind + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind,
    x: Math.min(Math.max(20, w - 300), Math.max(30, w / 2 - 140) + n * 28), y: Math.min(Math.max(20, h - 200), Math.max(40, h / 3) + n * 28), ...props };
  things[th.id] = th;
  stageApi.select(th.id);
  return th;
}

export const firstOf = (stageApi, kind) => Object.values(stageApi.things()).find((t) => t && t.kind === kind) || null;

/** the card's outer element, placed and draggable (inputs and buttons inside it must stop pointerdown themselves: see keepOut) */
export function cardEl(th, stageApi, cls) {
  const el = document.createElement('div');
  el.className = 'thing ' + cls;
  el.dataset.id = th.id;
  el.style.cssText = 'left:' + (+th.x || 0) + 'px;top:' + (+th.y || 0) + 'px;padding:12px 14px;border-radius:14px;background:rgba(20,20,30,.88);border:1px solid rgba(255,255,255,.14);color:#e8e8e8;font:14px/1.35 system-ui,sans-serif;max-width:min(92vw,520px)';
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  return el;
}

/** a tap or edit inside a card is not a drag of the card */
export function keepOut(node) {
  for (const ev of ['pointerdown', 'mousedown', 'touchstart']) node.addEventListener(ev, (e) => e.stopPropagation());
  return node;
}

/** remove every thing of `kind`; true when there was one */
export function removeKind(stageApi, kind) {
  const things = stageApi.things(); let any = false;
  for (const [id, t] of Object.entries(things)) if (t && t.kind === kind) { delete things[id]; any = true; if (stageApi.selected() === id) stageApi.select(null); }
  if (any) { stageApi.save(); stageApi.render(); }
  return any;
}
