// The brain map on /brain/ (owner, 2026-10-30: "really wow people by having things anyone can see and understand they are looking at a real
// functional brain"; "dont fake it"): the organs of the page's one brain, grouped by what they do, beside its tissue. Every 250 ms it reads
// the brain (lib/brain-map.js snap) and draws only what changed since the last read:
//   an organ lights when Attention gave it a turn (b.runs grew), with a spark from Attention to it
//   a spark flies from an organ to the region of the shared working memory it wrote into (ws.regionWrites grew), and each region wears the
//   colour of the organ that wrote there most; the region the attention holds is outlined, with the idea it is thinking about
//   the feed says each change in plain words ("Concepts learned "maps"", "Will imagined 2 futures and chose gather")
//   the box tells it words or asks it why; what happened in the brain in the next seconds is listed in order and drawn as a path
// The numbers under it are counted from the same reads: ticks, turns, cells written and futures imagined a second.
// The tissue keeps the rest of the screen and still takes the pointer. "Tissue only" hides the map (kept on this device).
import * as B from '/lib/brain.js';
import * as M from '/lib/brain-map.js';

const SVG = 'http://www.w3.org/2000/svg';
const $ = (s) => document.querySelector(s);
const view = $('#mapView'), svg = $('#map'), feed = $('#feed'), form = $('#mapAsk'), box = $('#mapWord'), viewBtn = $('#viewBtn'), counts = $('#mapCounts');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, attrs = {}, text) => { const n = document.createElementNS(SVG, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; return n; };
const brain = () => (window.verseBrainField && window.verseBrainField.state && window.verseBrainField.state.b) || null;
const KEEP = 'a2m.brain.map.v1';
let on = true; try { on = localStorage.getItem(KEEP) !== 'off'; } catch (_) { /* no storage: the map shows */ }

// ---- docking: the map takes the left of the screen (a phone: the top), the tissue the rest; nothing covers either ------------------------------
const root = document.documentElement.style, narrow = () => matchMedia('(max-width: 720px)').matches;
let docked = '';
const dock = () => {
  const pw = document.body.classList.contains('panel-open') && !narrow() ? $('#panel').offsetWidth : 0;
  const top = $('#bar').offsetHeight, live = $('#live'), hud = live.hidden ? 0 : live.offsetHeight;
  const mw = on && !narrow() ? Math.round((innerWidth - pw) * 0.5) : 0, mh = on && narrow() ? Math.round((innerHeight - top - hud) * 0.68) : 0;
  const sig = [on, mw, mh].join(); if (sig === docked) return; docked = sig;
  document.body.classList.toggle('map-on', on); view.hidden = !on;
  root.setProperty('--mapw', mw + 'px'); root.setProperty('--maph', mh + 'px');
  viewBtn.setAttribute('aria-pressed', String(!on)); viewBtn.textContent = on ? 'Tissue only' : 'Show the map';
  layoutNow = null;
};
viewBtn.addEventListener('click', () => { on = !on; try { localStorage.setItem(KEEP, on ? 'on' : 'off'); } catch (_) { /* kept for this visit only */ } dock(); });

// ---- the drawing: built once a size, then only lights, sparks and colours change --------------------------------------------------------------
let layoutNow = null, parts = null;
const hueOf = (id, L) => (id === 'attention' ? 52 : id === 'you' ? 196 : L.nodes[id] ? L.nodes[id].hue : 0);
const build = (b) => {
  const r = svg.getBoundingClientRect(), w = Math.max(240, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
  const L = M.layout(B.ORGAN_IDS, w, h); layoutNow = L; svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h); svg.replaceChildren();
  const fs = Math.max(9.5, Math.min(13, L.unit * 0.026)), wires = el('g', { class: 'wires' }), lobes = el('g'), nodes = el('g'), gridG = el('g'), sparks = el('g', { class: 'sparks' }), path = el('polyline', { class: 'path', points: '' });
  // the brain's outline: two soft lobes, just a frame for what is inside
  const bb = L.brain; svg.append(el('ellipse', { class: 'outline', cx: bb.x + bb.w * 0.5, cy: bb.y + bb.h * 0.5, rx: bb.w * 0.49, ry: bb.h * 0.47 }));
  const node = {};
  for (const l of L.lobes) {
    lobes.append(el('circle', { class: 'lobe', cx: l.x, cy: l.y, r: l.r, style: '--h:' + l.hue }));
    lobes.append(el('text', { class: 'lobe-name', x: l.x, y: l.y - l.r - fs * 0.35, 'font-size': fs * 1.1, 'text-anchor': 'middle' }, l.name));
    for (const id of l.organs) {
      const p = L.nodes[id];
      wires.append(el('line', { x1: L.hub.x, y1: L.hub.y, x2: p.x, y2: p.y }));
      const g = el('g', { class: 'organ', style: '--h:' + p.hue, 'data-id': id });
      const c = el('circle', { cx: p.x, cy: p.y, r: L.unit * 0.022 }); const t = el('title', {}, M.nameOf(id) + ': ' + (M.ROLE[id] || ''));
      g.append(t, c, el('text', { x: p.x, y: p.y + L.unit * 0.022 + fs + 1, 'font-size': fs, 'text-anchor': 'middle' }, M.nameOf(id)));
      nodes.append(g); node[id] = { g, c };
    }
  }
  const hub = el('g', { class: 'hub' }); hub.append(el('circle', { cx: L.hub.x, cy: L.hub.y, r: L.unit * 0.04 }), el('text', { x: L.hub.x, y: L.hub.y + fs * 0.35, 'font-size': fs * 1.05, 'text-anchor': 'middle' }, 'Attention'));
  const hubSub = el('text', { class: 'sub', x: L.hub.x, y: L.hub.y + L.unit * 0.04 + fs * 1.2, 'font-size': fs * 0.9, 'text-anchor': 'middle' }, '');
  hub.append(hubSub); node.attention = { g: hub, c: hub.firstChild };
  // the shared working memory: 12 regions of the one workspace every organ reads and writes
  const G = L.grid, cells = [];
  gridG.append(el('text', { class: 'grid-name', x: G.x, y: G.y - fs * 2.1, 'font-size': fs * 1.1 }, 'Working memory'));
  const think = el('text', { class: 'sub', x: G.x, y: G.y - fs * 0.7, 'font-size': fs * 0.9 }, '');
  gridG.append(think);
  for (const c of G.cells) {
    const g = el('g', { class: 'cell' }), rect = el('rect', { x: c.x + 1.5, y: c.y + 1.5, width: c.w - 3, height: c.h - 3, rx: 5 }), lab = el('text', { x: c.x + c.w / 2, y: c.y + c.h / 2 + fs * 0.35, 'font-size': fs * 0.85, 'text-anchor': 'middle' }, '');
    g.append(el('title', {}, 'The ' + M.regionName(c.r) + ' of the working memory'), rect, lab); gridG.append(g); cells.push({ g, rect, lab });
  }
  svg.append(wires, lobes, gridG, path, nodes, sparks);
  parts = { node, cells, sparks, path, hubSub, think, fs };
  paintCells(b, null);
};

// ---- the reads: four a second; the sparks and lights between them come from what each read found -----------------------------------------
let last = null, lastAt = 0, live = [], flash = {}, trace = null;
const center = (id) => (!layoutNow ? null : id === 'attention' || id === 'you' ? layoutNow.hub : layoutNow.nodes[id]);
const cellCenter = (r) => { const c = layoutNow && layoutNow.grid.cells[r]; return c ? { x: c.x + c.w / 2, y: c.y + c.h / 2 } : null; };
const spark = (from, to, hue, born) => { if (live.length < 90) live.push({ from, to, hue, born, life: 650 + Math.random() * 250 }); };
const paintCells = (b, flow) => {
  if (!parts) return;
  const max = flow ? Math.max(1, ...flow.perRegion.map((p) => p.n)) : 1;
  parts.cells.forEach((c, r) => {
    const p = flow ? flow.perRegion[r] : { top: null, n: 0 }, focus = b && b.focus.region === r;
    c.g.classList.toggle('focus', !!focus);
    if (p.top) { c.rect.style.setProperty('--h', hueOf(p.top, layoutNow)); c.rect.style.setProperty('--a', (0.18 + 0.62 * (p.n / max)).toFixed(2)); c.lab.textContent = M.nameOf(p.top); c.g.classList.add('lit'); }
    else { c.g.classList.remove('lit'); c.lab.textContent = ''; }
  });
  const t = b && b.board.thinking; parts.think.textContent = (b ? 'Focus: ' + M.regionName(b.focus.region) : '') + (t ? ' · thinking about "' + t + '"' : '');
};
const KIND_EVERY = { gen: 9000, gesture: 4000, motif: 6000, surprise: 2500, focus: 1500 }; // the feed stays readable: a busy kind speaks at most this often
const spoke = {};
const say = (e, now) => {
  const key = e.organ + ':' + e.kind, gap = KIND_EVERY[e.kind] || 0;
  if (gap && spoke[key] && now - spoke[key] < gap) return; spoke[key] = now;
  const li = document.createElement('li'); li.style.setProperty('--h', hueOf(e.organ, layoutNow || { nodes: {} }));
  const who = document.createElement('b'); who.textContent = M.nameOf(e.organ); li.append(who, ' ' + e.text.replace(new RegExp('^' + M.nameOf(e.organ) + ' '), ''));
  feed.prepend(li); while (feed.children.length > 7) feed.lastElementChild.remove();
};
const read = (now) => {
  const b = brain(); if (!b) return;
  if (!layoutNow) build(b);
  const z = M.snap(b, B.selfOf(b)), flow = M.flowOf(last, z), events = M.eventsOf(last, z), dt = now - lastAt;
  if (Object.keys(flow.turns).length) flash.attention = now; // Attention gave turns since the last read
  for (const id of Object.keys(flow.turns)) { if (!parts.node[id]) continue; flash[id] = now; spark('attention', id, hueOf(id, layoutNow), now); }
  for (const w of flow.writes.slice(0, 14)) { if (w.organ === 'you' || !center(w.organ)) continue; spark(w.organ, 'r' + w.region, hueOf(w.organ, layoutNow), now + 120); }
  paintCells(b, flow);
  for (const e of events) say(e, now);
  if (trace) { trace.events.push(...events); if (now - trace.at > 4500 || M.pathOf(trace.events, trace.text).length >= 6) endTrace(); }
  if (last) {
    const c = M.countsOf(last, z, dt, flow);
    counts.textContent = c.tps + (c.tps === 1 ? ' thought' : ' thoughts') + ' a second · ' + c.turns + ' organ turns a second · ' + c.cells.toLocaleString() + ' memory cells written a second · ' + c.futures + ' futures imagined a second · ' + c.words + ' words, ' + c.goals + ' goals, ' + c.moments + ' moments held';
    parts.hubSub.textContent = c.turns + ' turns a second';
  }
  for (const [id, n] of Object.entries(parts.node)) { if (id === 'attention') continue; const share = b.recent[id] || 0; n.c.setAttribute('r', (layoutNow.unit * (0.014 + 0.03 * Math.min(1, share * 2.2))).toFixed(1)); }
  last = z; lastAt = now;
};

// ---- an ask: the card's own box takes it, so the card, the host and what it keeps hear it as they hear any word ------------------------------
const PATH_KINDS = new Set(['learned', 'goal', 'thinking', 'focus', 'chose', 'moment', 'surprise']);
const endTrace = () => {
  const steps = M.pathOf(trace.events.filter((e) => PATH_KINDS.has(e.kind)), trace.text); trace = null;
  const li = document.createElement('li'); li.className = 'thought';
  const h = document.createElement('b'); h.textContent = steps.length > 1 ? 'After you asked, in order:' : 'After you asked, nothing it holds changed yet.'; li.append(h);
  const ol = document.createElement('ol'); for (const s of steps.slice(1)) { const i = document.createElement('li'); i.textContent = s.text; ol.append(i); } li.append(ol);
  feed.prepend(li); while (feed.children.length > 7) feed.lastElementChild.remove();
  const pts = steps.map((s) => center(s.organ)).filter(Boolean).map((p) => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  if (parts) { parts.path.setAttribute('points', pts); parts.path.classList.remove('show'); void parts.path.getBBox(); parts.path.classList.add('show'); }
};
form.addEventListener('submit', (e) => {
  e.preventDefault(); const t = box.value.trim(); box.value = ''; if (!t) return;
  if (M.isKey(t)) { say({ organ: 'you', kind: 'key', text: 'That looks like a key, so it was not told to the brain.' }, performance.now()); return; }
  const b = brain(); if (!b) return;
  if (B.isQuestion(t)) { // a question about itself is answered from its state, and changes nothing
    const r = B.ask(b, t), li = document.createElement('li'); li.className = 'thought'; const h = document.createElement('b'); h.textContent = 'You asked "' + t.slice(0, 60) + '". It answers from its own state:';
    li.append(h, ' ' + (r.answer || []).join(' ')); feed.prepend(li); while (feed.children.length > 7) feed.lastElementChild.remove(); return;
  }
  const cardBox = document.querySelector('#card .vb-word'), cardForm = document.querySelector('#card .vb-form');
  trace = { text: t, at: performance.now(), events: [] };
  if (cardBox && cardForm) { cardBox.value = t.slice(0, 120); cardForm.requestSubmit(); } else B.ask(b, t);
  flash.you = performance.now(); spark('you', 'concepts', 196, performance.now());
});

// ---- the frames: sparks fly, lights fade ------------------------------------------------------------------------------------------------
const pos = (k) => (k[0] === 'r' && /^r\d+$/.test(k) ? cellCenter(+k.slice(1)) : center(k));
let nextRead = 0;
// a resize or a new dock drops the layout (layoutNow = null): it is built again here before a spark is drawn, and the next frame is asked for
// whatever this one met (2026-10-30: a resize between two reads threw in the spark loop and stopped every frame after it, so the map froze)
const frame = (now) => {
  try { draw(now); } catch (err) { console.error('brain map', err); }
  requestAnimationFrame(frame);
};
const draw = (now) => {
  dock();
  if (on && !layoutNow && parts) { const b = brain(); if (b) build(b); }
  if (on && now >= nextRead) { nextRead = now + 250; try { read(now); } catch (err) { console.error('brain map', err); } }
  if (on && parts && layoutNow) {
    for (const [id, n] of Object.entries(parts.node)) { const a = flash[id] ? Math.max(0, 1 - (now - flash[id]) / 700) : 0; n.g.style.setProperty('--lit', a.toFixed(2)); }
    if (still) live.length = 0;
    live = live.filter((s) => now - s.born < s.life);
    const kids = parts.sparks.children;
    while (kids.length < live.length) parts.sparks.append(el('circle', { r: 3.2 }));
    for (let i = 0; i < kids.length; i++) {
      const s = live[i], c = kids[i]; if (!s || now < s.born) { c.setAttribute('opacity', '0'); continue; }
      const a = pos(s.from), z = pos(s.to); if (!a || !z) { c.setAttribute('opacity', '0'); continue; }
      const k = (now - s.born) / s.life, e = k * k * (3 - 2 * k), mx = (a.x + z.x) / 2 + (a.y - z.y) * 0.18, my = (a.y + z.y) / 2 + (z.x - a.x) * 0.18;
      const x = (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * mx + e * e * z.x, y = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * my + e * e * z.y;
      c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('opacity', (Math.sin(Math.PI * k) * 0.95).toFixed(2)); c.style.setProperty('--h', s.hue);
    }
  }
};
addEventListener('resize', () => { layoutNow = null; });
if (typeof ResizeObserver === 'function') new ResizeObserver(() => { layoutNow = null; }).observe(svg);
dock(); requestAnimationFrame(frame);
