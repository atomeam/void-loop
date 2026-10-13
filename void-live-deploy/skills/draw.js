/**
 * draw skill - a drawing card where you describe a brush in words and Void makes it (target: ibisPaint X, feature "brushes";
 * domains/targets/ibispaint.json). Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "let me draw", "open a canvas", "sketch pad", "make a brush like dry charcoal", "new brush: soft watercolor".
 * ibisPaint ships thousands of fixed brushes with sliders. One notch past (Elevenessee): say what you want ("dry charcoal that
 * catches the paper grain", "thick wet ink", "faint pencil") and the brush is built from the words: its tool sets size,
 * edge, flow and grain, the words around it move them, and the card says what it understood. Brushes you make are kept in
 * this browser. Strokes are stamped along the path (spacing a fraction of the size), each stamp a radial dab with its edge
 * softness, flow and a paper-grain mask, the way painting apps build brushes.
 * Layers you talk to (feature "layers"): "new layer for the moon", "put the moon behind the house", "hide the sky", "make the
 * shading multiply", "clip the shading to the skin", "lock the skin", "merge the shading down": the same box takes them.
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

// layers you can talk to (target ibisPaint X, feature layers): every layer has a name, and the card takes plain words for what to do
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
  if ((m = new RegExp('^(?:new|add)(?: a)? layer(?:s)?(?: (?:for|called|named))?(?: ' + L + ')?$').exec(t)) || (m = new RegExp('^add ' + L + ' (?:on|as) (?:a )?new layer$').exec(t))) return { op: 'add', name: bare(m[1] || '') || 'layer ' + (names.length + 1) };
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
    p.innerHTML = '<h2>Draw</h2><div class="sub">Describe a brush in your own words and Void makes it: "dry charcoal that catches the paper grain", "thick wet ink", "faint pencil".</div>' // void-review: ok (fixed text; the brush row below is built with esc)
      + '<div class="vdraw"><canvas width="900" height="600" style="width:100%;touch-action:none;background:#fbfaf6;border-radius:10px;cursor:crosshair"></canvas>'
      + '<form class="vd-make" style="display:flex;gap:6px;margin:8px 0"><input class="vd-words" placeholder="describe a brush, or tell the layers what to do…" aria-label="describe a brush, or tell the layers what to do" style="flex:1;font:inherit;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit"><button type="submit">Make it</button></form>'
      + '<div class="vd-said sub" aria-live="polite"></div><div class="vd-layers" style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;align-items:center"></div><div class="vd-steady sub"></div><div class="vd-brushes" style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0"></div>'
      + '<div class="vd-colors" style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0">' + Object.entries(COLORS).filter(([k]) => !/grey|violet/.test(k)).map(([k, v]) => '<button type="button" data-color="' + esc(v) + '" title="' + esc(k) + '" style="width:26px;height:26px;border-radius:50%;background:' + esc(v) + ';border:2px solid rgba(255,255,255,.3)"></button>').join('') + '</div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="vd-undo">Undo</button><button type="button" class="vd-clear">Clear layer</button><button type="button" class="vd-save">Save as picture</button><button type="button" class="vd-steadyon" aria-pressed="true">Steadying on</button><label class="sub" style="display:flex;align-items:center;gap:6px">Steadiness <input class="vd-strength" type="range" min="0" max="100" value="0" aria-label="steadiness, 0 = learned from your hand"><span class="vd-strength-v">auto</span></label></div></div>';
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
      + (L.hidden ? ' (hidden)' : '') + (L.alpha < 1 ? ' ' + Math.round(L.alpha * 100) + '%' : '') + (L.blend !== 'normal' ? ' ' + esc(L.blend) : '') + (L.locked ? ' (locked)' : '') + (L.clipTo && layers.includes(L.clipTo) ? ' (clipped to ' + esc(L.clipTo.name) + ')' : '') + '</button>').join('')
      + '<button type="button" class="vd-addlayer" title="new layer on top">+ layer</button>';
  };
  const named = (L) => '"' + L.name + '"';
  const doLayer = (c) => {
    const L = layers[c.i];
    if (c.op === 'missing') return 'There is no layer called "' + c.name + '". The layers are: ' + layers.map((x) => x.name).join(', ') + '.';
    if (c.op === 'cannot') return 'Cannot do that: ' + c.why + '.';
    if (c.op === 'add') { const n = layers.some((x) => x.name === c.name) ? c.name + ' ' + (layers.length + 1) : c.name; A = newLayer(n); layers.push(A); return 'New layer ' + named(A) + ' on top. You are drawing on it.'; }
    if (c.op === 'move') { layers = moveLayer(layers, c.i, c.rel, c.of); return named(L) + (c.rel === 'top' ? ' is now on top.' : c.rel === 'bottom' ? ' is now at the bottom.' : ' is now ' + (c.rel === 'behind' ? 'behind ' : 'in front of ') + named(layers[layers.indexOf(L) + (c.rel === 'behind' ? 1 : -1)]) + '.'); }
    if (c.op === 'hide' || c.op === 'show') { L.hidden = c.op === 'hide'; return named(L) + (L.hidden ? ' is hidden (say "show ' + L.name + '" to bring it back).' : ' is showing.'); }
    if (c.op === 'lock' || c.op === 'unlock') { L.locked = c.op === 'lock'; return L.locked ? named(L) + ' is locked: you can paint over what is on it, but not outside it.' : named(L) + ' is unlocked.'; }
    if (c.op === 'select') { A = L; return 'Drawing on ' + named(L) + '.'; }
    if (c.op === 'rename') { const was = L.name; L.name = c.name; return '"' + was + '" is now called ' + named(L) + '.'; }
    if (c.op === 'opacity') { L.alpha = c.value; return named(L) + ' is at ' + Math.round(c.value * 100) + '%.'; }
    if (c.op === 'blend') { L.blend = c.mode; return named(L) + ' now blends as ' + c.mode + '.'; }
    if (c.op === 'clip') { L.clipTo = c.to < 0 ? null : layers[c.to]; return L.clipTo ? named(L) + ' only shows where ' + named(L.clipTo) + ' has paint.' : named(L) + ' is no longer clipped.'; }
    if (c.op === 'clear') { undo.push({ L, im: L.g.getImageData(0, 0, cv.width, cv.height) }); L.g.clearRect(0, 0, cv.width, cv.height); return named(L) + ' is cleared (Undo brings it back).'; }
    if (c.op === 'delete') { if (layers.length < 2) return 'It is the only layer; say "clear ' + L.name + '" to empty it.'; layers = layers.filter((x) => x !== L); if (A === L) A = layers[layers.length - 1]; return named(L) + ' is deleted. Drawing on ' + named(A) + '.'; }
    if (c.op === 'merge') { const T = layers[c.into]; if (T === L) return 'That is the same layer.';
      let src = L.c; // what shows of it goes down, as it shows: clipped to its layer, at its opacity, in its blend
      if (L.clipTo && layers.includes(L.clipTo)) { cg.clearRect(0, 0, cv.width, cv.height); cg.drawImage(L.c, 0, 0); cg.globalCompositeOperation = 'destination-in'; cg.drawImage(L.clipTo.c, 0, 0); cg.globalCompositeOperation = 'source-over'; src = clipC; }
      T.g.globalAlpha = L.alpha; T.g.globalCompositeOperation = BLENDS[L.blend] || 'source-over'; T.g.drawImage(src, 0, 0); T.g.globalAlpha = 1; T.g.globalCompositeOperation = 'source-over';
      layers = layers.filter((x) => x !== L); for (const x of layers) if (x.clipTo === L) x.clipTo = T; if (A === L) A = T; return named(L) + ' is merged into ' + named(T) + '.'; }
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
    const btn = e.target.closest('[data-layer]'); if (!btn) return; A = layers[+btn.dataset.layer] || A; said.textContent = 'Drawing on ' + named(A) + '.'; showLayers();
  });
  $('.vd-undo').addEventListener('click', () => { const u = undo.pop(); if (u && layers.includes(u.L)) u.L.g.putImageData(u.im, 0, 0); compose(); });
  $('.vd-clear').addEventListener('click', () => { talk('clear ' + A.name); });
  $('.vd-save').addEventListener('click', () => { compose(); const a = document.createElement('a'); a.download = 'void-drawing.png'; a.href = cv.toDataURL('image/png'); a.click(); });
  // drawing: stamps along the path, spacing a quarter of the size; the grain mask is laid over each stroke on its own layer
  // steadying that learns your hand (target ibisPaint X, feature stabilizer): each stroke's own shake is measured, the hand's is kept
  // in this browser, and the pen is followed just closely enough to take that shake out (a lazy follow: the line moves part of the
  // way toward the pen each move, and catches up where you lift it)
  let hand = (() => { try { return JSON.parse(localStorage.getItem(HAND) || 'null'); } catch (_) { return null; } })(), steadyOn = true, raw = [], lead = null;
  let manual = 0; // 0 = learned from your hand; 1-100 = how much of each wobble to take out, set by hand (as ibisPaint's stabilizer levels)
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
    cv.setPointerCapture(e.pointerId); if (A.hidden) { A.hidden = false; showLayers(); } undo.push({ L: A, im: A.g.getImageData(0, 0, cv.width, cv.height) }); if (undo.length > 30) undo.shift();
    stroke = document.createElement('canvas'); stroke.width = cv.width; stroke.height = cv.height; sg = stroke.getContext('2d');
    last = at(e); raw = [last]; lead = last; dab(sg, last[0], last[1], cur, color); compose();
  });
  cv.addEventListener('pointermove', (e) => { if (!last || !sg) return; const r = at(e); raw.push(r); const k = follow(), p = [lead[0] + (r[0] - lead[0]) * k, lead[1] + (r[1] - lead[1]) * k]; lead = p; line(last, p); last = p; compose(); }); // show the stroke as it goes, in its layer's place
  const end = () => { if (!last) return;
    const tail = raw[raw.length - 1]; if (tail && sg) line(last, tail); // catch up to where the pen lifted
    hand = learnHand(hand, raw); try { localStorage.setItem(HAND, JSON.stringify(hand)); } catch (_) {} showSteady();
    last = null; commit(); };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  show(); showSteady(); showLayers();
  return 'draw';
}

export default {
  name: 'draw',
  examples: ['let me draw', 'open a canvas', 'sketch pad', 'make a brush like dry charcoal', 'new brush: soft watercolor', 'make a thick wet ink brush'],
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
      && drawOf('let me draw') && drawOf('make a brush like dry charcoal').brush.tool === 'charcoal' && !drawOf('draw a cat') && !drawOf('what is charcoal');
    return { ok: !!ok, got: ok ? 'pass' : JSON.stringify({ c, i, f }) };
  }
};
