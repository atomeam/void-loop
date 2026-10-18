// void-seal — V01D's card art, drawn in the browser from a seed (owner, 2026-10-18: the ink plates "suck"; the art should be epic, the void
// itself: deep black, light moving through it). Same key, same picture, on every device, with no model and nothing sent anywhere.
// The picture is a field of light: a seeded flow field (value noise, the field minds' law) traced by a few thousand particles in additive
// light, a nebula under it, a sacred-geometry lattice and a burning core (the void looking back), star dust, a glitch tear and a bloom.
// The family's hue tints it; the rarity sets how much light it has (a Mythic burns, a Common glows). The kind picks the core's shape.
// Pure apart from the canvas it is handed: sealPlan(seed, opts) returns plain numbers (tested), drawSeal(ctx, w, h, plan) draws them.

import { motifsFor, motifPaths } from './card-subject.js';

export const VERSION = 1;
/** FNV-1a 32-bit of a string. Pure. */
export function seedOf(s) { let h = 0x811c9dc5; for (const ch of String(s == null ? '' : s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
/** a seeded generator (mulberry32). Pure. */
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// the light by rarity: particle count, how bright each stroke is, how much bloom, how many lattice rings
export const LIGHT = { mythic: { n: 1500, a: 0.075, bloom: 0.38, rings: 5, gold: 1 }, rare: { n: 1250, a: 0.065, bloom: 0.32, rings: 4, gold: 0.7 }, uncommon: { n: 1050, a: 0.055, bloom: 0.28, rings: 3, gold: 0.35 }, common: { n: 900, a: 0.05, bloom: 0.24, rings: 2, gold: 0 } };
// the composition, picked by the seed: where the light gathers and how it moves
export const FORMS = ['vortex', 'currents', 'burst', 'rift', 'orbit'];
// the core's shape by kind: sides of the lattice polygon (0 = an eye), and whether rays burst from it
const CORE = { Film: [8, 1], Show: [6, 1], Album: [0, 0], Song: [0, 1], Band: [5, 1], Game: [4, 1], Book: [4, 0], Person: [0, 0], Place: [3, 0], Creature: [0, 1], Organisation: [6, 0], Event: [12, 1], Idea: [6, 1], Answer: [0, 1], Skill: [5, 0], Miniature: [4, 1] };
const rarityKey = (r) => { const w = String(r && typeof r === 'object' ? r.name : r || '').toLowerCase(); return ({ proven: 'mythic', checked: 'rare', tested: 'uncommon', experiment: 'common' })[w] || (LIGHT[w] ? w : 'common'); };

/** everything the picture is, as numbers: same key, kind, hue and rarity in, same plan out. Pure. */
export function sealPlan(key, { kind = 'Idea', hue = null, rarity = 'common', nouns = null } = {}) {
  const seed = seedOf(String(key || '').toLowerCase().trim() + '|' + kind), r = rng(seed), L = LIGHT[rarityKey(rarity)];
  const h = Number.isFinite(+hue) ? ((+hue % 360) + 360) % 360 : Math.floor(r() * 360);
  const [sides, rays] = CORE[kind] || CORE.Idea;
  return {
    seed, hue: h, kind, light: L,
    // a palette of three lights on black: the family's hue, a cold counter-hue and (by rarity) gold
    palette: [h, (h + 150 + Math.floor(r() * 60)) % 360, (h + 300 + Math.floor(r() * 40)) % 360],
    field: { scale: 1.6 + r() * 2.2, twist: 0.6 + r() * 1.6, swirl: r() < 0.5 ? 1 : -1, octaves: 3 },
    form: FORMS[Math.floor(r() * FORMS.length)],
    // the card's subject, drawn in light at the core (owner, 2026-10-18: "the art should be of each card's subject"): the answer's words
    // (lib/card-subject.js subjectOf) mapped to a motif, else the key's own words; none found keeps the burning iris
    motif: (motifsFor(nouns || [])[0]) || (motifsFor(String(key || '').toLowerCase().split(/[^a-z]+/).filter(Boolean))[0]) || '', // the answer's words first, else the card's own name
    core: { x: 0.28 + r() * 0.44, y: 0.38 + r() * 0.24, sides, rays, spin: r() * Math.PI * 2, size: 0.3 + r() * 0.12 },
    nebula: Array.from({ length: 3 }, () => ({ x: r(), y: r(), r: 0.25 + r() * 0.4, c: Math.floor(r() * 3), a: 0.05 + r() * 0.08 })),
    tear: null,
    stars: 140 + Math.floor(r() * 120),
    // neon vector arcs sweeping round the core and crackling energy at it (owner's example card, 2026-10-18: "purple crackling energy and neon cyan vector lines")
    arcs: Array.from({ length: 2 + Math.floor(r() * 2) }, () => ({ rx: 0.4 + r() * 0.45, ry: 0.42 + r() * 0.35, rot: r() * Math.PI, a0: r() * Math.PI * 2, len: 1.4 + r() * 1.8, w: 0.7 + r() * 0.9, strands: 3 + Math.floor(r() * 4), gap: 0.025 + r() * 0.03 })),
    bolts: { mythic: 7, rare: 5, uncommon: 3, common: 2 }[rarityKey(rarity)],
  };
}

// smooth seeded value noise in 2D (bilinear over a hashed lattice with a smoothstep), octaves summed: -1..1
function noise2(seed) {
  const H = (x, y) => { let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296 * 2 - 1; };
  const s = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi); const a = H(xi, yi), b = H(xi + 1, yi), c = H(xi, yi + 1), d = H(xi + 1, yi + 1); return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf; };
  return (x, y, o = 3) => { let t = 0, amp = 1, f = 1, norm = 0; for (let i = 0; i < o; i++) { t += v(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2; } return t / norm; };
}
const hsl = (h, s, l, a) => 'hsla(' + Math.round(h) + ',' + s + '%,' + l + '%,' + a + ')';

/** draw the plan on a 2D context of w x h. The only impure part: it paints. */
export function drawSeal(ctx, w, h, p) {
  const r = rng(p.seed ^ 0x9e3779b9), N = noise2(p.seed), L = p.light, cx = p.core.x * w, cy = p.core.y * h, m = Math.min(w, h), M = Math.max(w, h);
  ctx.save();
  // the void
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, M * 0.75); bg.addColorStop(0, hsl(p.hue, 45, 7, 1)); bg.addColorStop(0.5, '#05050a'); bg.addColorStop(1, '#010103');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  // nebula
  for (const n of p.nebula) { const g = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, n.r * M); g.addColorStop(0, hsl(p.palette[n.c], 80, 45, n.a)); g.addColorStop(1, hsl(p.palette[n.c], 80, 30, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  // the flow field: particles traced through the curl of the noise, swirling round the core, in additive light
  const F = p.field, steps = 46, sl = M / 260;
  ctx.lineCap = 'round';
  const form = p.form || 'vortex', axis = p.core.spin;
  for (let i = 0; i < L.n; i++) {
    // where a thread starts: anywhere, but more of them near the core (burst and orbit gather light there)
    let x = r() * w, y = r() * h;
    if ((form === 'burst' || form === 'orbit') && r() < 0.6) { const t = r() * Math.PI * 2, d = (form === 'orbit' ? 0.5 + r() * 0.9 : r() * 0.5) * m * p.core.size * 1.6; x = cx + Math.cos(t) * d; y = cy + Math.sin(t) * d; }
    if (form === 'rift' && r() < 0.5) { const t = (r() - 0.5) * M * 1.2; x = cx + Math.cos(axis) * t; y = cy + Math.sin(axis) * t * 0.6; } const c = r(), col = c < 0.55 ? 0 : c < 0.85 ? 1 : 2, lite = 48 + r() * 22, wd = r() < 0.9 ? 0.35 + r() * 0.5 : 0.9 + r() * 0.8;
    const hot = r() < 0.035; // a few bright filaments give the eye somewhere to land
    ctx.strokeStyle = hot ? hsl(p.palette[col], 100, 80, Math.min(0.6, L.a * 5)) : hsl(p.palette[col] + (r() - 0.5) * 30, 90, lite, L.a * (0.4 + r() * 1.2));
    ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < steps; s++) {
      const nx = x / M * F.scale, ny = y / M * F.scale, e = 0.01;
      // curl of the noise (divergence-free: filaments, not blobs) plus a swirl round the core
      const dx = (N(nx, ny + e, F.octaves) - N(nx, ny - e, F.octaves)) / (2 * e), dy = -(N(nx + e, ny, F.octaves) - N(nx - e, ny, F.octaves)) / (2 * e);
      const ox = x - cx, oy = y - cy, d = Math.hypot(ox, oy) + 1;
      let vx = dx, vy = dy;
      if (form === 'vortex') { const sw = F.twist * F.swirl * Math.exp(-d / (m * 0.9)) * 3; vx += (-oy / d) * sw - (ox / d) * sw * 0.25; vy += (ox / d) * sw - (oy / d) * sw * 0.25; }
      else if (form === 'currents') { vx += Math.cos(axis * 0.3) * 1.6; vy += Math.sin(axis * 0.3) * 0.5; }
      else if (form === 'burst') { const out = 2.2 * Math.exp(-d / (m * 1.2)); vx += (ox / d) * out; vy += (oy / d) * out; }
      else if (form === 'rift') { const nx2 = -Math.sin(axis), ny2 = Math.cos(axis), side = ox * nx2 + oy * ny2, pull = 1.6 * Math.exp(-Math.abs(side) / (m * 0.5)); vx += Math.cos(axis) * pull * F.swirl - nx2 * Math.sign(side) * 0.5; vy += Math.sin(axis) * pull * F.swirl - ny2 * Math.sign(side) * 0.5; }
      else { const ring = m * p.core.size * 1.1, dr = (d - ring) / ring; vx += (-oy / d) * 2 * F.swirl - (ox / d) * dr; vy += (ox / d) * 2 * F.swirl - (oy / d) * dr; }
      const vl = Math.hypot(vx, vy) || 1; vx /= vl; vy /= vl;
      x += vx * sl * 2.2; y += vy * sl * 2.2;
      if (x < -4 || y < -4 || x > w + 4 || y > h + 4) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // the lattice: rings and the kind's polygon, thin and glowing
  const R = p.core.size * m;
  ctx.shadowBlur = 8; ctx.shadowColor = hsl(p.palette[0], 100, 60, 0.9);
  for (let k = 0; k < L.rings; k++) { ctx.strokeStyle = hsl(p.palette[k % 2 ? 1 : 0], 90, 70, 0.22 + 0.1 * (L.rings - k) / L.rings); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(cx, cy, R * (0.45 + k * 0.22), 0, Math.PI * 2); ctx.stroke(); }
  if (p.core.sides) {
    for (const [f, a] of [[1.05, 0.45], [0.62, 0.3]]) { ctx.strokeStyle = hsl(L.gold ? 45 : p.palette[1], 90, 72, a); ctx.lineWidth = 0.9; ctx.beginPath();
      for (let k = 0; k <= p.core.sides; k++) { const t = p.core.spin + k * Math.PI * 2 / p.core.sides; const px = cx + Math.cos(t) * R * f, py = cy + Math.sin(t) * R * f; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke(); }
  }
  if (p.core.rays) for (let k = 0; k < 24; k++) { const t = p.core.spin + k * Math.PI / 12, l0 = R * 0.5, l1 = R * (1.3 + (k % 3) * 0.35); ctx.strokeStyle = hsl(p.palette[0], 100, 75, 0.12); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(t) * l0, cy + Math.sin(t) * l0); ctx.lineTo(cx + Math.cos(t) * l1, cy + Math.sin(t) * l1); ctx.stroke(); }
  // neon arcs: cyan vector lines in long ellipses round the core, with a hot thin centre
  for (const A of p.arcs || []) for (let k = 0; k < A.strands; k++) { // a bundle of parallel strands, the outer ones fainter
    const f = 1 + k * A.gap, fade = 1 - k / (A.strands + 1);
    for (const [lw, al, li] of [[A.w * 3, 0.14, 55], [A.w, 0.65, 70], [A.w * 0.4, 0.9, 90]]) {
      ctx.shadowBlur = lw > 2 ? 12 : 0; ctx.shadowColor = 'hsla(186,100%,60%,0.9)'; ctx.strokeStyle = hsl(186, 100, li, al * fade); ctx.lineWidth = lw;
      ctx.beginPath(); ctx.ellipse(cx, cy, A.rx * M * 0.5 * f, A.ry * m * f, A.rot, A.a0 + k * 0.05, A.a0 + A.len - k * 0.08); ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
  // crackling energy: jagged violet bolts leaping from the core, each branching once
  // each bolt is a list of polylines (the trunk and one branch), made once and stroked twice: a wide violet glow, then a hot core on the same path
  const boltPaths = (x, y, ang, len, depth, out) => {
    const pts = [[x, y]]; let px = x, py = y;
    for (let k = 1; k <= 7; k++) { const t = ang + (r() - 0.5) * 1.1; px += Math.cos(t) * len / 7; py += Math.sin(t) * len / 7; pts.push([px, py]); if (depth && k === 3 && r() < 0.8) boltPaths(px, py, ang + (r() - 0.5) * 1.6, len * 0.5, depth - 1, out); }
    out.push(pts); return out;
  };
  for (let k = 0; k < (p.bolts || 0); k++) {
    const ang = r() * Math.PI * 2, paths = boltPaths(cx + Math.cos(ang) * R * 0.35, cy + Math.sin(ang) * R * 0.35, ang, R * (0.9 + r() * 1.3), 1, []);
    for (const [lw, li, al] of [[3.4, 62, 0.28], [0.9, 88, 0.9]]) {
      ctx.shadowBlur = lw > 2 ? 10 : 0; ctx.shadowColor = 'hsla(275,100%,65%,1)'; ctx.strokeStyle = hsl(275, 100, li, al); ctx.lineWidth = lw;
      for (const pts of paths) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); }
    }
  }
  ctx.shadowBlur = 0;
  // the subject: its motif in light, a glowing silhouette with a hot neon edge, over a halo
  const paths = p.motif && typeof Path2D === 'function' ? motifPaths(p.motif) : null;
  if (paths) {
    const sz = R * 2.1, halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.75);
    halo.addColorStop(0, hsl(p.palette[0], 100, 60, 0.45)); halo.addColorStop(0.5, hsl(p.palette[1], 100, 45, 0.12)); halo.addColorStop(1, hsl(p.palette[1], 100, 40, 0));
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(cx, cy, sz * 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.translate(cx - sz / 2, cy - sz / 2); ctx.scale(sz / 100, sz / 100);
    const shapes = paths.map(([d, f]) => [new Path2D(d), f]);
    ctx.globalCompositeOperation = 'source-over';
    for (const [P, f] of shapes) if (f !== 'N') { ctx.fillStyle = f === 'I' ? 'rgba(2,2,8,0.92)' : f === 'G' ? 'hsla(44,90%,55%,0.85)' : hsl(p.palette[0], 60, f === 'L' ? 30 : 16, 0.92); ctx.fill(P); }
    ctx.globalCompositeOperation = 'lighter';
    for (const [lw, li, al, bl] of [[5, 60, 0.35, 16], [1.6, 78, 0.9, 6], [0.6, 95, 0.9, 0]]) {
      ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.shadowBlur = bl; ctx.shadowColor = hsl(p.palette[0], 100, 60, 1); ctx.strokeStyle = hsl(p.palette[0], 100, li, al);
      for (const [P] of shapes) ctx.stroke(P);
    }
    ctx.shadowBlur = 0; ctx.restore();
  } else {
  // the core: a burning iris with a black pupil (the void looks back)
  const ir = R * (form === 'currents' || form === 'rift' ? 0.18 : 0.26), g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, ir * 3.2);
  g1.addColorStop(0, hsl(p.palette[0], 100, 82, 0.85)); g1.addColorStop(0.22, hsl(p.palette[0], 100, 58, 0.4)); g1.addColorStop(0.6, hsl(p.palette[1], 100, 45, 0.08)); g1.addColorStop(1, hsl(p.palette[1], 100, 40, 0));
  ctx.fillStyle = g1; ctx.beginPath(); ctx.arc(cx, cy, ir * 3.2, 0, Math.PI * 2); ctx.fill();
  if (L.gold) { const g2 = ctx.createRadialGradient(cx, cy, ir * 0.8, cx, cy, ir * 1.5); g2.addColorStop(0, 'hsla(44,100%,70%,0)'); g2.addColorStop(0.5, 'hsla(44,100%,70%,' + (0.5 * L.gold) + ')'); g2.addColorStop(1, 'hsla(44,100%,60%,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx, cy, ir * 1.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalCompositeOperation = 'source-over';
  const pr = ir * 0.42, g3 = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.6); g3.addColorStop(0, 'rgba(0,0,0,1)'); g3.addColorStop(0.6, 'rgba(0,0,0,0.92)'); g3.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(cx, cy, pr * 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(cx - pr * 0.35, cy - pr * 0.4, Math.max(1, pr * 0.16), 0, Math.PI * 2); ctx.fill();
  }
  // star dust
  for (let i = 0; i < p.stars; i++) { const x = r() * w, y = r() * h, b = r(); ctx.fillStyle = hsl(p.palette[b < 0.8 ? 1 : 0], 60, 85, 0.25 + b * 0.6); ctx.fillRect(x, y, b > 0.93 ? 1.6 : 0.9, b > 0.93 ? 1.6 : 0.9); }
  ctx.globalCompositeOperation = 'source-over';
  // bloom: the picture, blurred, laid over itself in light
  if (typeof ctx.filter === 'string' && ctx.canvas) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = L.bloom; ctx.filter = 'blur(' + Math.round(m / 22) + 'px)'; ctx.drawImage(ctx.canvas, 0, 0, w, h); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // a glitch tear: one strip of the picture slips sideways, with a cold edge
  if (p.tear && ctx.canvas) { const ty = p.tear.y * h, th = Math.max(2, p.tear.h * h); try { ctx.drawImage(ctx.canvas, 0, ty, w, th, p.tear.dx * w, ty, w, th); } catch (_) {} ctx.fillStyle = hsl(p.palette[1], 100, 75, 0.25); ctx.fillRect(0, ty, w, 1); }
  // vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, m * 0.3, w / 2, h / 2, M * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.78)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// On the card: the art box (.vc-art) gets the seal as a picture under any painted art (lib/card-forge.js lays its image over it) and over
// V01D's ink plate (lib/card-art.js, kept for where no canvas runs and for the saved SVG). Drawn when the browser is idle, once per key and
// size per page (a rebuilt frame reuses the picture). A real photo of the thing is never covered.
export const SEAL_CSS = '.vcard .vc-art>img.vc-seal{position:absolute;inset:0;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;object-fit:cover;display:block;animation:vc-seal-in .6s ease-out 1}.vcard .vc-art.vc-sealed>svg{visibility:hidden}@keyframes vc-seal-in{from{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.vcard .vc-art .vc-seal{animation:none}}';
const made = new Map();
/** the picture for a plan at w x h CSS pixels (2x for sharpness), as a data URL; '' where no canvas runs */
export function sealUrl(plan, w, h) {
  const k = plan.seed + '|' + plan.hue + '|' + plan.light.n + '|' + plan.motif + '|' + w + 'x' + h; if (made.has(k)) return made.get(k);
  let url = '';
  try { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const ctx = c.getContext('2d'); if (ctx) { ctx.scale(2, 2); drawSeal(ctx, w, h, plan); url = c.toDataURL('image/webp', 0.9); if (!/^data:image\/webp/.test(url)) url = c.toDataURL('image/jpeg', 0.9); } } catch (_) { url = ''; }
  if (made.size > 120) made.delete(made.keys().next().value);
  made.set(k, url); return url;
}
/** put the seal into a card's art box: key, kind, hue and rarity as the ink plate gets them. Never throws. */
export function sealArt(box, { key = '', kind = 'Idea', hue = null, rarity = null, nouns = null } = {}) {
  try {
    if (!box || box.classList.contains('has-photo') || box.querySelector(':scope > .vc-seal') || typeof document === 'undefined') return;
    let tries = 0;
    const go = () => {
      if (!box.isConnected || box.querySelector(':scope > .vc-seal')) return;
      if ((box.clientWidth || 0) < 120 && tries++ < 10) { setTimeout(go, 120); return; } // the card is still laying out
      const w = Math.max(160, Math.min(720, Math.round(box.clientWidth || 520))), h = Math.max(60, Math.min(400, Math.round(box.clientHeight || 150)));
      const url = sealUrl(sealPlan(key, { kind, hue, rarity, nouns }), w, h); if (!url) return;
      const im = document.createElement('img'); im.className = 'vc-seal'; im.alt = ''; im.decoding = 'async'; im.src = url;
      box.insertBefore(im, box.querySelector(':scope > .vc-forge-img, :scope > .vc-forge-btn')); box.classList.add('vc-sealed');
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 400 }); else setTimeout(go, 0);
  } catch (_) {}
}
