/**
 * shape skill — the one outline shape on the stage: "draw a circle", "make a square", "draw a line", "remove the shape";
 * "make it bigger", "make the shape blue" go through the page's shared targeting (ensure and alter below). A circle is
 * alive (skills/void-ring.js). Moved out of void.html in cleanup step 6; its asks are answered by the stage kind's ask
 * hook at the same point in the page's built-in order as before, and match takes only the plain "draw a circle" forms.
 */

const SHAPE_WORD = /\b(shape|rect|rectangle|circle|line|square)\b/;

/** the shape type an ask names ('rect' when it names none). Pure. */
export function typeOf(lower, raw = lower) {
  if (/\bcircle\b/.test(lower)) return 'circle';
  if (/\bline\b/.test(lower)) return 'line';
  if (/\b(rect|rectangle|square)\b/.test(lower)) return 'rect';
  const m = String(raw).match(/^shape\s*:\s*(rect|rectangle|circle|line|square)\b/i);
  if (m) return /^(square|rectangle)$/i.test(m[1]) ? 'rect' : m[1].toLowerCase();
  return 'rect';
}

/** what an ask wants of the shape: { act: 'create', type } | { act: 'remove' } | null. Pure.
 *  ctx.picked: the picked thing is the shape */
export function shapeIntent(lower, raw = lower, ctx = {}) {
  const l = String(lower || '');
  if (/\b(remove|delete|get\s+rid\s+of|hide|clear|cancel|erase)\b.*\b(shape|rect|rectangle|circle|line|square)\b/.test(l)) return { act: 'remove' };
  if (/\b(shape|rect|rectangle|circle|line|square)\b.*\b(away|gone)\b/.test(l)) return { act: 'remove' };
  if (ctx.picked && /^(remove|delete|get\s+rid\s+of|hide|clear|cancel|erase)\s+(it|this)\s*[.!]?\s*$/.test(l)) return { act: 'remove' };
  if (/\b(remove|delete|get\s+rid\s+of|hide|clear)\b/.test(l) && SHAPE_WORD.test(l)) return null;
  const create = /^(a\s+)?(shape|rect|rectangle|circle|line|square)(\s+please)?\s*[.!]?\s*$/.test(l)
    || /\b(draw|sketch)\b.*\b(circle|rect|rectangle|line|square|shape)\b/.test(l)
    || /\b(make|add|create|show|spawn|put|place|drop|summon)\b.*\b(shape|rect|rectangle|circle|line|square)\b/.test(l)
    || /\b(shape|rect|rectangle|circle|line|square)\b.*\b(please|here|on\s+(the\s+)?(stage|screen|page))\b/.test(l)
    || /^shape\s*:\s*(rect|rectangle|circle|line|square)\b/i.test(String(raw));
  return create ? { act: 'create', type: typeOf(l, raw) } : null;
}

/** the plain asks the skill takes before the page's own parser runs: "draw a circle", "make a square", "a line please".
 *  Anything more ("draw a red square", "make the shape bigger") goes on to the page's shared targeting. Pure. */
export const plainShape = (lower) => /^(?:please\s+)?(?:(?:draw|sketch|make|add|create|show|put|place|drop|summon)\s+(?:me\s+)?)?(?:a\s+|an\s+)?(?:new\s+)?(shape|rect|rectangle|circle|line|square)(?:\s+please)?\s*[.!]?$/.test(String(lower || '').trim());

/** "make it bigger", "make it a circle", "fill it": changes th; true when something changed */
export function alter(th, lower) {
  let ok = false;
  if (/\b(bigger|larger|increase|grow|enlarge)\b/.test(lower)) { th.width = Math.min(400, (th.width || 80) + 40); th.height = Math.min(400, (th.height || 80) + 40); ok = true; }
  if (/\b(smaller|tinier|decrease|shrink)\b/.test(lower)) { th.width = Math.max(20, (th.width || 80) - 40); th.height = Math.max(20, (th.height || 80) - 40); ok = true; }
  if (/\b(huge|giant|enormous|massive)\b/.test(lower)) { th.width = 200; th.height = 200; ok = true; }
  if (/\b(tiny|mini|petite)\b/.test(lower)) { th.width = 40; th.height = 40; ok = true; }
  if (/\b(big|large)\b/.test(lower) && !/\bbigger\b|\blarger\b/.test(lower)) { th.width = Math.max(th.width || 80, 160); th.height = Math.max(th.height || 80, 160); ok = true; }
  if (/\b(small|little)\b/.test(lower) && !/\bsmaller\b/.test(lower)) { th.width = Math.min(th.width || 80, 50); th.height = Math.min(th.height || 80, 50); ok = true; }
  if (/\b(make\s+(?:it\s+)?a?\s*(?:rect|rectangle|square))\b/.test(lower) && th.shapeType !== 'rect') { th.shapeType = 'rect'; ok = true; }
  if (/\b(make\s+(?:it\s+)?a?\s*circle)\b/.test(lower) && th.shapeType !== 'circle') { th.shapeType = 'circle'; ok = true; }
  if (/\b(make\s+(?:it\s+)?a?\s*line)\b/.test(lower) && th.shapeType !== 'line') { th.shapeType = 'line'; ok = true; }
  if (/\bfill(?:ed)?\b/.test(lower)) { th.filled = true; ok = true; }
  if (/\b(unfill|outline|stroke)\b/.test(lower)) { th.filled = false; ok = true; }
  if (/\b(thick|thicker)\b/.test(lower)) { th.strokeWidth = Math.min(8, (th.strokeWidth || 2) + 2); ok = true; }
  if (/\b(thin|thinner)\b/.test(lower)) { th.strokeWidth = Math.max(1, (th.strokeWidth || 2) - 1); ok = true; }
  return ok;
}

const shapeOf = (stageApi) => Object.values(stageApi.things()).find((t) => t && t.kind === 'shape') || null;

/** the one shape, put up in the middle of the stage when there is none (a rect unless told); it becomes the picked thing */
export function ensure(stageApi, shapeType = 'rect') {
  const things = stageApi.things();
  let s = shapeOf(stageApi);
  if (!s) {
    const st = stageApi.stage, size = 80;
    s = { id: 'shape-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), kind: 'shape',
      x: Math.max(40, (st.clientWidth || 800) / 2 - size / 2), y: Math.max(40, (st.clientHeight || 600) / 2 - size / 2),
      width: size, height: size, shapeType: shapeType || 'rect', strokeWidth: 2, filled: false };
    things[s.id] = s;
    stageApi.select(s.id);
  }
  return s;
}

function mount(th, stageApi) {
  const el = document.createElement('div');
  el.className = 'thing shape';
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  if (th.width) el.style.width = th.width + 'px';
  if (th.height) el.style.height = th.height + 'px';
  if (th.color) el.style.setProperty('--shape-color', th.color);
  if (th.filled) el.classList.add('filled');
  const shapeType = th.shapeType || 'rect';
  if (stageApi.selected() === th.id && shapeType !== 'circle') el.style.outline = '1px solid rgba(255,255,255,0.25)';
  const inner = document.createElement('div');
  inner.className = shapeType === 'circle' ? 'shape-circle' : shapeType === 'line' ? 'shape-line' : 'shape-rect';
  if (shapeType === 'triangle') { // the caution shape (skills/technical-context.js): a filled amber triangle with a mark in it
    inner.style.clipPath = 'polygon(50% 4%, 97% 94%, 3% 94%)'; inner.style.background = th.color || '#f5a623'; inner.style.border = '0'; inner.style.opacity = '0.9';
  }
  inner.style.width = '100%';
  if (shapeType !== 'line') inner.style.height = '100%';
  else if (th.rotation) inner.style.transform = 'rotate(' + th.rotation + 'deg)';
  inner.style.borderWidth = (th.strokeWidth || 2) + 'px';
  if (th.color) inner.style.borderColor = th.color;
  el.appendChild(inner);
  if (shapeType === 'circle') {
    // a circle is alive (skills/void-ring.js): a breathing WebGL ring with a dark feathered hole that takes in what you
    // type; a tap makes it ripple. No box, no label. Where WebGL can't run, the CSS ring stays, softened.
    inner.style.borderColor = 'rgba(232,236,255,0.55)';
    inner.style.boxShadow = '0 0 18px rgba(200,210,255,0.18), inset 0 0 22px rgba(0,0,0,0.9)';
    import('./void-ring.js').then((m) => {
      const c = m.ringCanvas(th.id, th.color || '#e8ecff'); if (!c || !el.isConnected) return;
      el.style.overflow = 'visible'; el.appendChild(c); inner.style.opacity = '0';
      if (!el._ringTap) { el._ringTap = true; el.addEventListener('pointerdown', () => m.pulse()); }
    }).catch(() => {});
  } else {
    const label = document.createElement('div');
    label.className = 'shape-label';
    label.textContent = shapeType === 'triangle' ? '!' : shapeType;
    if (shapeType === 'triangle') { label.style.cssText = 'color:#1a1200;font-weight:700;font-size:28px;top:42%;opacity:1'; if (th.caption) el.title = th.caption; }
    el.appendChild(label);
  }
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

/** the ask on the stage as it is now: what it did ('shape-circle', 'shape-removed'), or '' when it is not the shape's */
export function ask(lower, text, stageApi) {
  const things = stageApi.things(), picked = things[stageApi.selected()];
  const it = shapeIntent(lower, text, { picked: !!picked && picked.kind === 'shape' });
  if (!it) return '';
  if (it.act === 'remove') {
    const s = picked && picked.kind === 'shape' ? picked : shapeOf(stageApi);
    if (!s) return '';
    delete things[s.id];
    if (stageApi.selected() === s.id) stageApi.select(null);
    stageApi.save(); stageApi.render();
    return 'shape-removed';
  }
  // "draw a line" with a rect already up: the one shape becomes a line (it used to say shape-line and stay a rect)
  const s = ensure(stageApi, it.type);
  s.shapeType = it.type;
  const col = stageApi.colorFrom ? stageApi.colorFrom(lower) : null;
  if (s && col) s.color = col;
  stageApi.save(); stageApi.render();
  return 'shape-' + it.type;
}

export default {
  name: 'shape',
  shapeIntent,
  examples: ['draw a circle', 'make a square', 'draw a line'],
  nearMisses: ['what shape is the earth', 'get in shape'],
  match(lower) { return plainShape(lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'shape' : 'none'; },
  // alterWords: the page's shared targeting takes "make it thicker", "fill it", "make it a circle" for the shape too
  stageKinds: { shape: { mount, ensure: (stageApi) => ensure(stageApi, 'rect'), alter, ask,
    alterWords: /\b(?:fill(?:ed)?|unfill|outline|stroke|thick(?:er)?|thin(?:ner)?|make\s+(?:it\s+)?a?\s*(?:rect|rectangle|square|circle|line))\b/ } },
};
