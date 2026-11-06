// The mind map maker's sums (lab/mind-map/). Pure, no DOM. An indented outline (spaces, tabs, "-", "*" or "1." bullets) becomes a tree, the tree a
// radial map (the first line in the middle, each branch its own colour and its own slice of the circle), and the map an SVG anyone can open.
/** outline text -> { text, kids } with the first line as the root (several top lines share a root named after the first). */
export function treeOf(text) {
  const lines = String(text || '').replace(/\t/g, '  ').split(/\r?\n/).map((l) => ({ depth: (/^ */.exec(l)[0].length), text: l.trim().replace(/^(?:[-*•+]|\d+[.)])\s+/, '').trim() })).filter((l) => l.text);
  if (!lines.length) return null;
  const root = { text: lines[0].text, kids: [] }, stack = [{ node: root, depth: -1 }];
  const base = lines[0].depth;
  for (const l of lines.slice(1)) {
    // a line no deeper than the first is a main branch: the root is always the middle
    const d = Math.max(0, l.depth - base) + 0.5, node = { text: l.text.slice(0, 120), kids: [] };
    while (stack.length > 1 && stack[stack.length - 1].depth >= d) stack.pop();
    stack[stack.length - 1].node.kids.push(node); stack.push({ node, depth: d });
  }
  return root;
}
/** the tree back as a tidy outline, two spaces a level. */
export function outlineOf(t, depth = 0) { return t ? [('  '.repeat(depth)) + (depth ? '- ' : '') + t.text, ...t.kids.map((k) => outlineOf(k, depth + 1))].join('\n') : ''; }
const leaves = (t) => (t.kids.length ? t.kids.reduce((s, k) => s + leaves(k), 0) : 1);
export const sizeOf = (t) => (t ? 1 + t.kids.reduce((s, k) => s + sizeOf(k), 0) : 0);
export const HUES = Object.freeze(['#a58bff', '#6fd3ff', '#8ae6b6', '#ffd36f', '#ff9f7e', '#ff7eb6', '#7e9bff', '#c3f07a']);
/** positions: [{ x, y, text, depth, hue, px, py }] around (0,0); each leaf gets an equal slice of the circle, a parent sits mid its leaves. */
export function layoutOf(t, ring = 0) {
  const out = []; if (!t) return out; const total = leaves(t); let at = 0;
  // the more leaves, the wider the rings, so labels at the edge keep room
  ring = ring || Math.max(150, total * 11);
  const walk = (n, depth, hue, parent) => {
    const own = leaves(n), mid = (at + own / 2) / total * Math.PI * 2 - Math.PI / 2, r = depth ? ring * (0.55 + depth * 0.75) : 0;
    const me = { x: depth ? Math.cos(mid) * r : 0, y: depth ? Math.sin(mid) * r : 0, text: n.text, depth, hue, px: parent ? parent.x : 0, py: parent ? parent.y : 0, angle: mid };
    out.push(me);
    if (!n.kids.length) at += 1; else n.kids.forEach((k, i) => walk(k, depth + 1, depth ? hue : HUES[i % HUES.length], me));
    return me;
  };
  walk(t, 0, '#ecebf5', null);
  return out;
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** the map as a standalone SVG (dark ground, or light when light is true). */
export function svgOf(t, { light = false } = {}) {
  const pts = layoutOf(t); if (!pts.length) return '';
  const font = (d) => (d === 0 ? 22 : d === 1 ? 16 : 13), wide = (p) => Math.min(40, p.text.length) * font(p.depth) * 0.56 + 18;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { const w = wide(p) / 2 + 8; x0 = Math.min(x0, p.x - w); x1 = Math.max(x1, p.x + w); y0 = Math.min(y0, p.y - 26); y1 = Math.max(y1, p.y + 26); }
  const W = Math.ceil(x1 - x0 + 40), H = Math.ceil(y1 - y0 + 40), ox = -x0 + 20, oy = -y0 + 20, ink = light ? '#1a1726' : '#ecebf5', bg = light ? '#ffffff' : '#0b0a10';
  const lines = pts.filter((p) => p.depth).map((p) => { const mx = (p.px + p.x) / 2, my = (p.py + p.y) / 2; return `<path d="M${(p.px + ox).toFixed(1)} ${(p.py + oy).toFixed(1)} Q${(mx + ox).toFixed(1)} ${(p.py + oy).toFixed(1)} ${(p.x + ox).toFixed(1)} ${(p.y + oy).toFixed(1)}" fill="none" stroke="${p.hue}" stroke-width="${p.depth === 1 ? 3 : 1.6}" stroke-opacity=".8"/>`; });
  const nodes = pts.map((p) => {
    const f = font(p.depth), w = wide(p), h = f + 16, label = esc(p.text.length > 40 ? p.text.slice(0, 39) + '…' : p.text);
    const fill = p.depth === 0 ? (light ? '#ede9ff' : '#1d1830') : bg;
    return `<g><rect x="${(p.x + ox - w / 2).toFixed(1)}" y="${(p.y + oy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h}" rx="${h / 2}" fill="${fill}" stroke="${p.depth ? p.hue : '#a58bff'}" stroke-width="${p.depth > 1 ? 1 : 2}"/><text x="${(p.x + ox).toFixed(1)}" y="${(p.y + oy + f * 0.35).toFixed(1)}" font-size="${f}" font-weight="${p.depth < 2 ? 600 : 400}" text-anchor="middle" fill="${ink}">${label}</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, -apple-system, Segoe UI, sans-serif"><rect width="100%" height="100%" fill="${bg}"/>${lines.join('')}${nodes.join('')}</svg>`;
}
/** an outline in a link and back: base64url of its UTF-8. */
export function packOf(text) { const b = new TextEncoder().encode(String(text || '')); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function unpackOf(code) { try { const s = atob(String(code || '').replace(/-/g, '+').replace(/_/g, '/')); return new TextDecoder().decode(Uint8Array.from(s, (c) => c.charCodeAt(0))); } catch (_) { return null; } }
