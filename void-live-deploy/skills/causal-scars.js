/**
 * causal-scars skill — "map the scars of my decisions: moved to Berlin > rent is high, no car; hired Sam > payroll" /
 * "what depends on this decision": a stage card drawing the scar graph (decisions on the left, the constraints they caused
 * to the right). Hover or tap a decision and everything that would not exist without it is dimmed; "remove" shows what dies
 * with it and asks to accept before anything is deleted. Kept with the stage on this device; nothing is sent anywhere.
 * Asked for by the owner (2026-10-18, "operating laws for serious thought with a machine").
 */
import { addThing, cardEl, keepOut, tidy } from '../lib/stage-pack.js';

const MAXN = 40;

/** a scar ask: { edges: [[from, to]] } (empty edges for the bare ask), or null when it is not one. Pure.
 *  List form: "decision > constraint, constraint; other decision > constraint". A constraint named under two decisions has two causes. */
export function parseScars(text) {
  const m = /^(?:please\s+)?(?:map\s+(?:the\s+)?scars\s+(?:of|from)\s+(?:my\s+)?decisions?|(?:show\s+)?what\s+depends\s+on\s+(?:this|my|that)\s+decision)\s*(?:[:\-]\s*(.+))?$/i.exec(tidy(text));
  if (!m) return null;
  return { edges: m[1] ? parseEdges(m[1]) : [] };
}

/** "A > b, c; d > e" -> [[A,b],[A,c],[d,e]]. Pure. */
export function parseEdges(s) {
  const out = [];
  for (const part of String(s || '').split(/\s*;\s*/)) {
    const [lhs, rhs] = part.split(/\s*(?:>|->|→)\s*/, 2);
    const from = (lhs || '').trim().slice(0, 40);
    if (!from || !rhs) continue;
    for (const to of rhs.split(/\s*,\s*/)) { const t = to.trim().slice(0, 40); if (t && t.toLowerCase() !== from.toLowerCase()) out.push([from, t]); }
  }
  return out;
}

const key = (s) => String(s).trim().toLowerCase();

/** add edges to a graph { nodes:[name], edges:[[a,b]] } without duplicates, loops or more than MAXN nodes. Pure; returns a new graph. */
export function addEdges(g, edges) {
  const out = { nodes: [...(g.nodes || [])], edges: [...(g.edges || [])] };
  const find = (n) => out.nodes.find((x) => key(x) === key(n));
  for (const [a, b] of edges) {
    const fresh = [a, b].filter((n, i, all) => !find(n) && all.findIndex((m) => key(m) === key(n)) === i).length;
    if (out.nodes.length + fresh > MAXN) continue;
    if (!find(a)) out.nodes.push(a);
    if (!find(b)) out.nodes.push(b);
    const A = find(a), B = find(b);
    if (out.edges.some(([x, y]) => x === A && y === B)) continue;
    if (reach(out, [B]).has(A)) continue; // an edge that closes a loop is left out: a scar never causes its own cause
    out.edges.push([A, B]);
  }
  return out;
}

/** every node reachable from the starts, starts included. Pure. */
export function reach(g, starts) {
  const seen = new Set(), todo = [...starts];
  while (todo.length) { const n = todo.pop(); if (seen.has(n)) continue; seen.add(n); for (const [a, b] of g.edges || []) if (a === n) todo.push(b); }
  return seen;
}

/** nodes with no cause: the decisions. Pure. */
export function rootsOf(g) {
  const hasParent = new Set((g.edges || []).map(([, b]) => b));
  return (g.nodes || []).filter((n) => !hasParent.has(n));
}

/** what would not exist without `node`: everything reachable from it that no other surviving decision still reaches. Pure. */
export function dies(g, node) {
  const roots = rootsOf(g).filter((r) => r !== node);
  const alive = reach(g, roots);
  return [...reach(g, [node])].filter((n) => n !== node && !alive.has(n));
}

/** the graph without `node` and what dies with it. Pure. */
export function removeWith(g, node) {
  const gone = new Set([node, ...dies(g, node)]);
  return { nodes: g.nodes.filter((n) => !gone.has(n)), edges: g.edges.filter(([a, b]) => !gone.has(a) && !gone.has(b)) };
}

/** column of each node: its longest cause chain from a decision. Pure. */
export function depths(g) {
  const d = {};
  const walk = (n, k) => { if ((d[n] ?? -1) >= k) return; d[n] = k; for (const [a, b] of g.edges) if (a === n) walk(b, k + 1); };
  for (const r of rootsOf(g)) walk(r, 0);
  return d;
}

const SVGNS = 'http://www.w3.org/2000/svg';

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'causal-scars');
  th.nodes = th.nodes || []; th.edges = th.edges || [];
  const { save, render } = stageApi;
  const g = { nodes: th.nodes, edges: th.edges };
  const head = document.createElement('div'); head.innerHTML = '<b>Scars of my decisions</b>'; head.style.marginBottom = '6px'; el.appendChild(head);
  const roots = new Set(rootsOf(g)), dep = depths(g), cols = {};
  th.nodes.forEach((n) => { const c = dep[n] ?? 0; (cols[c] = cols[c] || []).push(n); });
  const W = 150, H = 34, GX = 70, ncol = Math.max(1, ...Object.keys(cols).map((c) => +c + 1));
  const rows = Math.max(1, ...Object.values(cols).map((c) => c.length));
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + (ncol * (W + GX)) + ' ' + (rows * (H + 12) + 6)); svg.setAttribute('width', String(Math.min(480, ncol * (W + GX)))); svg.style.maxWidth = '100%';
  const pos = {};
  Object.entries(cols).forEach(([c, ns]) => ns.forEach((n, i) => { pos[n] = { x: c * (W + GX), y: 4 + i * (H + 12) }; }));
  const edgeEls = [], nodeEls = {};
  for (const [a, b] of th.edges) {
    if (!pos[a] || !pos[b]) continue;
    const l = document.createElementNS(SVGNS, 'line');
    for (const [k, v] of Object.entries({ x1: pos[a].x + W, y1: pos[a].y + H / 2, x2: pos[b].x, y2: pos[b].y + H / 2, stroke: 'rgba(255,255,255,.4)', 'stroke-width': 1.5 })) l.setAttribute(k, v);
    l.dataset.from = a; l.dataset.to = b; svg.appendChild(l); edgeEls.push(l);
  }
  for (const n of th.nodes) {
    if (!pos[n]) continue;
    const gEl = document.createElementNS(SVGNS, 'g'); gEl.dataset.node = n; gEl.dataset.role = roots.has(n) ? 'decision' : 'constraint'; gEl.style.cursor = roots.has(n) ? 'pointer' : 'default';
    const r = document.createElementNS(SVGNS, 'rect');
    for (const [k, v] of Object.entries({ x: pos[n].x, y: pos[n].y, width: W, height: H, rx: 8, fill: roots.has(n) ? 'rgba(143,180,255,.25)' : 'rgba(255,255,255,.08)', stroke: roots.has(n) ? '#8fb4ff' : 'rgba(255,255,255,.3)' })) r.setAttribute(k, v);
    const t = document.createElementNS(SVGNS, 'text');
    for (const [k, v] of Object.entries({ x: pos[n].x + 8, y: pos[n].y + H / 2 + 4, 'font-size': 12, fill: '#e8e8e8' })) t.setAttribute(k, v);
    t.textContent = n.length > 22 ? n.slice(0, 21) + '…' : n; // ellipsis-ok: drawn picture or short label, the full text is on the card
    gEl.append(r, t); svg.appendChild(gEl); nodeEls[n] = gEl;
  }
  const paint = (node) => { // dim what would not exist without `node`
    const gone = new Set(node ? dies(g, node) : []);
    for (const [n, e] of Object.entries(nodeEls)) { e.style.opacity = gone.has(n) ? '.25' : '1'; e.dataset.dim = gone.has(n) ? '1' : ''; }
    for (const l of edgeEls) l.style.opacity = gone.has(l.dataset.to) ? '.2' : '1';
  };
  if (th.pick && !roots.has(th.pick)) th.pick = null;
  for (const n of roots) if (nodeEls[n]) {
    nodeEls[n].addEventListener('mouseenter', () => paint(n)); nodeEls[n].addEventListener('mouseleave', () => paint(th.pick || null));
    nodeEls[n].addEventListener('click', (e) => { e.stopPropagation(); th.pick = th.pick === n ? null : n; paint(th.pick); });
  }
  keepOut(svg); el.appendChild(svg);
  const bar = document.createElement('div'); bar.style.cssText = 'margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;font-size:12px;align-items:center';
  const btn = (label, fn, cls) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.style.cssText = 'font:inherit;padding:2px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer'; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); keepOut(b); bar.appendChild(b); };
  const msg = document.createElement('div'); msg.className = 'cs-msg'; msg.style.cssText = 'margin-top:6px;font-size:12px;min-height:1em'; msg.setAttribute('aria-live', 'polite');
  if (th.pending && roots.has(th.pending)) { // asked to remove: say what dies and wait for a yes
    const d = dies(g, th.pending);
    msg.textContent = 'Removing "' + th.pending + '" also removes ' + (d.length ? d.length + ': ' + d.join(', ') : 'nothing else') + '. ';
    btn('Accept', () => { const ng = removeWith(g, th.pending); th.nodes = ng.nodes; th.edges = ng.edges; th.pending = null; th.pick = null; save(); render(); }, 'cs-accept');
    btn('Keep it', () => { th.pending = null; save(); render(); }, 'cs-keep');
  } else {
    th.pending = null;
    for (const n of roots) btn('remove ' + n.slice(0, 18), () => { th.pending = n; save(); render(); }, 'cs-remove');
  }
  el.appendChild(bar); el.appendChild(msg);
  const inp = document.createElement('input'); inp.placeholder = 'decision > constraint, constraint; …'; inp.setAttribute('aria-label', 'add scars'); inp.className = 'cs-input';
  inp.style.cssText = 'margin-top:6px;width:100%;box-sizing:border-box;font:inherit;background:rgba(255,255,255,.07);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px;padding:3px 6px';
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const ng = addEdges(g, parseEdges(inp.value)); th.nodes = ng.nodes; th.edges = ng.edges; save(); render(); } });
  keepOut(inp); el.appendChild(inp);
  paint(th.pick || null);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export function ask(lower, text, stageApi) {
  const p = parseScars(text);
  if (!p) return '';
  const ng = addEdges({ nodes: [], edges: [] }, p.edges);
  addThing(stageApi, 'scars', { nodes: ng.nodes, edges: ng.edges, pick: null, pending: null });
  stageApi.save(); stageApi.render();
  return 'causal-scars';
}

export default {
  name: 'causal-scars',
  examples: ['map the scars of my decisions', 'what depends on this decision', 'map the scars of my decisions: moved to Berlin > rent is high, no car; hired Sam > payroll'],
  nearMisses: ['what is a scar', 'how do I make a decision', 'what depends on the weather', 'remove the scar from my arm'],
  parseScars,
  match(lower, text) { return !!parseScars(text || lower); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'causal-scars' : 'none'; },
  stageKinds: { scars: { mount, ask } },
};
