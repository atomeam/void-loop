/**
 * constellation-weaver - "weave a constellation called night ops" draws glowing lines between the things on your stage (all of them, or
 * the ones you name: "... from the timer and the note"), with the name written beside it, and keeps it as ONE stage object (kind 'weave').
 * "summon night ops" brings a woven constellation back: it flashes the one on the stage, or weaves it again from the things it was made of
 * that are still there. Asked by the owner, 2026-10-18 (stage pack D). Client-side only: nothing is sent anywhere. The recipe (name and the
 * ids it joined) is kept on this device (a2m.void.weaves.v1); nothing appears until asked.
 * Not the real sky: "what is a constellation", "where is Orion" stay with skills/constellation.js.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { refOf, pick } from './label.js';

export const WEAVES_KEY = 'a2m.void.weaves.v1';
const MAX_NAME = 40, MAX_STARS = 12;
const SVGNS = 'http://www.w3.org/2000/svg';
const clean = (s) => String(s || '').trim().toLowerCase().replace(/[’]/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const nameOk = (s) => { const n = String(s || '').replace(/^["'“‘]|["'”’]$/g, '').trim(); return n && n.length <= MAX_NAME && /[\p{L}\p{N}]/u.test(n) && !/[<>]/.test(n) ? n : null; };
const WEAVE = /^(?:please\s+)?(?:weave|knit|stitch)\s+(?:me\s+)?(?:a\s+|the\s+|my\s+)?constellation(?:\s+(?:called|named|of)\s+(.+?))?(?:\s+(?:from|out of|with|using)\s+(.+))?$/;

/** "weave a constellation called night ops from the timer and the note" -> { op:'weave', name, refs:[...]|null }. The same for the summon forms. Pure. */
export function weaveAsk(text, known = []) {
  const t = clean(text); if (!t || t.length > 140) return null;
  let m = WEAVE.exec(t);
  if (m) {
    const name = m[1] ? nameOk(m[1]) : 'my constellation'; if (!name) return null;
    const refs = m[2] ? m[2].split(/\s*(?:,|\band\b|\+|&)\s*/).filter(Boolean).map((w) => refOf(w, false)).filter((r) => r && !r.self && r.kind) : null;
    if (m[2] && (!refs || refs.length < 2)) return null;
    return { op: 'weave', name, refs };
  }
  m = /^(?:please\s+)?summon\s+(?:the\s+)?(?:constellation\s+)?(.+?)(?:\s+constellation)?$/.exec(t);
  if (!m) return null;
  const name = nameOk(m[1]); if (!name) return null;
  const explicit = /constellation/.test(t);
  if (explicit || known.some((k) => clean(k) === clean(name))) return { op: 'summon', name };
  return null;
}

/** the saved recipes on this device: { 'night ops': { name, ids } }. */
export function readWeaves(store) {
  try { const v = JSON.parse((store || localStorage).getItem(WEAVES_KEY) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (_) { return {}; }
}
function writeWeaves(w) { try { localStorage.setItem(WEAVES_KEY, JSON.stringify(w)); } catch (_) {} }

/** which of the stage's things take part: the named kinds (the newest of each), else everything but figures, labels and other weaves; at most 12. Pure. */
export function starsOf(things, refs, selected = null) {
  const list = Object.values(things || {}).filter((t) => t && t.kind !== 'figure' && t.kind !== 'weave' && t.kind !== 'label' && Number.isFinite(Number(t.x)));
  if (refs && refs.length) { const out = []; for (const r of refs) { const t = pick(list, r, selected); if (t && !out.includes(t)) out.push(t); } return out; }
  return list.slice(-MAX_STARS);
}

/** the lines of a constellation: the points joined nearest-first in one chain, [[i, j], ...]. Pure. */
export function chainOf(points) {
  if (points.length < 2) return [];
  const left = points.map((_, i) => i).sort((a, b) => points[a].x - points[b].x || points[a].y - points[b].y), out = [];
  let at = left.shift();
  while (left.length) {
    let bi = 0, bd = Infinity;
    left.forEach((j, k) => { const d = Math.hypot(points[j].x - points[at].x, points[j].y - points[at].y); if (d < bd) { bd = d; bi = k; } });
    const j = left.splice(bi, 1)[0]; out.push([at, j]); at = j;
  }
  return out;
}

/** a woven constellation as a stage thing: its name, the ids it joins, and where its label sits (the middle of the stars). Pure. */
export function weaveThing(id, name, stars) {
  const xs = stars.map((s) => Number(s.x) || 0), ys = stars.map((s) => Number(s.y) || 0);
  return { id, kind: 'weave', name, ids: stars.map((s) => s.id), x: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length), y: Math.max(8, Math.round(Math.min(...ys)) - 34) };
}

const sel = (id) => '[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id) + '"]';
function centreOf(root, id) {
  const el = root.querySelector(sel(id));
  return el ? { x: el.offsetLeft + (el.offsetWidth || 1) / 2, y: el.offsetTop + (el.offsetHeight || 1) / 2 } : null;
}

/** after every redraw and drag: glowing lines under the things, between the stars of each weave. */
export function decorate(st) {
  const root = st && st.stage; if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('.void-weave-lines').forEach((n) => n.remove());
  const things = st.things ? st.things() : {};
  const weaves = Object.values(things).filter((t) => t && t.kind === 'weave');
  if (!weaves.length) return;
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'void-weave-lines'); svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', Math.max(root.scrollWidth, root.clientWidth)); svg.setAttribute('height', Math.max(root.scrollHeight, root.clientHeight));
  svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:0;color:#bcd0ff;filter:drop-shadow(0 0 4px #7aa2ff)';
  for (const w of weaves) {
    const pts = (w.ids || []).map((id) => ({ id, ...centreOf(root, id) })).filter((p) => Number.isFinite(p.x));
    for (const [i, j] of chainOf(pts)) {
      const ln = document.createElementNS(SVGNS, 'line');
      ln.setAttribute('x1', pts[i].x.toFixed(1)); ln.setAttribute('y1', pts[i].y.toFixed(1)); ln.setAttribute('x2', pts[j].x.toFixed(1)); ln.setAttribute('y2', pts[j].y.toFixed(1));
      ln.setAttribute('stroke', 'currentColor'); ln.setAttribute('stroke-width', '1.6'); ln.setAttribute('stroke-linecap', 'round'); ln.setAttribute('stroke-opacity', '.85');
      svg.appendChild(ln);
    }
    for (const p of pts) { const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1)); c.setAttribute('r', '3'); c.setAttribute('fill', 'currentColor'); svg.appendChild(c); }
  }
  root.insertBefore(svg, root.firstChild);
}

// the label: a small draggable chip with the name; thrown off the screen it is gone from the stage, and "summon <name>" weaves it again
function mount(th, st) {
  const el = document.createElement('div');
  el.className = 'thing void-weave'; el.dataset.id = th.id;
  el.textContent = '✦ ' + (th.name || 'constellation'); // textContent: the name is never HTML
  el.setAttribute('aria-label', 'constellation: ' + (th.name || ''));
  el.style.cssText += ';left:' + th.x + 'px;top:' + th.y + 'px;padding:2px 8px;cursor:grab;user-select:none;white-space:nowrap;font-size:13px;letter-spacing:.06em;color:#cfdcff;text-shadow:0 0 8px #7aa2ff;background:transparent;border:0';
  st.bindDrag(el, th);
  st.stage.appendChild(el);
}

function flash(root, ids) {
  let calm = false; try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  if (calm) return;
  for (const id of ids) { const el = root.querySelector(sel(id)); if (el && el.animate) el.animate([{ filter: 'drop-shadow(0 0 14px #7aa2ff)' }, { filter: 'none' }], { duration: 1200 }); }
}

async function run(text, api) {
  const saved = readWeaves(), ask = weaveAsk(text, Object.values(saved).map((w) => w.name)); if (!ask) return 'none';
  const st = api.stage, things = st.things(), key = clean(ask.name);
  if (ask.op === 'weave') {
    const stars = starsOf(things, ask.refs, st.selected());
    if (stars.length < 2) { api.say(ask.refs ? 'I could not find both of those on the stage' : 'a constellation needs at least two things on the stage'); return 'constellation-weaver'; }
    Object.values(things).filter((t) => t && t.kind === 'weave' && clean(t.name) === key).forEach((t) => { delete things[t.id]; });
    const id = 'weave' + Date.now().toString(36), th = weaveThing(id, ask.name, stars);
    things[id] = th; saved[key] = { name: ask.name, ids: th.ids }; writeWeaves(saved);
    st.save(); st.render();
    api.say('woven: ' + ask.name + ' · say "summon ' + ask.name + '" to bring it back');
    return 'constellation-weaver';
  }
  const onStage = Object.values(things).find((t) => t && t.kind === 'weave' && clean(t.name) === key);
  if (onStage) { st.select(onStage.id); flash(st.stage, [onStage.id, ...onStage.ids]); api.say(ask.name + ' is on the stage'); return 'constellation-weaver'; }
  const rec = saved[key], ids = rec ? (rec.ids || []).filter((i) => things[i]) : [];
  if (ids.length < 2) { api.say(rec ? 'the things in ' + ask.name + ' are gone from the stage' : 'no constellation called ' + ask.name + ' yet · "weave a constellation called ' + ask.name + '"'); return 'constellation-weaver'; }
  const id = 'weave' + Date.now().toString(36), th = weaveThing(id, rec.name, ids.map((i) => things[i]));
  things[id] = th; st.select(id); st.save(); st.render(); flash(st.stage, ids);
  api.say('summoned: ' + rec.name);
  return 'constellation-weaver';
}

export default {
  name: 'constellation-weaver',
  examples: ['weave a constellation called night ops', 'weave a constellation called study from the timer and the note', 'summon the constellation night ops', 'summon night ops constellation'],
  nearMisses: ['what is a constellation', 'where is orion', 'which constellations are up tonight', 'summon a sprite', 'weave a basket', 'summon'],
  weaveAsk, starsOf, chainOf, weaveThing, decorate,
  stageKinds: { weave: { mount } },
  match(lower, text) { return !!weaveAsk(text || lower, Object.values(readWeaves()).map((w) => w.name)); },
  run,
};
