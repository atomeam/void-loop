/**
 * draw skill - a drawing card where you describe a brush in words and Verse makes it.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "let me draw", "open a canvas", "sketch pad", "make a brush like dry charcoal", "new brush: soft watercolor".
 * Not a shelf of fixed brushes with sliders: say what you want ("dry charcoal that
 * catches the paper grain", "thick wet ink", "faint pencil") and the brush is built from the words: its tool sets size,
 * edge, flow and grain, the words around it move them, and the card says what it understood. Brushes you make are kept in
 * this browser. Strokes are stamped along the path (spacing a fraction of the size), each stamp a radial dab with its edge
 * softness, flow and a paper-grain mask, the way painting apps build brushes.
 * Layers you talk to (feature "layers"): "new layer for the moon", "put the moon behind the house", "hide the sky", "make the
 * shading multiply", "clip the shading to the skin", "lock the skin", "merge the shading down": the same box takes them.
 * 3D layers (frontier 25): "new 3d layer for the ring" paints tubes in space with the same brushes and steadying, rendered by
 * skills/scene3d.js (loaded only then) into the layer's canvas, so a 3D layer stacks, fades, clips and blends with flat ones;
 * "turn the ring 70", the Turn button, or a right or shift drag spins it. Where the browser offers VR, Enter VR puts the layer
 * in a headset in front of you and a controller's trigger paints in the air; leaving brings the strokes back to the card.
 */
export const TOOLS = {
  pencil: { size: 3, hardness: 0.85, flow: 0.8, grain: 0.35, jitter: 0.05 },
  charcoal: { size: 16, hardness: 0.3, flow: 0.55, grain: 0.8, jitter: 0.25 },
  chalk: { size: 14, hardness: 0.45, flow: 0.7, grain: 0.9, jitter: 0.2 },
  crayon: { size: 9, hardness: 0.6, flow: 0.75, grain: 0.7, jitter: 0.1 },
  ink: { size: 4, hardness: 1, flow: 1, grain: 0, jitter: 0 },
  pen: { size: 3, hardness: 1, flow: 1, grain: 0, jitter: 0 },
  marker: { size: 12, hardness: 0.85, flow: 0.45, grain: 0, jitter: 0 },
  watercolor: { size: 30, hardness: 0.1, flow: 0.12, grain: 0.25, jitter: 0.1 },
  airbrush: { size: 44, hardness: 0, flow: 0.05, grain: 0, jitter: 0 },
  brush: { size: 10, hardness: 0.6, flow: 0.7, grain: 0.1, jitter: 0.05 }
};
const ALIAS = { spray: 'airbrush', 'spray paint': 'airbrush', 'felt tip': 'marker', highlighter: 'marker', paint: 'brush', 'paint brush': 'brush', paintbrush: 'brush', graphite: 'pencil', 'fountain pen': 'ink', 'water color': 'watercolor', watercolour: 'watercolor', pastel: 'chalk', 'oil pastel': 'crayon' };
export const COLORS = { black: '#111111', white: '#f5f5f5', grey: '#8a8a8a', gray: '#8a8a8a', red: '#d6402f', orange: '#ec8a2f', yellow: '#f2cf3a', green: '#3fa556', blue: '#2f6fd6', navy: '#1d2f6b', purple: '#7b47c9', violet: '#7b47c9', pink: '#e2689f', brown: '#7a4e2d', sepia: '#704214', teal: '#2a9d8f', gold: '#c9a227' };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = (v) => Math.round(v * 100) / 100;

/** a brush from words: { name, tool, size, hardness, flow, grain, jitter, color, understood: [words it used] }, or null. Pure. */
export function brushFrom(words) {
  const t = ' ' + String(words || '').toLowerCase().replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ') + ' ';
  let tool = null;
  for (const [k, v] of Object.entries(ALIAS)) if (t.includes(' ' + k + ' ')) { tool = v; break; }
  if (!tool) for (const k of Object.keys(TOOLS)) if (new RegExp(' ' + k + 's? ').test(t)) { tool = k; break; }
  if (!tool) return null;
  const b = { ...TOOLS[tool] }, used = [tool];
  const has = (re) => { const m = t.match(re); if (m) used.push(m[0].trim()); return !!m; };
  if (has(/ (?:thick|big|wide|fat|broad|heavy) /)) b.size *= 2;
  if (has(/ (?:thin|fine|small|tiny|narrow|sharp) /)) b.size *= 0.5;
  if (has(/ (?:soft|fuzzy|blurry|feathered) /)) b.hardness *= 0.45;
  if (has(/ (?:hard|crisp|clean) /)) b.hardness = Math.max(b.hardness, 0.95);
  if (has(/ (?:dry|scratchy|catches? the (?:paper|grain)|paper grain) /)) { b.grain += 0.2; b.flow -= 0.1; }
  if (has(/ (?:wet|juicy|runny) /)) { b.hardness -= 0.2; b.flow += 0.1; }
  if (has(/ (?:grainy|rough|textured|gritty) /)) b.grain += 0.3;
  if (has(/ (?:smooth|silky) /)) b.grain = 0;
  if (has(/ (?:faint|light|pale|gentle) /)) b.flow *= 0.6;
  if (has(/ (?:bold|strong|dark|solid) /)) b.flow *= 1.4;
  if (has(/ (?:shaky|wobbly|loose|messy) /)) b.jitter += 0.25;
  let color = null;
  for (const [k, v] of Object.entries(COLORS)) if (t.includes(' ' + k + ' ')) { color = v; used.push(k); break; }
  const name = String(words || '').trim().replace(/^(?:make|create|new|give me)\s+(?:me\s+)?(?:a\s+)?(?:brush|pen)?\s*(?:like|that is|:)?\s*/i, '').replace(/^(?:a|an)\s+/i, '').slice(0, 40) || tool;
  return { name, tool, size: r2(clamp(b.size, 1, 120)), hardness: r2(clamp(b.hardness, 0, 1)), flow: r2(clamp(b.flow, 0.02, 1)), grain: r2(clamp(b.grain, 0, 1)), jitter: r2(clamp(b.jitter, 0, 0.6)), color, understood: used };
}

/** what the card says it understood, in words. Pure. */
export function describe(b) {
  const edge = b.hardness > 0.8 ? 'hard edge' : b.hardness > 0.4 ? 'medium edge' : 'soft edge';
  const grain = b.grain > 0.6 ? 'heavy paper grain' : b.grain > 0.2 ? 'some grain' : 'smooth';
  const flow = b.flow > 0.8 ? 'full ink' : b.flow > 0.35 ? 'medium flow' : 'builds up in layers';
  return `${b.size}px ${b.tool}, ${edge}, ${grain}, ${flow}`;
}

/** what a drawing ask wants: { brush } (a brush described in it, or null), or null when it is not a drawing ask. Pure. */
export function drawOf(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  const brush = t.match(/^(?:make|create|give me|new)\s+(?:me\s+)?(?:a\s+)?(?:brush|pen)\s*(?:like|that is|that's|:)?\s*(.+)$/) || t.match(/^(?:make|create|new)\s+(?:me\s+)?(?:a\s+)?(.+?)\s+brush$/);
  if (brush) { const b = brushFrom(brush[1]); return b ? { brush: b } : null; }
  if (/^(?:let me |i want to |can i |let'?s )?(?:draw|sketch|doodle|paint)(?: something| with me| a picture)?$/.test(t)) return { brush: null };
  if (/^(?:make|create|draw|sketch|doodle|paint)(?: a | an )?(?:(?:2d|3d|simple|quick) )?(?:sketch|drawing|picture|doodle) of (.+)$/.test(t)) return { brush: null };
  if (/^(?:open |show me |give me |start )?(?:a |the |my )?(?:canvas|drawing pad|drawing board|sketch ?pad|sketchbook|doodle pad|paint app|drawing app)$/.test(t)) return { brush: null };
  return null;
}

/** how shaky a stroke is: the mean distance (px) of each point from the midpoint of its neighbours. A steady line is near 0. Pure. */
export function tremorOf(points) {
  const p = (points || []).filter((q) => Array.isArray(q) && q.length >= 2);
  if (p.length < 3) return 0;
  let sum = 0;
  for (let i = 1; i < p.length - 1; i++) sum += Math.hypot(p[i][0] - (p[i - 1][0] + p[i + 1][0]) / 2, p[i][1] - (p[i - 1][1] + p[i + 1][1]) / 2);
  return Math.round(sum / (p.length - 2) * 100) / 100;
}
/** how much to follow the pen (1 = exactly, lower = steadier) for a hand that shakes this much: just enough, no more. Pure. */
export function followFor(tremor) { return Math.round(clamp(1 / (1 + Math.max(0, tremor) * 0.9), 0.15, 1) * 100) / 100; }
/** a hand learned over strokes: the running tremor, recent strokes counting most; strokes too short to tell leave it. Pure. */
export function learnHand(hand, points) {
  const t = tremorOf(points), n = (points || []).length;
  if (n < 6) return hand || { tremor: 0, strokes: 0 };
  const h = hand && hand.strokes ? hand : { tremor: t, strokes: 0 };
  return { tremor: Math.round((h.strokes ? h.tremor * 0.7 + t * 0.3 : t) * 100) / 100, strokes: h.strokes + 1 };
}
const HAND = 'a2m.void.hand.v1';

// layers you can talk to: every layer has a name, and the card takes plain words for what to do
// with them: "new layer for the moon", "put the moon behind the house", "hide the sky", "make the shadows 40%", "make the
// shadows multiply", "clip the shading to the skin", "lock the house", "merge the moon into the sky", "rename moon to sun"
export const BLENDS = { normal: 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten',
  'color dodge': 'color-dodge', 'color burn': 'color-burn', 'hard light': 'hard-light', 'soft light': 'soft-light', difference: 'difference',
  exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity', add: 'lighter', 'linear dodge': 'lighter' };
const bare = (w) => String(w || '').toLowerCase().replace(/^\s*(?:the|my|a|an)\s+/, '').replace(/\s+layer$/, '').replace(/^layer\s+(?=\D)/, '').replace(/\s+/g, ' ').trim();
/** which layer (index into names) a spoken name means: exact, then without a plural s, then a layer whose name holds it; -1 when none. Pure. */
export function layerIndex(names, word) {
  const w = bare(word), list = names.map(bare); if (!w) return -1;
  let i = list.indexOf(w); if (i >= 0) return i;
  i = list.findIndex((n) => n.replace(/s$/, '') === w.replace(/s$/, '')); if (i >= 0) return i;
  const n = /^(?:layer\s+)?(\d+)$/.exec(w); if (n && +n[1] >= 1 && +n[1] <= names.length) { i = list.indexOf('layer ' + n[1]); return i >= 0 ? i : +n[1] - 1; }
  return list.findIndex((x) => (' ' + x + ' ').includes(' ' + w + ' '));
}
/** what a sentence asks of the layers (names bottom to top): { op, ... }, { op: 'missing', name } when it names a layer there is not, or
 *  null when it is not about layers. Pure. */
export function layerCommand(text, names) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim().replace(/^(?:please |can you |now )+/, '');
  const L = '((?:the |my )?[a-z0-9][a-z0-9 \'-]*?)', idx = (w) => layerIndex(names, w);
  const one = (op, w, extra) => { const i = idx(w); return i < 0 ? { op: 'missing', name: bare(w) } : { op, i, ...extra }; };
  let m;
  if ((m = new RegExp('^(?:new|add)(?: a)? (?:3d|3-d|three[ -]d|vr|space) layer(?: (?:for|called|named))?(?: ' + L + ')?$').exec(t)) || (m = new RegExp('^(?:new|add)(?: a)? layer(?: (?:for|called|named))?(?: ' + L + ')? in (?:3d|3-d|space|vr)$').exec(t))) return { op: 'add', name: bare(m[1] || '') || '3d ' + (names.length + 1), space: true };
  if ((m = new RegExp('^(?:new|add)(?: a)? layer(?:s)?(?: (?:for|called|named))?(?: ' + L + ')?$').exec(t)) || (m = new RegExp('^add ' + L + ' (?:on|as) (?:a )?new layer$').exec(t))) return { op: 'add', name: bare(m[1] || '') || 'layer ' + (names.length + 1) };
  if (/^(?:make|set|use|put)\s+(?:it|this|my drawing|the drawing|this drawing)\s+(?:as\s+)?(?:my|the)\s+(?:(?:void|verse)'?s?\s+)?(?:backdrop|background|wallpaper)$|^(?:make\s+(?:it\s+)?)?my\s+(?:void'?s?\s+)?(?:backdrop|background|wallpaper)$/.test(t)) return { op: 'backdrop' };
  if ((m = new RegExp('^(?:make|set) ' + L + ' (thicker|fatter|bolder|thinner|slimmer|finer)$').exec(t))) return one('thick', m[1], { by: /thicker|fatter|bolder/.test(m[2]) ? 1.5 : 1 / 1.5 });
  if (/^(?:3d\s+)?print\s+(?:it|this)$|^(?:save|export|download)\s+(?:it|this)\s+as\s+(?:an?\s+)?stl$/.test(t)) return { op: 'print', i: -1 };
  if ((m = new RegExp('^(?:3d\\s+)?print ' + L + '$').exec(t)) || (m = new RegExp('^(?:save|export|download) ' + L + ' as (?:an? )?stl$').exec(t))) return one('print', m[1]);
  if ((m = new RegExp('^(?:turn|spin|rotate) ' + L + '(?: (?:by )?(-?\\d{1,3})(?: ?(?:degrees|deg|°))?)?(?: (left|right|around))?$').exec(t))) return one('turn', m[1], { deg: m[2] ? +m[2] : m[3] === 'left' ? -90 : m[3] === 'around' ? 180 : 90 });
  if ((m = new RegExp('^(?:put|move|send|place|bring) ' + L + ' (behind|under|below|beneath|in front of|over|above|on top of) ' + L + '$').exec(t))) {
    const a = idx(m[1]), b = idx(m[3]); if (a < 0 || b < 0) return { op: 'missing', name: bare(a < 0 ? m[1] : m[3]) };
    return { op: 'move', i: a, rel: /behind|under|below|beneath/.test(m[2]) ? 'behind' : 'front', of: b };
  }
  if ((m = new RegExp('^(?:bring|move|put) ' + L + ' to the (?:front|top)$').exec(t))) return one('move', m[1], { rel: 'top' });
  if ((m = new RegExp('^(?:send|move|put) ' + L + ' to the (?:back|bottom)$').exec(t))) return one('move', m[1], { rel: 'bottom' });
  if ((m = new RegExp('^(hide|show|unhide|lock|unlock) ' + L + '$').exec(t))) return one(m[1] === 'unhide' ? 'show' : m[1], m[2]);
  if ((m = new RegExp('^(?:delete|remove|get rid of) ' + L + '$').exec(t))) return one('delete', m[1]);
  if ((m = new RegExp('^(?:clear|erase|wipe) ' + L + '$').exec(t))) return one('clear', m[1]);
  if ((m = new RegExp('^(?:draw on|switch to|select|use|go to|pick) ' + L + '$').exec(t))) return one('select', m[1]);
  if ((m = new RegExp('^(?:rename|call) ' + L + ' (?:to |as )?"?([a-z0-9][a-z0-9 \'-]*)"?$').exec(t)) && idx(m[1]) >= 0) return one('rename', m[1], { name: bare(m[2]) });
  if ((m = new RegExp('^merge ' + L + ' (?:into|onto|with|down into) ' + L + '$').exec(t))) {
    const a = idx(m[1]), b = idx(m[2]); if (a < 0 || b < 0) return { op: 'missing', name: bare(a < 0 ? m[1] : m[2]) };
    return { op: 'merge', i: a, into: b };
  }
  if ((m = new RegExp('^merge ' + L + ' down$').exec(t))) { const i = idx(m[1]); return i < 0 ? { op: 'missing', name: bare(m[1]) } : i === 0 ? { op: 'cannot', why: 'it is already the bottom layer' } : { op: 'merge', i, into: i - 1 }; }
  if ((m = new RegExp('^(?:clip|mask) ' + L + ' to ' + L + '$').exec(t))) {
    const a = idx(m[1]), b = idx(m[2]); if (a < 0 || b < 0) return { op: 'missing', name: bare(a < 0 ? m[1] : m[2]) };
    return { op: 'clip', i: a, to: b };
  }
  if ((m = new RegExp('^(?:unclip|stop clipping) ' + L + '$').exec(t))) return one('clip', m[1], { to: -1 });
  if ((m = new RegExp('^(?:make |set )?' + L + ' (?:to |at )?(\\d{1,3}) ?%(?: opacity| opaque| see[ -]through| visible)?$').exec(t))) return one('opacity', m[1], { value: Math.min(100, +m[2]) / 100 });
  if ((m = new RegExp('^(?:fade|make) ' + L + '(?: (?:fainter|lighter|more see[ -]through|see[ -]through|transparent|softer))$').exec(t)) || (m = new RegExp('^fade ' + L + '$').exec(t))) return one('opacity', m[1], { value: 0.5 });
  if ((m = new RegExp('^(?:make|set|blend) ' + L + ' (?:to |as |with |on )?(' + Object.keys(BLENDS).join('|') + ')(?: blend(?:ing)?(?: mode)?| mode)?$').exec(t))) return one('blend', m[1], { mode: m[2] });
  return null;
}
/** a brush's tube radius in space: half its size in pixels, at the scale the camera sees the middle of the scene (pixels per unit). Pure. */
export function tubeRadius(sizePx, pxPerUnit) { return Math.round(Math.max(0.5, sizePx / 2) / Math.max(1, pxPerUnit) * 10000) / 10000; }
/** close a tube's two open ends (Verse asked: a spatial sketch as an STL): a fan from each end ring's centre, wound to face out
 *  (away from the next ring in). P: flat positions, I: indices, laid out as rings of radial+1 vertices, tubular+1 rings. Pure. */
export function capTube(P, I, radial, tubular) {
  const pos = Array.from(P), idx = Array.from(I), per = radial + 1;
  const centre = (ring) => { const c = [0, 0, 0]; for (let j = 0; j < radial; j++) for (let a = 0; a < 3; a++) c[a] += pos[(ring * per + j) * 3 + a] / radial; return c; };
  for (const [ring, next] of [[0, 1], [tubular, tubular - 1]]) {
    const c = centre(ring), n = centre(next), out = [c[0] - n[0], c[1] - n[1], c[2] - n[2]], k = pos.length / 3;
    pos.push(...c);
    for (let j = 0; j < radial; j++) {
      let a = ring * per + j, b = ring * per + j + 1;
      const A = pos.slice(a * 3, a * 3 + 3), B = pos.slice(b * 3, b * 3 + 3), u = [A[0] - c[0], A[1] - c[1], A[2] - c[2]], v = [B[0] - c[0], B[1] - c[1], B[2] - c[2]];
      const nrm = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (nrm[0] * out[0] + nrm[1] * out[1] + nrm[2] * out[2] < 0) [a, b] = [b, a];
      idx.push(k, a, b);
    }
  }
  return { positions: pos, indices: idx };
}
/** the shells of a 3D layer as one printable model (forge's shape: millimetres, y up, standing on the bed, longest side `mm`):
 *  vertices at the same place are joined (a tube's seam), so a closed shell reads as closed. Pure. */
export function printModel(shells, label = 'sketch', mm = 100) {
  const keyOf = (x, y, z) => Math.round(x * 1e5) + ',' + Math.round(y * 1e5) + ',' + Math.round(z * 1e5);
  const at = new Map(), pos = [], idx = [];
  for (const sh of shells) {
    const map = [];
    for (let v = 0; v < sh.positions.length / 3; v++) {
      const x = sh.positions[v * 3], y = sh.positions[v * 3 + 1], z = sh.positions[v * 3 + 2], k = keyOf(x, y, z);
      if (!at.has(k)) { at.set(k, pos.length / 3); pos.push(x, y, z); }
      map.push(at.get(k));
    }
    for (let t = 0; t < sh.indices.length; t += 3) { const a = map[sh.indices[t]], b = map[sh.indices[t + 1]], c = map[sh.indices[t + 2]]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
  }
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < pos.length; v += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], pos[v + a]); hi[a] = Math.max(hi[a], pos[v + a]); }
  const k = mm / Math.max(1e-9, ...hi.map((h, a) => h - lo[a])), mid = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2];
  for (let v = 0; v < pos.length; v += 3) for (let a = 0; a < 3; a++) pos[v + a] = Math.round((pos[v + a] - mid[a]) * k * 1000) / 1000;
  return { key: 'sketch', label, positions: pos, indices: idx, size: hi.map((h, a) => Math.round((h - lo[a]) * k * 10) / 10) };
}
/** the layer list after moving layer i (bottom to top): behind or in front of layer j, or to the top or bottom. Pure. */
export function moveLayer(list, i, rel, j) {
  const out = list.slice(), [item] = out.splice(i, 1);
  if (rel === 'top') out.push(item); else if (rel === 'bottom') out.unshift(item);
  else { const k = out.indexOf(list[j]); out.splice(rel === 'behind' ? k : k + 1, 0, item); }
  return out;
}

const KEY = 'a2m.void.brushes.v1';
const mine = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (_) { return []; } };
const keep = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-24))); } catch (_) {} };

// the paper-grain mask: soft clumps, not single pixels (paper tooth is a few pixels across), and fixed to the paper, so
// the grain stays put the way real charcoal catches it: a small random tile scaled up with smoothing, contrast pushed up
let grainTile = null;
function grainOf(size = 192, cells = 64) {
  if (grainTile) return grainTile;
  const small = document.createElement('canvas'); small.width = small.height = cells; const sg = small.getContext('2d'), im = sg.createImageData(cells, cells);
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < im.data.length; i += 4) { const v = rnd(); im.data[i + 3] = v > 0.55 ? Math.round(150 + (v - 0.55) * 230) : Math.round(v * 60); }
  sg.putImageData(im, 0, 0);
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.drawImage(small, 0, 0, size, size);
  return (grainTile = c);
}

function dab(g, x, y, b, color) {
  const r = Math.max(0.5, b.size / 2) * (1 + (Math.random() - 0.5) * b.jitter);
  const jx = (Math.random() - 0.5) * b.jitter * b.size, jy = (Math.random() - 0.5) * b.jitter * b.size;
  const grd = g.createRadialGradient(x + jx, y + jy, r * b.hardness * 0.98, x + jx, y + jy, r);
  grd.addColorStop(0, color); grd.addColorStop(1, color + '00');
  g.globalAlpha = b.flow; g.fillStyle = grd; g.beginPath(); g.arc(x + jx, y + jy, r, 0, Math.PI * 2); g.fill();
}

function run(text, api) {
  const { showPage, esc } = api;
  const q = drawOf(text) || { brush: null };
  let brushes = mine();
  if (q.brush) { brushes = brushes.filter((x) => x.name !== q.brush.name).concat([q.brush]); keep(brushes); }
  let cur = q.brush || brushes[brushes.length - 1] || brushFrom('pencil'), color = (q.brush && q.brush.color) || '#111111';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Draw</h2><div class="sub">Describe a brush in your own words and Verse makes it: "dry charcoal that catches the paper grain", "thick wet ink", "faint pencil".</div>' // void-review: ok (fixed text; the brush row below is built with esc)
      + '<div class="vdraw"><canvas width="900" height="600" style="width:100%;touch-action:none;background:#fbfaf6;border-radius:10px;cursor:crosshair"></canvas>'
      + '<form class="vd-make" style="display:flex;gap:6px;margin:8px 0"><input class="vd-words" placeholder="describe a brush, or tell the layers what to do…" aria-label="describe a brush, or tell the layers what to do" style="flex:1;font:inherit;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit"><button type="submit">Make it</button></form>'
      + '<div class="vd-said sub" aria-live="polite"></div><div class="vd-layers" style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;align-items:center"></div><div class="vd-steady sub"></div><div class="vd-brushes" style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0"></div>'
      + '<div class="vd-colors" style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0">' + Object.entries(COLORS).filter(([k]) => !/grey|violet/.test(k)).map(([k, v]) => '<button type="button" data-color="' + esc(v) + '" title="' + esc(k) + '" style="width:26px;height:26px;border-radius:50%;background:' + esc(v) + ';border:2px solid rgba(255,255,255,.3)"></button>').join('') + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="vd-undo">Undo</button><button type="button" class="vd-clear">Clear layer</button><button type="button" class="vd-save">Save as picture</button><button type="button" class="vd-backdrop">Make it my backdrop</button><button type="button" class="vd-steadyon" aria-pressed="true">Steadying on</button><label class="sub" style="display:flex;align-items:center;gap:6px">Steadiness <input class="vd-strength" type="range" min="0" max="100" value="0" aria-label="steadiness, 0 = learned from your hand"><span class="vd-strength-v">auto</span></label></div></div>';
  });
  const $ = (s) => el.querySelector(s), cv = $('canvas'), g = cv.getContext('2d');
  const undo = [], said = $('.vd-said');
  // layers, bottom to top: each its own canvas; the one on screen is all of them put together (compose)
  const sheet = () => { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; return c; };
  const newLayer = (name) => { const c = sheet(); return { name, c, g: c.getContext('2d'), hidden: false, alpha: 1, blend: 'normal', locked: false, clipTo: null }; };
  let layers = [newLayer('layer 1')], A = layers[0];
  const tmp = sheet(), tg = tmp.getContext('2d'), clipC = sheet(), cg = clipC.getContext('2d');
  const compose = () => {
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, cv.width, cv.height);
    for (const L of layers) {
      if (L.hidden) continue;
      let src = L.c;
      if (L === A && stroke) { tg.clearRect(0, 0, cv.width, cv.height); tg.drawImage(L.c, 0, 0); tg.globalCompositeOperation = L.locked ? 'source-atop' : 'source-over'; tg.drawImage(stroke, 0, 0); tg.globalCompositeOperation = 'source-over'; src = tmp; }
      if (L.clipTo && layers.includes(L.clipTo)) { cg.clearRect(0, 0, cv.width, cv.height); cg.drawImage(src, 0, 0); cg.globalCompositeOperation = 'destination-in'; cg.drawImage(L.clipTo.c, 0, 0); cg.globalCompositeOperation = 'source-over'; src = clipC; }
      g.globalAlpha = L.alpha; g.globalCompositeOperation = BLENDS[L.blend] || 'source-over'; g.drawImage(src, 0, 0);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  };
  const showLayers = () => {
    $('.vd-layers').innerHTML = '<span class="sub">Layers, top first:</span>' + layers.map((L, i) => [L, i]).reverse().map(([L, i]) => '<button type="button" data-layer="' + i + '"' + (L === A ? ' aria-pressed="true"' : '') + '>' + esc(L.name) // void-review: ok (every name through esc)
      + (L.hidden ? ' (hidden)' : '') + (L.alpha < 1 ? ' ' + Math.round(L.alpha * 100) + '%' : '') + (L.blend !== 'normal' ? ' ' + esc(L.blend) : '') + (L.kind === '3d' ? (L.space ? ' (3D)' : ' (3D, starting…)') : '') + (L.locked ? ' (locked)' : '') + (L.clipTo && layers.includes(L.clipTo) ? ' (clipped to ' + esc(L.clipTo.name) + ')' : '') + '</button>').join('')
      + '<button type="button" class="vd-addlayer" title="new layer on top">+ layer</button><button type="button" class="vd-add3d" title="new 3D layer on top: paint in space">+ 3D layer</button>'
      + (A.kind === '3d' ? '<button type="button" class="vd-turn" aria-pressed="' + turning + '">' + (turning ? 'Turning: drag to spin' : 'Turn') + '</button>' : '')
      + (A.kind === '3d' && A.space && vrOk ? '<button type="button" class="vd-vr">Enter VR</button>' : '');
  };
  const named = (L) => '"' + L.name + '"';
  const doLayer = (c) => {
    const L = layers[c.i];
    if (c.op === 'backdrop') {
      const src = backdropSrc(); if (!src) return 'That picture is too big to keep as a backdrop.';
      if (!layers.some((x) => !x.hidden && x.c.getContext('2d').getImageData(0, 0, cv.width, cv.height).data.some((v, i) => i % 4 === 3 && v > 0))) return 'Draw something first: the canvas is empty.';
      window.dispatchEvent(new CustomEvent('void-backdrop', { detail: { src } }));
      return 'Your drawing is now your Verse\'s backdrop, kept with your Verse (signed in, it follows you to your other devices). Say "remove my backdrop" to take it off.';
    }
    if (c.op === 'missing') return 'There is no layer called "' + c.name + '". The layers are: ' + layers.map((x) => x.name).join(', ') + '.';
    if (c.op === 'cannot') return 'Cannot do that: ' + c.why + '.';
    if (c.op === 'add') { const n = layers.some((x) => x.name === c.name) ? c.name + ' ' + (layers.length + 1) : c.name; const N = newLayer(n);
      if (!c.space) { A = N; layers.push(A); return 'New layer ' + named(A) + ' on top. You are drawing on it.'; }
      N.kind = '3d'; A = N; layers.push(A);
      makeSpace(N).then(() => { showLayers(); if (A === N) said.textContent = named(N) + ' is ready: drag to paint in space.'; }).catch((e) => { console.warn('[draw] 3D layer', e); layers = layers.filter((x) => x !== N); if (A === N) A = layers[layers.length - 1]; said.textContent = 'A 3D layer could not start here: it needs WebGL, which this browser has off or cannot load.'; showLayers(); compose(); });
      return 'New 3D layer ' + named(A) + ' on top: a drag paints in space; press Turn (or say "turn ' + A.name + '") to spin it.'; }
    if (c.op === 'thick') { if (!L.space) return named(L) + ' is flat; thickness is for 3D strokes (change the brush for flat ones).'; const n = thicken(L, c.by); return n ? named(L) + "'s " + n + ' stroke' + (n > 1 ? 's are ' : ' is ') + (c.by > 1 ? 'thicker' : 'thinner') + '.' : named(L) + ' has no strokes yet.'; }
    if (c.op === 'print') { const P = c.i < 0 ? A : L; if (!P.space) return 'Only a 3D layer prints: say "new 3d layer", draw in it, then "print it".'; printLayer(P).then((m) => { said.textContent = m; }).catch((e) => { console.warn('[draw] print', e); said.textContent = 'The STL could not be made.'; }); return 'Making ' + named(P) + ' into an STL…'; }
    if (c.op === 'turn') { if (!L.space) return named(L) + ' is flat; only a 3D layer turns.'; L.space.yaw += c.deg * Math.PI / 180; renderSpace(L); return named(L) + ' turned ' + Math.abs(c.deg) + '°' + (c.deg < 0 ? ' left.' : '.'); }
    if (c.op === 'move') { layers = moveLayer(layers, c.i, c.rel, c.of); return named(L) + (c.rel === 'top' ? ' is now on top.' : c.rel === 'bottom' ? ' is now at the bottom.' : ' is now ' + (c.rel === 'behind' ? 'behind ' : 'in front of ') + named(layers[layers.indexOf(L) + (c.rel === 'behind' ? 1 : -1)]) + '.'); }
    if (c.op === 'hide' || c.op === 'show') { L.hidden = c.op === 'hide'; return named(L) + (L.hidden ? ' is hidden (say "show ' + L.name + '" to bring it back).' : ' is showing.'); }
    if (c.op === 'lock' || c.op === 'unlock') { L.locked = c.op === 'lock'; return L.locked ? named(L) + ' is locked: you can paint over what is on it, but not outside it.' : named(L) + ' is unlocked.'; }
    if (c.op === 'select') { A = L; return 'Drawing on ' + named(L) + '.'; }
    if (c.op === 'rename') { const was = L.name; L.name = c.name; return '"' + was + '" is now called ' + named(L) + '.'; }
    if (c.op === 'opacity') { L.alpha = c.value; return named(L) + ' is at ' + Math.round(c.value * 100) + '%.'; }
    if (c.op === 'blend') { L.blend = c.mode; return named(L) + ' now blends as ' + c.mode + '.'; }
    if (c.op === 'clip') { L.clipTo = c.to < 0 ? null : layers[c.to]; return L.clipTo ? named(L) + ' only shows where ' + named(L.clipTo) + ' has paint.' : named(L) + ' is no longer clipped.'; }
    if (c.op === 'clear') { if (L.space) { for (const o of [...L.space.group.children]) { L.space.group.remove(o); o.geometry.dispose(); o.material.dispose(); } renderSpace(L); return named(L) + ' is cleared.'; } undo.push({ L, im: L.g.getImageData(0, 0, cv.width, cv.height) }); L.g.clearRect(0, 0, cv.width, cv.height); return named(L) + ' is cleared (Undo brings it back).'; }
    if (c.op === 'delete') { if (layers.length < 2) return 'It is the only layer; say "clear ' + L.name + '" to empty it.'; layers = layers.filter((x) => x !== L); if (A === L) A = layers[layers.length - 1]; return named(L) + ' is deleted. Drawing on ' + named(A) + '.'; }
    if (c.op === 'merge') { const T = layers[c.into]; if (T === L) return 'That is the same layer.'; if (T.kind === '3d') return 'Cannot merge into a 3D layer: merge it into a flat one (its picture, as it faces you now, goes down flat).';
      let src = L.c; // what shows of it goes down, as it shows: clipped to its layer, at its opacity, in its blend
      if (L.clipTo && layers.includes(L.clipTo)) { cg.clearRect(0, 0, cv.width, cv.height); cg.drawImage(L.c, 0, 0); cg.globalCompositeOperation = 'destination-in'; cg.drawImage(L.clipTo.c, 0, 0); cg.globalCompositeOperation = 'source-over'; src = clipC; }
      T.g.globalAlpha = L.alpha; T.g.globalCompositeOperation = BLENDS[L.blend] || 'source-over'; T.g.drawImage(src, 0, 0); T.g.globalAlpha = 1; T.g.globalCompositeOperation = 'source-over';
      layers = layers.filter((x) => x !== L); for (const x of layers) if (x.clipTo === L) x.clipTo = T; if (A === L) A = T; return named(L) + ' is merged into ' + named(T) + '.'; }
    return '';
  };
  // a 3D layer (frontier 25): its strokes are tubes in a scene of their own, rendered by Verse's one WebGL renderer
  // (skills/scene3d.js, loaded only when a 3D layer is made) into the layer's own canvas, so it stacks, hides, fades,
  // clips and blends like any other layer. A drag paints on the plane through the middle of the scene, facing you; Turn spins it.
  let E3 = null, turning = false, spin = null;
  const renderSpace = (L) => {
    const S = L.space; if (!S || !E3 || E3.lost) return;
    const r = E3.renderer, w = cv.width, h = cv.height;
    if (E3.w < w || E3.h < h) { E3.w = Math.max(E3.w, w); E3.h = Math.max(E3.h, h); r.setSize(E3.w, E3.h, false); }
    S.group.rotation.set(S.pitch, S.yaw, 0);
    r.setRenderTarget(null); r.setViewport(0, 0, w, h); r.setScissor(0, 0, w, h); r.setScissorTest(true); r.setClearColor(0x000000, 0); r.clear();
    const tm = r.toneMapping; r.toneMapping = S.THREE.NoToneMapping; r.render(S.scene, S.camera); r.toneMapping = tm; r.setScissorTest(false); // filmic tone mapping pales a picked colour; the miniatures keep it
    L.g.clearRect(0, 0, w, h); L.g.drawImage(E3.canvas, 0, E3.h - h, w, h, 0, 0, w, h);
  };
  const makeSpace = async (L) => {
    const mod = await import('./scene3d.js');
    if (!mod.webglOk()) throw new Error('no WebGL');
    E3 = await mod.engine(); const { THREE } = E3;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, cv.width / cv.height, 0.1, 100), group = new THREE.Group();
    camera.position.set(0, 0, 6); camera.lookAt(0, 0, 0); scene.add(group); scene.environment = E3.env;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.35)); const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(3, 4, 5); scene.add(key);
    const pxPerUnit = cv.height / (2 * Math.tan(THREE.MathUtils.degToRad(20)) * 6);
    L.space = { THREE, scene, camera, group, yaw: 0, pitch: 0, pxPerUnit, live: null, pts: [] };
    renderSpace(L); compose();
  };
  const spaceAt = (L, p) => { // a canvas point to a point in the layer's scene: on the plane through the middle, facing you
    const S = L.space, { THREE } = S, ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(p[0] / cv.width * 2 - 1, 1 - p[1] / cv.height * 2), S.camera);
    const hit = new THREE.Vector3(); if (!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit)) return null;
    S.group.updateMatrixWorld(true); return S.group.worldToLocal(hit);
  };
  const tubeOf = (S, pts, size = cur.size) => {
    const { THREE } = S, r = tubeRadius(size, S.pxPerUnit), path = pts.length > 1 ? new THREE.CatmullRomCurve3(pts) : null;
    const geo = path ? new THREE.TubeGeometry(path, Math.min(400, pts.length * 4), r, 10, false) : new THREE.SphereGeometry(r, 12, 8);
    if (!path) geo.translate(pts[0].x, pts[0].y, pts[0].z);
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.45 + cur.grain * 0.45, metalness: 0, envMapIntensity: 0.3, transparent: cur.flow < 0.45, opacity: Math.min(1, Math.max(0.15, cur.flow * 2.2)) }); // dabs overlap and build up on paper; a tube is one pass, so flow counts double
    const mesh = new THREE.Mesh(geo, mat); mesh.userData = { pts: pts.slice(), size }; return mesh;
  };
  // Verse asked (2026-10-12): "a 'thickness' parameter to the spatial paint skill" and "convert a spatial sketch into an STL file"
  const thicken = (L, by) => {
    let n = 0;
    for (const o of L.space.group.children) { const u = o.userData; if (!u || !u.pts) continue;
      const t = tubeOf(L.space, u.pts, Math.max(1, Math.min(160, u.size * by))); o.geometry.dispose(); o.geometry = t.geometry; o.userData = t.userData; t.material.dispose(); n++; }
    renderSpace(L); return n;
  };
  const printLayer = async (L) => {
    const shells = [];
    for (const o of L.space.group.children) { const g = o.geometry, p = g.parameters || {};
      if (!g || !g.index) continue;
      if (p.path) shells.push(capTube(g.attributes.position.array, g.index.array, p.radialSegments, p.tubularSegments));
      else shells.push({ positions: Array.from(g.attributes.position.array), indices: Array.from(g.index.array) }); }
    if (!shells.length) return named(L) + ' has nothing in it to print yet.';
    const F = await import('./forge-rules.js'), model = printModel(shells, L.name), check = F.printCheck(model), buf = F.stl(model);
    const a = document.createElement('a'); a.download = 'void-' + L.name.replace(/[^a-z0-9]+/gi, '-') + '.stl'; a.href = URL.createObjectURL(new Blob([buf], { type: 'model/stl' })); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return named(L) + ' is saved as an STL, ' + model.size.map((v) => Math.round(v)).join(' × ') + ' mm: ' + (check.closed ? 'watertight' : 'not watertight') + (check.supports ? ', it needs supports' : '') + ', about ' + check.grams + ' g of PLA.';
  };
  // Enter VR (frontier 25, the owner: "we are working towards a fully working VR Verse"): the 3D layer's scene goes into a headset
  // session of its own renderer (so the page's miniatures keep theirs), standing in front of you at chest height, about a metre
  // and a half across; holding a controller's trigger paints a tube where the controller is, in the brush and colour on the
  // card; leaving VR brings the layer back to the card as it was turned. The button shows only where the browser offers VR.
  let vrOk = false, vr = null;
  try { if (navigator.xr && navigator.xr.isSessionSupported) navigator.xr.isSessionSupported('immersive-vr').then((ok) => { vrOk = !!ok; if (ok) showLayers(); }).catch(() => {}); } catch (_) {}
  const enterVR = async (L) => {
    const S = L.space, { THREE } = S;
    let session;
    try { session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor'] }); }
    catch (e) { said.textContent = 'VR did not start: ' + (e && e.message ? e.message : 'the headset said no') + '.'; return; }
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: false }); r.xr.enabled = true; r.outputColorSpace = THREE.SRGBColorSpace;
    r.xr.setReferenceSpaceType('local-floor');
    const was = { pos: S.group.position.clone(), scale: S.group.scale.clone(), bg: S.scene.background };
    const eye = new THREE.PerspectiveCamera(70, 1, 0.05, 50); // the headset moves the camera it renders with: its own, so the card's view stays put
    S.group.position.set(0, 1.3, -0.9); S.group.scale.setScalar(0.25); S.scene.background = new THREE.Color(0x0b0d12);
    // a stroke ends on the trigger's release, or when the session ends first (the headset taken off mid-stroke, or the release not
    // handled before the end): either way it is kept and Undo can take it back
    const finish = (pen) => { pen.on = false; if (pen.live) { undo.push({ L, mesh: pen.live }); if (undo.length > 30) undo.shift(); } pen.live = null; pen.pts = []; };
    const pens = [0, 1].map((i) => { const c = r.xr.getController(i); S.scene.add(c);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(color) })); c.add(tip);
      const pen = { c, tip, on: false, pts: [], live: null };
      c.addEventListener('selectstart', () => { pen.on = true; pen.pts = []; pen.live = null; });
      c.addEventListener('selectend', () => finish(pen));
      return pen; });
    const at = new THREE.Vector3();
    r.setAnimationLoop(() => {
      for (const pen of pens) {
        pen.tip.material.color.set(color);
        if (!pen.on) continue;
        pen.c.getWorldPosition(at); S.group.updateMatrixWorld(true); const q = S.group.worldToLocal(at.clone());
        const lastPt = pen.pts[pen.pts.length - 1]; if (lastPt && lastPt.distanceTo(q) < 0.02) continue;
        pen.pts.push(q);
        if (pen.live) { S.group.remove(pen.live); pen.live.geometry.dispose(); pen.live.material.dispose(); }
        pen.live = tubeOf(S, pen.pts); S.group.add(pen.live);
      }
      r.render(S.scene, eye);
    });
    vr = { session, r };
    session.addEventListener('end', () => {
      r.setAnimationLoop(null); for (const pen of pens) { finish(pen); S.scene.remove(pen.c); pen.tip.geometry.dispose(); pen.tip.material.dispose(); }
      S.group.position.copy(was.pos); S.group.scale.copy(was.scale); S.scene.background = was.bg; r.dispose(); vr = null;
      renderSpace(L); compose(); said.textContent = 'Back from VR: what you painted there is on ' + named(L) + '.';
    });
    await r.xr.setSession(session);
    said.textContent = 'In VR: hold a trigger to paint in the air in front of you; take the headset off or press its menu to come back.';
  };
  const paintSpace = (L, p) => {
    const S = L.space, q = spaceAt(L, p); if (!q) return;
    const lastPt = S.pts[S.pts.length - 1]; if (lastPt && lastPt.distanceTo(q) < 0.015) return;
    S.pts.push(q);
    if (S.live) { S.group.remove(S.live); S.live.geometry.dispose(); S.live.material.dispose(); }
    S.live = tubeOf(S, S.pts); S.group.add(S.live); renderSpace(L); compose();
  };
  // "make it my backdrop" (frontier 25, step 3): the picture as it shows now, every visible layer, 3D ones as they are turned,
  // goes behind your Verse (void.html keeps it in the look, which your passkey syncs). Transparent stays transparent: the strokes
  // float on your Verse's own colour. Too big to sync, it is drawn smaller until it fits.
  const backdropSrc = () => {
    compose();
    for (let w = cv.width; w >= 240; w = Math.round(w * 0.75)) {
      const c = document.createElement('canvas'); c.width = w; c.height = Math.round(cv.height * w / cv.width); c.getContext('2d').drawImage(cv, 0, 0, c.width, c.height);
      let src = c.toDataURL('image/webp', 0.85); if (!/^data:image\/webp/.test(src)) src = c.toDataURL('image/png');
      if (src.length < 550000) return src;
    }
    return '';
  };
  const talk = (w) => { const c = layerCommand(w, layers.map((x) => x.name)); if (!c) return false; said.textContent = doLayer(c); compose(); showLayers(); return true; };
  const show = () => {
    said.textContent = 'Brush: ' + cur.name + ' (' + describe(cur) + ')';
    $('.vd-brushes').innerHTML = brushes.slice(-10).map((b, i) => '<button type="button" data-brush="' + i + '"' + (b === cur || b.name === cur.name ? ' aria-pressed="true"' : '') + '>' + esc(b.name) + '</button>').join(''); // void-review: ok (every name through esc)
  };
  $('.vd-make').addEventListener('submit', (e) => {
    e.preventDefault(); const w = $('.vd-words').value;
    if (talk(w)) { $('.vd-words').value = ''; return; }
    const b = brushFrom(w);
    if (!b) { said.textContent = 'Name a tool in it (pencil, charcoal, chalk, crayon, ink, marker, watercolor, airbrush) and how it should feel, or tell the layers what to do ("new layer for the moon", "put the moon behind the house").'; return; }
    brushes = brushes.filter((x) => x.name !== b.name).concat([b]); keep(brushes); cur = b; if (b.color) color = b.color; $('.vd-words').value = ''; show();
  });
  $('.vd-brushes').addEventListener('click', (e) => { const btn = e.target.closest('[data-brush]'); if (!btn) return; cur = brushes.slice(-10)[+btn.dataset.brush]; if (cur.color) color = cur.color; show(); });
  $('.vd-colors').addEventListener('click', (e) => { const btn = e.target.closest('[data-color]'); if (btn) color = btn.dataset.color; });
  $('.vd-layers').addEventListener('click', (e) => {
    if (e.target.closest('.vd-addlayer')) { talk('new layer'); return; }
    if (e.target.closest('.vd-add3d')) { talk('new 3d layer'); return; }
    if (e.target.closest('.vd-turn')) { turning = !turning; showLayers(); return; }
    if (e.target.closest('.vd-vr')) { if (A.space && !vr) enterVR(A); return; }
    const btn = e.target.closest('[data-layer]'); if (!btn) return; A = layers[+btn.dataset.layer] || A; said.textContent = 'Drawing on ' + named(A) + '.'; showLayers();
  });
  $('.vd-undo').addEventListener('click', () => { const u = undo.pop(); if (u && layers.includes(u.L)) { if (u.mesh) { u.L.space.group.remove(u.mesh); u.mesh.geometry.dispose(); u.mesh.material.dispose(); renderSpace(u.L); } else u.L.g.putImageData(u.im, 0, 0); } compose(); });
  $('.vd-clear').addEventListener('click', () => { talk('clear ' + A.name); });
  $('.vd-backdrop').addEventListener('click', () => { talk('make it my backdrop'); });
  $('.vd-save').addEventListener('click', () => { compose(); const a = document.createElement('a'); a.download = 'void-drawing.png'; a.href = cv.toDataURL('image/png'); a.click(); });
  // drawing: stamps along the path, spacing a quarter of the size; the grain mask is laid over each stroke on its own layer
  // steadying that learns your hand: each stroke's own shake is measured, the hand's is kept
  // in this browser, and the pen is followed just closely enough to take that shake out (a lazy follow: the line moves part of the
  // way toward the pen each move, and catches up where you lift it)
  let hand = (() => { try { return JSON.parse(localStorage.getItem(HAND) || 'null'); } catch (_) { return null; } })(), steadyOn = true, raw = [], lead = null;
  let manual = 0; // 0 = learned from your hand; 1-100 = how much of each wobble to take out, set by hand (a stabilizer level)
  const follow = () => (!steadyOn ? 1 : manual ? Math.max(0.15, 1 - manual / 100 * 0.85) : hand && hand.strokes ? followFor(hand.tremor) : 1);
  const showSteady = () => { $('.vd-steady').textContent = !steadyOn ? 'Steadying off: the line follows your pen exactly.'
    : manual ? 'Steadiness set by hand: the line takes out ' + Math.round((1 - follow()) * 100) + '% of each wobble (slide to 0 to let it learn your hand again).'
    : hand && hand.strokes ? 'Steadying learned from your hand (' + hand.strokes + ' stroke' + (hand.strokes > 1 ? 's' : '') + '): a shake of ' + hand.tremor + ' px, so the line takes out ' + Math.round((1 - follow()) * 100) + '% of each wobble.'
    : 'Steadying learns your hand as you draw.'; };
  $('.vd-strength').addEventListener('input', (e) => { manual = +e.target.value; $('.vd-strength-v').textContent = manual ? manual + '%' : 'auto'; showSteady(); });
  $('.vd-steadyon').addEventListener('click', (e) => { steadyOn = !steadyOn; e.target.setAttribute('aria-pressed', String(steadyOn)); e.target.textContent = steadyOn ? 'Steadying on' : 'Steadying off'; showSteady(); });
  let last = null, stroke = null, sg = null;
  const at = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
  const line = (a, b) => { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), step = Math.max(0.5, cur.size * 0.25), n = Math.max(1, Math.ceil(d / step)); for (let i = 1; i <= n; i++) dab(sg, a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n, cur, color); };
  const commit = () => {
    if (!stroke) return;
    if (cur.grain > 0) { sg.globalCompositeOperation = 'destination-out'; sg.globalAlpha = cur.grain * 0.9; sg.fillStyle = sg.createPattern(grainOf(), 'repeat'); sg.fillRect(0, 0, cv.width, cv.height); sg.globalCompositeOperation = 'source-over'; }
    A.g.globalAlpha = 1; A.g.globalCompositeOperation = A.locked ? 'source-atop' : 'source-over'; A.g.drawImage(stroke, 0, 0); A.g.globalCompositeOperation = 'source-over'; stroke = null; sg = null; compose();
  };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture(e.pointerId); if (A.hidden) { A.hidden = false; showLayers(); }
    if (A.kind === '3d') { if (!A.space) { said.textContent = named(A) + ' is still starting; draw again in a moment.'; return; } const p0 = at(e);
      if (turning || e.button === 2 || e.shiftKey) { spin = { x: p0[0], y: p0[1], yaw: A.space.yaw, pitch: A.space.pitch }; return; }
      last = p0; raw = [p0]; lead = p0; A.space.pts = []; A.space.live = null; paintSpace(A, p0); return; } undo.push({ L: A, im: A.g.getImageData(0, 0, cv.width, cv.height) }); if (undo.length > 30) undo.shift();
    stroke = document.createElement('canvas'); stroke.width = cv.width; stroke.height = cv.height; sg = stroke.getContext('2d');
    last = at(e); raw = [last]; lead = last; dab(sg, last[0], last[1], cur, color); compose();
  });
  cv.addEventListener('pointermove', (e) => {
    if (spin && A.space) { const r = at(e); A.space.yaw = spin.yaw + (r[0] - spin.x) / cv.width * Math.PI * 2; A.space.pitch = clamp(spin.pitch + (r[1] - spin.y) / cv.height * Math.PI, -1.4, 1.4); renderSpace(A); compose(); return; }
    if (!last || (!sg && !(A.space && A.space.live))) return; const r = at(e); raw.push(r); const k = follow(), p = [lead[0] + (r[0] - lead[0]) * k, lead[1] + (r[1] - lead[1]) * k]; lead = p;
    if (A.space) { paintSpace(A, p); last = p; return; }
    line(last, p); last = p; compose(); }); // show the stroke as it goes, in its layer's place
  const end = () => { if (spin) { spin = null; return; } if (!last) return;
    if (A.space && A.space.live) { const tail = raw[raw.length - 1]; if (tail) paintSpace(A, tail); undo.push({ L: A, mesh: A.space.live }); if (undo.length > 30) undo.shift(); A.space.live = null; A.space.pts = [];
      hand = learnHand(hand, raw); try { localStorage.setItem(HAND, JSON.stringify(hand)); } catch (_) {} showSteady(); last = null; return; }
    const tail = raw[raw.length - 1]; if (tail && sg) line(last, tail); // catch up to where the pen lifted
    hand = learnHand(hand, raw); try { localStorage.setItem(HAND, JSON.stringify(hand)); } catch (_) {} showSteady();
    last = null; commit(); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end); cv.addEventListener('contextmenu', (e) => { if (A.kind === '3d') e.preventDefault(); });
  show(); showSteady(); showLayers();
  return 'draw';
}

export default {
  name: 'draw',
  examples: ['let me draw', 'open a canvas', 'sketch pad', 'make a brush like dry charcoal', 'new brush: soft watercolor', 'make a thick wet ink brush', 'make a 2d sketch of a tree'],
  nearMisses: ['draw a cat', 'what is charcoal', 'how do i draw a horse', 'paint my wall', 'make a cube'],
  drawOf, brushFrom,
  match(lower, text) { return !!drawOf(text || lower); },
  run,
  suite() {
    const c = brushFrom('dry charcoal that catches the paper grain'), i = brushFrom('thick wet ink'), f = brushFrom('faint pencil');
    const ok = c && c.tool === 'charcoal' && c.grain >= 0.9 && i && i.tool === 'ink' && i.size === 8 && i.hardness < 1 && f && f.flow < TOOLS.pencil.flow
      && tremorOf([[0, 0], [1, 0], [2, 0], [3, 0]]) === 0 && tremorOf([[0, 0], [1, 2], [2, 0], [3, 2], [4, 0]]) === 2 && followFor(0) === 1 && followFor(3) < followFor(1) && followFor(50) === 0.15
      && learnHand(null, [[0, 0], [1, 2], [2, 0], [3, 2], [4, 0], [5, 2]]).strokes === 1 && learnHand({ tremor: 1, strokes: 3 }, [[0, 0], [1, 0]]).strokes === 3
      && layerCommand('put the moon behind the house', ['sky', 'house', 'moon']).rel === 'behind' && moveLayer(['sky', 'house', 'moon'], 2, 'behind', 1).join() === 'sky,moon,house'
      && layerCommand('new layer for the moon', []).name === 'moon' && layerCommand('make the shading multiply', ['shading']).mode === 'multiply' && layerCommand('hide the dog', ['sky']).op === 'missing' && !layerCommand('what is a layer', ['sky'])
      && layerCommand('make the ring thicker', ['ring']).by === 1.5 && layerCommand('print the ring', ['ring']).op === 'print' && layerCommand('print it', []).i === -1
      && printModel([{ positions: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], indices: [0, 2, 1, 0, 1, 3, 0, 3, 2, 1, 2, 3] }], 't', 50).size.join() === '50,50,50'
      && layerCommand('make it my backdrop', []).op === 'backdrop' && layerCommand('use this drawing as my background', []).op === 'backdrop' && !layerCommand('make the sky my backdrop', ['sky'])
      && layerCommand('new 3d layer for the ring', []).space === true && layerCommand('turn the ring left', ['ring']).deg === -90 && tubeRadius(8, 100) === 0.04
      && drawOf('let me draw') && drawOf('make a brush like dry charcoal').brush.tool === 'charcoal' && !drawOf('draw a cat') && !drawOf('what is charcoal');
    return { ok: !!ok, got: ok ? 'pass' : JSON.stringify({ c, i, f }) };
  }
};
