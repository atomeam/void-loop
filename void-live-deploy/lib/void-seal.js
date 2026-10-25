// void-seal — Verse's card art, drawn in the browser from a seed (owner, 2026-10-18: the ink plates "suck"; the art should be epic, the void
// itself: deep black, light moving through it). Same key, same picture, on every device, with no model and nothing sent anywhere.
// The picture is a field of light: a seeded flow field (value noise, the field minds' law) traced by a few thousand particles in additive
// light, a nebula under it, a sacred-geometry lattice and a burning core (the void looking back), star dust, a glitch tear and a bloom.
// The family's hue tints it; the rarity sets how much light it has (a Mythic burns, a Common glows). The kind picks the core's shape.
// Pure apart from the canvas it is handed: sealPlan(seed, opts) returns plain numbers (tested), drawSeal(ctx, w, h, plan) draws them.

import { motifsFor, motifPaths, motifHue, GROUNDED } from './card-subject.js';

export const VERSION = 3; // 3: the atom galaxy (2026-10-25)
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
  // the subject's motif: the card's own short name first ("black hole", "cat": the subject), else the answer's words, else nothing (the burning iris)
  const keyWords = String(key || '').toLowerCase().split(/[^a-z]+/).filter(Boolean), motif = (keyWords.length <= 4 && motifsFor(keyWords)[0]) || (motifsFor(nouns || [])[0]) || motifsFor(keyWords)[0] || '';
  const mh = motifHue(motif), main = mh == null ? h : mh; // a dragon burns red and the sea is blue; the family's hue still tints the nebula and the counter-light
  return {
    seed, hue: h, kind, light: L,
    // a palette of three lights on black: the subject's hue (else the family's), a cold counter-hue and a third
    palette: [main, (h + 150 + Math.floor(r() * 60)) % 360, (h + 300 + Math.floor(r() * 40)) % 360],
    field: { scale: 1.6 + r() * 2.2, twist: 0.6 + r() * 1.6, swirl: r() < 0.5 ? 1 : -1, octaves: 3 },
    form: FORMS[Math.floor(r() * FORMS.length)],
    // the card's subject, drawn in light at the core (owner, 2026-10-18: "the art should be of each card's subject"): the answer's words
    // (lib/card-subject.js subjectOf) mapped to a motif, else the key's own words; none found keeps the burning iris
    motif, grounded: GROUNDED.has(motif),
    core: { x: 0.28 + r() * 0.44, y: 0.38 + r() * 0.24, sides, rays, spin: r() * Math.PI * 2, size: 0.3 + r() * 0.12 },
    nebula: Array.from({ length: 3 }, () => ({ x: r(), y: r(), r: 0.25 + r() * 0.4, c: Math.floor(r() * 3), a: 0.05 + r() * 0.08 })),
    tear: null,
    stars: 140 + Math.floor(r() * 120),
    // neon vector arcs sweeping round the core and crackling energy at it (owner's example card, 2026-10-18: "purple crackling energy and neon cyan vector lines")
    arcs: Array.from({ length: 2 + Math.floor(r() * 2) }, () => ({ rx: 0.4 + r() * 0.45, ry: 0.42 + r() * 0.35, rot: r() * Math.PI, a0: r() * Math.PI * 2, len: 1.4 + r() * 1.8, w: 0.7 + r() * 0.9, strands: 3 + Math.floor(r() * 4), gap: 0.025 + r() * 0.03 })),
    bolts: { mythic: 7, rare: 5, uncommon: 3, common: 2 }[rarityKey(rarity)],
    // the atom galaxy (owner, 2026-10-25: "make all card art bigger and better with the updated atom galaxy theme"): a spiral galaxy at the centre,
    // seen at a slant, and three orbits of an atom round it in violet, electric blue and gold, each with its electron; the seed tilts and turns them
    galaxy: { arms: 2 + Math.floor(r() * 3), twist: 1.6 + r() * 1.4, tilt: 0.42 + r() * 0.3, rot: r() * Math.PI * 2, spin: r() < 0.5 ? 1 : -1 },
    orbits: [275, 205, 44].map((hue, k) => ({ hue, rot: [0.08, 0.62, -0.62][k] * (r() < 0.5 ? 1 : -1) + (r() - 0.5) * 0.25, ratio: 0.26 + r() * 0.12, size: 0.86 + r() * 0.2, phase: r() * Math.PI * 2, e: r() * Math.PI * 2 })),
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
  const r = rng(p.seed ^ 0x9e3779b9), L = p.light, m = Math.min(w, h), M = Math.max(w, h), cx = w / 2;
  // the subject's motif is drawn whole: at most 64% of the window's height, its centre kept clear of the top and the bottom edge
  const msz = p.motif ? Math.min(p.core.size * m * 2.1, h * 0.64) : 0;
  const cy = msz ? Math.max(msz / 2 + h * 0.06, Math.min(h - msz / 2 - h * 0.06, p.core.y * h)) : h / 2;
  const G = p.galaxy || { arms: 2, twist: 2, tilt: 0.55, rot: 0, spin: 1 }, form = p.form || 'vortex';
  // the galaxy's size: it fills the short side, wider on a wide window; an edge-on galaxy ('currents') is flatter, a barred one ('rift') straighter
  const Rg = Math.min(m * 0.62, M * 0.34) * (form === 'burst' ? 0.9 : 1), tilt = form === 'currents' ? G.tilt * 0.55 : G.tilt, twist = form === 'rift' ? G.twist * 0.7 : G.twist;
  const plane = (x, y) => { const c = Math.cos(G.rot * 0.25), s = Math.sin(G.rot * 0.25); y *= tilt; return [cx + x * c - y * s, cy + x * s + y * c]; };
  ctx.save();
  // deep space, a breath of the family's hue at the centre
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, M * 0.75); bg.addColorStop(0, hsl(p.hue, 40, 8, 1)); bg.addColorStop(0.45, '#04040a'); bg.addColorStop(1, '#010103');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'lighter';
  // nebula clouds in the palette, faint, off-centre
  for (const n of p.nebula) { const g = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, n.r * M); g.addColorStop(0, hsl(p.palette[n.c], 70, 42, n.a * 0.8)); g.addColorStop(1, hsl(p.palette[n.c], 70, 28, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  // far stars, fine and many, a few big ones with a cross flare
  for (let i = 0; i < p.stars * 2; i++) { const x = r() * w, y = r() * h, b = r(); ctx.fillStyle = b < 0.85 ? hsl(220, 30, 88, 0.2 + b * 0.5) : hsl([44, 275, 205][i % 3], 80, 82, 0.6 + b * 0.35); const z = b > 0.97 ? 1.7 : b > 0.85 ? 1.1 : 0.7; ctx.fillRect(x, y, z, z); }
  for (let k = 0; k < (p.bolts || 2) + 2; k++) { const x = r() * w, y = r() * h, l = m * (0.02 + r() * 0.03); ctx.strokeStyle = 'hsla(45,90%,88%,0.55)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(x - l, y); ctx.lineTo(x + l, y); ctx.moveTo(x, y - l); ctx.lineTo(x, y + l); ctx.stroke(); }
  // the galaxy: stars streaked along its spiral arms, gold-white at the heart, violet and blue in the arms, pink knots of new stars
  ctx.lineCap = 'round';
  for (let i = 0; i < L.n * 3; i++) {
    const arm = i % G.arms, t = Math.pow(r(), 0.7), spread = (r() - 0.5) * (0.5 + t * 0.9) * (form === 'rift' && t < 0.3 ? 0.2 : 1);
    const a = G.rot + arm * Math.PI * 2 / G.arms + G.spin * t * twist * Math.PI + spread, rad = Rg * (0.04 + t), len = 0.05 + r() * 0.12;
    const [x0, y0] = plane(Math.cos(a) * rad, Math.sin(a) * rad), [x1, y1] = plane(Math.cos(a + G.spin * len) * rad, Math.sin(a + G.spin * len) * rad);
    const knot = r() < 0.04, hue = t < 0.22 ? 44 : knot ? 320 : r() < 0.55 ? 270 + r() * 20 : 205 + r() * 20, lite = t < 0.22 ? 82 : 62 + r() * 18;
    ctx.strokeStyle = hsl(hue, t < 0.22 ? 80 : 85, lite, L.a * (knot ? 7 : 3.4) * (1.15 - t * 0.55)); ctx.lineWidth = knot ? 1.6 : 0.6 + r() * 0.9;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  // its bright heart
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, Rg * 0.5); core.addColorStop(0, 'hsla(48,100%,97%,1)'); core.addColorStop(0.2, 'hsla(44,100%,75%,0.7)'); core.addColorStop(0.6, 'hsla(30,90%,55%,0.14)'); core.addColorStop(1, 'hsla(275,90%,50%,0)');
  ctx.fillStyle = core; ctx.beginPath(); ctx.ellipse(cx, cy, Rg * 0.5, Rg * 0.5 * Math.max(0.55, tilt), G.rot * 0.25, 0, Math.PI * 2); ctx.fill();
  // the atom's orbits: long tilted ellipses of light, brighter along their front, dusted with sparks, each carrying a glowing electron
  const Ro = Math.min(M * 0.47, m * 1.05) * (form === 'orbit' ? 1.04 : 0.96);
  for (const O of p.orbits || []) {
    const c = Math.cos(O.rot), s = Math.sin(O.rot);
    // the whole orbit stays inside the window: the tilted ellipse's half-width and half-height are worked out and the orbit shrunk to fit
    let rx = Ro * O.size; const fit = Math.min(1, (w * 0.47) / Math.hypot(rx * c, rx * O.ratio * s), (h * 0.46) / Math.hypot(rx * s, rx * O.ratio * c)); rx *= fit;
    const ry = rx * O.ratio, at = (t, f = 1) => { const x = Math.cos(t) * rx * f, y = Math.sin(t) * ry * f; return [cx + x * c - y * s, cy + x * s + y * c]; };
    const seg = 24, sub = 5, strands = 3 + L.rings;
    // a bundle of strands, like light smeared along the path: two wide faint passes for the glow (no shadow blur: it cost seconds a card), then fine
    // bright threads a little apart; each pass is stroked in 24 pieces whose brightness rises toward one side of the orbit
    for (let q = 0; q < strands; q++) {
      const f = 1 + (q - (strands - 1) / 2) * 0.012, first = q === 0;
      for (const [lw, li, al] of first ? [[14, 55, 0.05], [6, 60, 0.12], [2.4, 72, 0.5], [0.9, 94, 0.95]] : [[0.7, 80, 0.35]]) {
        ctx.lineWidth = lw;
        for (let k = 0; k < seg; k++) { const t0 = k / seg * Math.PI * 2, glow = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(t0 + Math.PI / seg + O.phase), 1.4);
          ctx.strokeStyle = hsl(O.hue, 100, li, al * glow); ctx.beginPath();
          for (let j = 0; j <= sub; j++) { const [x, y] = at(t0 + (j / sub) * (1.04 / seg) * Math.PI * 2, f); if (j) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
          ctx.stroke(); }
      }
    }
    for (let k = 0; k < 90 + L.rings * 30; k++) { const t = r() * Math.PI * 2, [x, y] = at(t), d = (r() - 0.5) * ry * 0.22; ctx.fillStyle = hsl(O.hue, 90, 85, 0.25 + r() * 0.5); const z = r() < 0.1 ? 1.6 : 0.8; ctx.fillRect(x + d, y + d, z, z); }
    const [ex, ey] = at(O.e), eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, m * 0.05); eg.addColorStop(0, 'hsla(0,0%,100%,1)'); eg.addColorStop(0.25, hsl(O.hue, 100, 72, 0.85)); eg.addColorStop(1, hsl(O.hue, 100, 55, 0));
    ctx.fillStyle = eg; ctx.beginPath(); ctx.arc(ex, ey, m * 0.05, 0, Math.PI * 2); ctx.fill();
  }
  // the subject: its motif in light at the heart, a glowing silhouette with a hot edge, over a halo
  const paths = p.motif && typeof Path2D === 'function' ? motifPaths(p.motif) : null;
  if (paths) {
    const sz = msz, halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.75);
    halo.addColorStop(0, hsl(p.palette[0], 100, 60, 0.4)); halo.addColorStop(0.5, hsl(p.palette[1], 100, 45, 0.1)); halo.addColorStop(1, hsl(p.palette[1], 100, 40, 0));
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
  }
  ctx.globalCompositeOperation = 'source-over';
  // bloom: the picture, blurred, laid over itself in light
  if (typeof ctx.filter === 'string' && ctx.canvas) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = L.bloom; ctx.filter = 'blur(' + Math.round(m / 22) + 'px)'; ctx.drawImage(ctx.canvas, 0, 0, w, h); ctx.filter = 'none'; ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, m * 0.35, w / 2, h / 2, M * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.6)'); ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

// On the card: the art box (.vc-art) gets the seal as a picture under any painted art (lib/card-forge.js lays its image over it) and over
// Verse's ink plate (lib/card-art.js, kept for where no canvas runs and for the saved SVG). Drawn when the browser is idle, once per key and
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
      if (!box.isConnected || box.classList.contains('has-photo') || box.classList.contains('vc-forged') || box.querySelector(':scope > .vc-seal')) return; // a real picture or a painting arrived while this waited: it is the art
      if ((box.clientWidth || 0) < 120 && tries++ < 10) { setTimeout(go, 120); return; } // the card is still laying out
      const w = Math.max(160, Math.min(720, Math.round(box.clientWidth || 520))), h = Math.max(60, Math.min(400, Math.round(box.clientHeight || 150)));
      const url = sealUrl(sealPlan(key, { kind, hue, rarity, nouns }), w, h); if (!url) return;
      const im = document.createElement('img'); im.className = 'vc-seal'; im.alt = ''; im.decoding = 'async'; im.src = url;
      box.insertBefore(im, box.querySelector(':scope > .vc-forge-img, :scope > .vc-forge-btn')); box.classList.add('vc-sealed');
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 400 }); else setTimeout(go, 0);
  } catch (_) {}
}
