// Verse card art (owner, 2026-10-16: "no art exists yet ... commit to Verse's style: every card needs art"; "Verse is scary like AI is scary, but it's for
// all ages ... Plus it's Halloween, so go extra scary this month"; "Verse cards should have their own magic or Todd McFarlane style art signature").
// The signature is Verse's own and copies no artist, character or logo: heavy black ink on a field tinted with the card's family hue, thick contour
// lines, crosshatch shading, torn-paper edges, chain and cloak line work, ink splatters, and the one motif that makes it Verse: the void looks back
// (eyes opening in the dark, static and glitch tears, a face that is an empty frame, a doorway that is a screen). Scary the way AI is scary, for
// every age: uncanny and storybook-spooky, never gore, weapons, real faces or real tragedy. Every kind has its own plate (a Film is an aperture
// and a strip, a Person a cloaked bust with an empty frame for a face, a Place a door on a horizon ...); a skill, game or miniature is its guide
// glyph inked. The same idea key always draws the same card (a seeded hash of the key); rarity changes the ink weight and the foil, never the
// subject. In October (or ?season=halloween) the same art adds fog, bats, a candle-flicker glow, more eyes and a pumpkin-orange rim.
// Pure: artSvg() returns one SVG string (viewBox set, no script, no link, no image file, no text) that works inline and as a standalone image.
import { motifsFor, motifSvg } from './card-subject.js';
import { seedOf, glyphSvg } from './guide.js';

const INK = '#0a0a10';
const F = (x) => String(Math.abs(x) < 10 ? Math.round(x * 10) / 10 : Math.round(x));
const esc = (s) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** the rarity's ink: weight, colour, how much the line wobbles and its default density, plus the foil; only these change between rarities, never the subject.
 *  Asked by Verse: the ink follows the evidence rating, a proven skill (Mythic) is sharp and high-contrast, an experiment (Common) a light charcoal sketch.
 *  The plate's opacity reads the CSS custom property --ink-density (0..1) from the svg or any ancestor, so a mini can drive it live (field divergence, curl);
 *  with none set, `dens` is the rarity's own. */
export const RARITY_LOOK = {
  mythic: { name: 'Mythic', ink: '#000000', wob: 0.6, dens: 1, w: 1.4, foil: ['#ffb347', '#ff9ad5', '#ffd27a', '#7affd9'], a: 0.17, stars: 7 },
  rare: { name: 'Rare', ink: '#05050b', wob: 2, dens: 0.88, w: 1.25, foil: ['#f1dc8a', '#f6e7a6', '#fff4c4'], a: 0.18, stars: 3 },
  uncommon: { name: 'Uncommon', ink: '#1b1b24', wob: 3, dens: 0.72, w: 1.12, foil: ['#e8edf4', '#cfd8e6', '#f2f5fa'], a: 0.1, stars: 0 },
  common: { name: 'Common', ink: '#44444f', wob: 5.5, dens: 0.5, w: 0.8, foil: null, a: 0, stars: 0 },
};
/** 'mythic' | 'rare' | 'uncommon' | 'common' from a rarity name, an evidence tier word or the frame's rarity object */
export function rarityKey(r) {
  const w = String(r && typeof r === 'object' ? r.name : r || '').toLowerCase();
  return ({ proven: 'mythic', checked: 'rare', tested: 'uncommon', experiment: 'common' })[w] || (w in RARITY_LOOK ? w : 'common');
}
/** the kinds that have a plate of their own */
export const KINDS = ['Film', 'Show', 'Album', 'Song', 'Band', 'Game', 'Book', 'Person', 'Place', 'Creature', 'Organisation', 'Event', 'Idea', 'Answer', 'Skill', 'Miniature'];
const KIND_WORD = { organization: 'Organisation', movie: 'Film', series: 'Show', concept: 'Idea', character: 'Idea', episode: 'Show', myth: 'Idea', food: 'Creature', vehicle: 'Idea', team: 'Organisation' };
/** the first kind a type line names ("Film · Song — 1965" is Film); unknown words are an Idea */
export function kindWord(s) {
  const w = String(s || '').split(/\s*[·—]\s*/)[0].trim().toLowerCase();
  return KINDS.find((k) => k.toLowerCase() === w) || KIND_WORD[w] || 'Idea';
}
/** 'halloween' in October (month 0-11 === 9) or with ?season=halloween; ?season=off turns it off. Pure. */
/** a subject the October skin suits. */
export const SPOOKY = /\b(?:hallowe+n|horror|haunt\w*|ghosts?|ghouls?|witch\w*|vampires?|zombies?|monsters?|spooky|scary|occult|pumpkins?|graves?|graveyard|curse[ds]?|demons?|skeletons?|undead|creepy)\b/i;
export function seasonOf(month, search = '') {
  const m = /[?&]season=([a-z]+)/i.exec(String(search || ''));
  if (m) return m[1].toLowerCase() === 'halloween' ? 'halloween' : 'off';
  return month === 9 ? 'halloween' : 'off';
}

// ---- drawing helpers (all in the plate's 320 x 200 space unless a function says otherwise) ----
const pt = (x, y) => F(x) + ' ' + F(y);
/** a glowing almond eye with a slit pupil, half-width s */
function eye(X, x, y, s, rot = 0) {
  const h = s * 0.62;
  return '<g transform="translate(' + pt(x, y) + ')' + (rot ? 'rotate(' + F(rot) + ')' : '') + '"><path d="M' + F(-s) + ' 0Q0 ' + F(-h * 1.7) + ' ' + F(s) + ' 0Q0 ' + F(h * 1.7) + ' ' + F(-s) + ' 0Z" fill="' + X.G + '" stroke="' + INK + '" stroke-width="' + F(Math.max(0.8, s * 0.17 * X.sw)) + '"/><ellipse rx="' + F(s * 0.17) + '" ry="' + F(h * 0.78) + '" fill="' + INK + '" stroke="none"/></g>';
}
/** a pair of eyes opening in the dark: a soft halo, two glowing almonds (no outline), slit pupils */
function darkEyes(X, x, y, s, tilt) {
  X.eyeDef = true;
  let o = '<circle cx="' + F(x) + '" cy="' + F(y) + '" r="' + F(s * 3.6) + '" fill="url(#' + X.id + 'g)"/>';
  for (const d of [-1, 1]) o += '<use href="#' + X.id + 'e" transform="translate(' + pt(x + d * s * 1.7, y + d * tilt * s * 0.3) + ')rotate(' + F(d * tilt * 14) + ')scale(' + F(s) + ')"/>';
  return o;
}
/** parallel hatch lines over a box, clipped by clip id: gap apart at angle deg, each a 'l' step so the path stays short */
function hatch(box, clip, gap, deg, wd, op) {
  const [x0, y0, x1, y1] = box, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, D = Math.hypot(x1 - x0, y1 - y0) / 2, a = deg * Math.PI / 180;
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx; let d = '';
  const span = (p, q, lo, hi) => { if (Math.abs(q) < 1e-6) return p >= lo && p <= hi ? [-1e9, 1e9] : null; const t1 = (lo - p) / q, t2 = (hi - p) / q; return [Math.min(t1, t2), Math.max(t1, t2)]; };
  for (let k = -D; k <= D; k += gap) {
    const px = cx + nx * k, py = cy + ny * k, sx = span(px, dx, x0, x1), sy = span(py, dy, y0, y1); if (!sx || !sy) continue;
    const t0 = Math.max(sx[0], sy[0]), t1 = Math.min(sx[1], sy[1]); if (t1 - t0 < 2) continue;
    d += 'M' + Math.round(px + dx * t0) + ' ' + Math.round(py + dy * t0) + 'l' + Math.round(dx * (t1 - t0)) + ' ' + Math.round(dy * (t1 - t0));
  }
  return '<path d="' + d + '" clip-path="url(#' + clip + ')" stroke-width="' + F(wd) + '" opacity="' + op + '" fill="none"/>';
}
/** an ink splatter: a blob, satellites and a drip */
function splat(X, x, y, R) {
  let s = '<circle cx="' + F(x) + '" cy="' + F(y) + '" r="' + F(R) + '"/>';
  const n = X.I(4, 8);
  for (let i = 0; i < n; i++) { const a = X.r() * 6.28, d = R * (1.3 + X.r() * 2.2), rr = R * (0.1 + X.r() * 0.38); s += '<circle cx="' + F(x + Math.cos(a) * d) + '" cy="' + F(y + Math.sin(a) * d) + '" r="' + F(rr) + '"/>'; }
  return '<g fill="' + INK + '" stroke="none">' + s + '</g><path d="M' + pt(x + R * 0.2, y) + 'v' + F(R * (1.5 + X.r() * 2)) + '" stroke="' + INK + '" stroke-width="' + F(R * 0.28) + '" stroke-linecap="round"/>';
}
/** chain links along a quadratic curve, alternately face-on and edge-on */
function chain(X, x0, y0, cx, cy, x1, y1, n, sz, col) {
  let o = '';
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t, x = u * u * x0 + 2 * u * t * cx + t * t * x1, y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx), dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy), a = Math.atan2(dy, dx) * 180 / Math.PI;
    o += '<ellipse cx="' + F(x) + '" cy="' + F(y) + '" rx="' + F(i % 2 ? sz * 0.55 : sz) + '" ry="' + F(i % 2 ? sz * 0.4 : sz * 0.62) + '" transform="rotate(' + F(a) + ' ' + pt(x, y) + ')" stroke-width="' + F(sz * 0.34 * X.sw) + '"/>';
  }
  return '<g fill="none"' + (col ? ' stroke="' + col + '"' : '') + '>' + o + '</g>';
}
function gear(cx, cy, R, n, rot) {
  const pts = [], t = Math.PI / n;
  for (let i = 0; i < n; i++) { const a = rot + i * 2 * t; for (const [da, rr] of [[-0.88, R - 9], [-0.5, R], [0.5, R], [0.88, R - 9]]) pts.push(pt(cx + Math.cos(a + da * t) * rr, cy + Math.sin(a + da * t) * rr)); }
  return 'M' + pts.join('L') + 'Z';
}
function burst(cx, cy, R, r, n, jit, rng0) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, rr = (i % 2 ? r : R) * (1 + (rng0() - 0.5) * jit); pts.push(pt(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)); }
  return 'M' + pts.join('L') + 'Z';
}

// ---- the plates: what each kind draws ----
const PLATES = {
  Film(X) {
    const { P, L, D } = X; let s = '<g transform="rotate(-8 160 160)"><rect x="-30" y="132" width="380" height="48" fill="' + INK + '"/>';
    let sp = ''; for (let i = 0; i < 24; i++) sp += 'M' + (-24 + i * 16) + ' 136h8v6h-8zM' + (-24 + i * 16) + ' 170h8v6h-8z';
    s += '<path d="' + sp + '" fill="' + P + '" stroke="none"/>';
    const lit = X.I(0, 5);
    for (let i = 0; i < 6; i++) s += '<rect x="' + (-22 + i * 64) + '" y="146" width="56" height="20" fill="' + (i === lit ? X.G : D) + '" stroke="' + L + '" stroke-width="1"/>' + (i === lit ? '' : i % 2 ? eye(X, -22 + i * 64 + 28, 156, 7) : '');
    s += '</g>';
    const cx = 160, cy = 86, n = 7, rot = X.R(0, 1), V = [];
    for (let k = 0; k < n; k++) { const a = rot + k * 2 * Math.PI / n; V.push([cx + Math.cos(a) * 24, cy + Math.sin(a) * 24]); }
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="72" fill="' + INK + '"/><circle cx="' + cx + '" cy="' + cy + '" r="64" fill="' + P + '"/><circle cx="' + cx + '" cy="' + cy + '" r="56" fill="' + L + '"/>';
    s += '<clipPath id="' + X.id + 'a"><circle cx="' + cx + '" cy="' + cy + '" r="56"/></clipPath><path clip-path="url(#' + X.id + 'a)" d="';
    for (let k = 0; k < n; k++) { const a = V[k], b = V[(k + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); s += 'M' + pt(b[0], b[1]) + 'L' + pt(a[0] - dx / l * 90, a[1] - dy / l * 90); }
    s += '" stroke-width="' + F(2.2 * X.sw) + '"/>' + hatch([cx - 56, cy - 56, cx + 56, cy + 56], X.id + 'a', 5, 38, 1, 0.35);
    s += '<path d="M' + V.map((v) => pt(v[0], v[1])).join('L') + 'Z" fill="' + INK + '"/>' + eye(X, cx, cy, 21);
    return s;
  },
  Show(X) {
    const { P, L, D } = X; let s = '';
    s += '<path d="M160 58L120 12M160 58L204 18" stroke-width="' + F(2.6 * X.sw) + '"/>' + eye(X, 120, 12, 8, -20) + eye(X, 205, 17, 8, 15);
    s += '<path d="M104 168l-6 22M214 168l6 22" stroke-width="' + F(5 * X.sw) + '"/><rect x="76" y="54" width="168" height="118" rx="16" fill="' + INK + '"/><rect x="92" y="66" width="104" height="92" rx="12" fill="' + L + '" stroke-width="' + F(1.6 * X.sw) + '"/>';
    s += '<clipPath id="' + X.id + 'a"><rect x="92" y="66" width="104" height="92" rx="12"/></clipPath><rect x="92" y="66" width="104" height="92" filter="url(#' + X.id + 'n)" clip-path="url(#' + X.id + 'a)" opacity=".62" stroke="none"/>';
    s += '<path d="M120 158V112Q120 84 144 84Q168 84 168 112V158Z" fill="' + INK + '" clip-path="url(#' + X.id + 'a)"/>' + darkEyes(X, 144, 108, 5.5, 0) + hatch([92, 66, 196, 158], X.id + 'a', 6, -30, 1, 0.25);
    s += '<path d="M92 112h104M92 130h104" stroke="' + P + '" stroke-width="3" opacity=".55" clip-path="url(#' + X.id + 'a)"/>';
    s += '<circle cx="220" cy="84" r="9" fill="' + P + '"/><circle cx="220" cy="112" r="9" fill="' + P + '"/><path d="M220 80v8M214 112h12" stroke-width="1.6"/><path d="M220 136v22" stroke-width="3"/>';
    s += '<path d="M92 66l30 14" stroke="' + P + '" stroke-width="2" opacity=".6"/>' + chain(X, 244, 150, 280, 168, 300, 120, 7, 4.5);
    return s;
  },
  Album(X) { return PLATES.Song(X, true); },
  Song(X, album) {
    const { P, L, D } = X; let s = '';
    if (album) s += '<rect x="40" y="44" width="126" height="126" fill="' + P + '" transform="rotate(-6 100 100)"/><rect x="48" y="52" width="110" height="110" fill="' + D + '" transform="rotate(-6 100 100)"/>' + eye(X, 100, 106, 26, -6);
    const cx = album ? 188 : 160, cy = album ? 84 : 78, R = album ? 62 : 56;
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + R + '" fill="' + INK + '"/>';
    let g = ''; for (let r = 24; r < R - 3; r += 5) g += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>';
    s += '<g stroke="' + L + '" stroke-width=".7" opacity=".45" fill="none">' + g + '</g><path d="M' + cx + ' ' + cy + 'L' + pt(cx - R * 0.8, cy - R * 0.6) + 'A' + R + ' ' + R + ' 0 0 1 ' + pt(cx - R * 0.2, cy - R * 0.97) + 'ZM' + cx + ' ' + cy + 'L' + pt(cx + R * 0.8, cy + R * 0.6) + 'A' + R + ' ' + R + ' 0 0 1 ' + pt(cx + R * 0.2, cy + R * 0.97) + 'Z" fill="' + P + '" opacity=".14" stroke="none"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="21" fill="' + L + '"/>' + eye(X, cx, cy, 17);
    const my = album ? 172 : 160, mx = album ? 190 : 160, mw = album ? 80 : 118, mh = album ? 18 : 26;
    s += '<path d="M' + pt(mx - mw - 8, my - 8) + 'Q' + pt(mx, my - mh * 2.1) + ' ' + pt(mx + mw + 8, my - 8) + 'Q' + pt(mx, my + mh * 2.1) + ' ' + pt(mx - mw - 8, my - 8) + 'Z" fill="' + INK + '"/>';
    let bars = ''; for (let x = -mw; x <= mw; x += 6) { const u = x / mw, hh = mh * Math.pow(1 - u * u, 0.8) * (0.45 + X.r() * 0.7); bars += 'M' + F(mx + x) + ' ' + F(my - 8 - hh) + 'v' + F(hh * 2); }
    s += '<path d="' + bars + '" stroke="' + X.G + '" stroke-width="3" fill="none"/><path d="M' + pt(mx - mw - 8, my - 8) + 'q-8 -6 -12 -14M' + pt(mx + mw + 8, my - 8) + 'q8 -6 12 -14" stroke-width="' + F(3 * X.sw) + '"/>';
    if (!album) s += '<g fill="' + INK + '" stroke="none"><ellipse cx="' + (cx + 80) + '" cy="56" rx="8" ry="6" transform="rotate(-20 ' + (cx + 80) + ' 56)"/><path d="M' + (cx + 87) + ' 54V16l16 8"/></g>';
    return s;
  },
  Band(X) {
    const { P, L, D } = X; let s = '';
    s += '<path d="M10 0L150 118L100 0ZM310 0L170 118L220 0Z" fill="' + P + '" opacity=".22" stroke="none"/>';
    const amp = (x, w) => {
      let a = '<rect x="' + x + '" y="112" width="' + w + '" height="68" fill="' + INK + '"/><rect x="' + (x + 6) + '" y="62" width="' + (w - 12) + '" height="48" fill="' + INK + '"/>';
      for (const [cy, r] of [[146, 20], [86, 15]]) { const cx = x + w / 2; a += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + D + '" stroke="' + L + '" stroke-width="1.4"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.6) + '" fill="none" stroke="' + L + '" stroke-width=".8"/><circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.22) + '" fill="' + INK + '"/>'; }
      return a + '<path d="M' + (x + 6) + ' 118h' + (w - 12) + '" stroke="' + L + '" stroke-width="1" opacity=".5"/>';
    };
    s += amp(20, 66) + amp(234, 66) + '<path d="M160 70V176M160 176l-24 14M160 176l24 14" stroke-width="' + F(3 * X.sw) + '"/><circle cx="160" cy="62" r="12" fill="' + P + '"/><path d="M150 58h20M149 63h22" stroke-width="1.2" opacity=".6"/><path d="M160 74l0 8" stroke-width="5"/>';
    s += '<path d="M0 200V176Q40 164 80 176T160 176T240 176T320 176V200Z" fill="' + INK + '" stroke="none"/>';
    for (let i = 0; i < 9; i++) { const x = 20 + i * 35 + X.R(-4, 4), y = 184 + (i % 3) * 4, r = 14 + X.R(0, 5); s += '<path d="M' + pt(x - r * 1.6, 210) + 'Q' + pt(x - r, y + r * 0.2) + ' ' + pt(x - r * 0.9, y - r * 0.2) + 'A' + F(r) + ' ' + F(r) + ' 0 1 1 ' + pt(x + r * 0.9, y - r * 0.2) + 'Q' + pt(x + r, y + r * 0.2) + ' ' + pt(x + r * 1.6, 210) + 'Z" fill="' + INK + '" stroke="none"/>' + darkEyes(X, x, y - 2, 2.6, 0.5).replace(/<circle[^>]*>/, ''); }
    return s;
  },
  Game(X) {
    const { P, L, D } = X; let s = '';
    const top = [[64, 118], [256, 118]], bot = [[16, 192], [304, 192]];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const q = (cc, rr) => { const t = rr / 4, xl = top[0][0] + (bot[0][0] - top[0][0]) * t, xr = top[1][0] + (bot[1][0] - top[1][0]) * t; return pt(xl + (xr - xl) * cc / 6, 118 + 74 * t); };
      s += '<path d="M' + q(c, r) + 'L' + q(c + 1, r) + 'L' + q(c + 1, r + 1) + 'L' + q(c, r + 1) + 'Z" fill="' + ((r + c) % 2 ? D : P) + '" stroke-width="' + F(1.4 * X.sw) + '"/>';
    }
    s += '<ellipse cx="148" cy="156" rx="40" ry="9" fill="' + INK + '" opacity=".6" stroke="none"/>';
    s += '<path d="M126 154Q128 150 134 148Q142 128 140 104Q124 98 130 90H166Q172 98 156 104Q154 128 162 148Q168 150 170 154Q148 162 126 154Z" fill="' + P + '"/><ellipse cx="148" cy="92" rx="21" ry="5" fill="' + L + '"/><circle cx="148" cy="68" r="26" fill="' + P + '"/>';
    s += '<clipPath id="' + X.id + 'a"><circle cx="148" cy="68" r="26"/></clipPath><clipPath id="' + X.id + 'b"><path d="M126 154Q128 150 134 148Q142 128 140 104H156Q154 128 162 148Q168 150 170 154Q148 162 126 154Z"/></clipPath>' + hatch([122, 40, 174, 96], X.id + 'a', 4, 50, 1.2, 0.55) + hatch([126, 100, 172, 160], X.id + 'b', 4, 50, 1.2, 0.55);
    s += '<circle cx="148" cy="68" r="26" fill="none"/>' + eye(X, 142, 68, 17) + '<path d="M166 56q6 4 6 14" stroke="' + P + '" stroke-width="3" opacity=".9"/>';
    const die = (x, y, z, rot, withEye) => {
      let d = '<g transform="translate(' + x + ' ' + y + ')rotate(' + rot + ')scale(' + z + ')"><path d="M0 -26L24 -13L0 0L-24 -13Z" fill="' + P + '"/><path d="M-24 -13L0 0V30L-24 17Z" fill="' + L + '"/><path d="M0 0L24 -13V17L0 30Z" fill="' + D + '"/>';
      d += '<ellipse cx="0" cy="-13" rx="5" ry="2.8" fill="' + INK + '" stroke="none"/><ellipse cx="-11" cy="-19" rx="3" ry="1.8" fill="' + INK + '" stroke="none"/><ellipse cx="11" cy="-7" rx="3" ry="1.8" fill="' + INK + '" stroke="none"/><ellipse cx="-12" cy="13" rx="2.6" ry="3" fill="' + INK + '" stroke="none"/><ellipse cx="-12" cy="24" rx="2.6" ry="3" fill="' + INK + '" stroke="none"/>';
      return d + (withEye ? eye(X, 12, 12, 7, 10) : '') + '</g>';
    };
    return s + die(248, 122, 1, 0, true) + die(52, 150, 0.7, -14, false);
  },
  Book(X) {
    const { P, L, D } = X; let s = '';
    s += '<path d="M160 70C130 54 84 52 30 62L26 172C84 160 130 164 160 180C190 164 236 160 294 172L290 62C236 52 190 54 160 70Z" fill="' + INK + '"/>';
    s += '<path d="M160 64C130 48 84 46 38 56V160C84 150 130 154 160 170C190 154 236 150 282 160V56C236 46 190 48 160 64Z" fill="' + P + '"/><path d="M160 64V170" stroke-width="' + F(3 * X.sw) + '"/>';
    s += '<clipPath id="' + X.id + 'a"><path d="M160 64C150 54 140 50 128 50L128 160C140 154 150 160 160 170ZM160 64C170 54 180 50 192 50L192 160C180 154 170 160 160 170Z"/></clipPath>' + hatch([128, 50, 192, 170], X.id + 'a', 3, 90, 1, 0.45);
    let ln = '', eyes = '', k = 0;
    for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
      const y = 70 + i * 12, x0 = side < 0 ? 52 : 174, x1 = side < 0 ? 146 : 268, sag = (side < 0 ? 1 : 1) * (6 - i) * 0.0;
      if (k < 6 && X.r() < 0.28) { const ex = x0 + 20 + X.r() * (x1 - x0 - 40); ln += 'M' + pt(x0, y + sag) + 'H' + F(ex - 10) + 'M' + pt(ex + 10, y + sag) + 'H' + x1; eyes += eye(X, ex, y + sag, 8, X.R(-8, 8)); k++; } else ln += 'M' + pt(x0, y + sag) + 'H' + F(x1 - X.R(0, 36));
    }
    s += '<path d="' + ln + '" stroke-width="' + F(1.7 * X.sw) + '" opacity=".85"/>' + eyes;
    s += '<path d="M176 170v28l8-6 8 6v-24" fill="' + D + '"/>';
    for (const [x, y, c] of [[100, 54, -28], [160, 62, 4], [224, 52, 30]]) s += '<path d="M' + pt(x, y) + 'C' + pt(x + c, y - 16) + ' ' + pt(x - c, y - 28) + ' ' + pt(x + c * 0.5, y - 42) + '" stroke-width="' + F(4.5 * X.sw) + '"/>';
    s += eye(X, 106, 12, 6, -10) + eye(X, 168, 18, 7) + eye(X, 232, 12, 6, 10);
    return s;
  },
  Person(X) {
    const { P, L, D } = X; let s = '';
    s += '<circle cx="160" cy="96" r="88" fill="' + P + '" opacity=".5" stroke="none"/><clipPath id="' + X.id + 'a"><circle cx="160" cy="96" r="88"/></clipPath>' + hatch([72, 8, 248, 184], X.id + 'a', 6, 35, 1.1, 0.4);
    s += '<path d="M24 204C34 150 90 140 118 128H202C230 140 286 150 296 204Z" fill="' + INK + '"/><path d="M160 20C108 20 92 78 100 126C116 142 204 142 220 126C228 78 212 20 160 20Z" fill="' + INK + '"/>';
    s += '<path d="M104 112C100 74 118 36 160 28M216 112C220 74 202 36 160 28M128 140C116 164 104 184 84 204M160 142V204M192 140C204 164 216 184 236 204M144 140C138 168 130 186 118 204M176 140C182 168 190 186 202 204" stroke="' + L + '" stroke-width="' + F(1.5) + '" opacity=".75"/>';
    s += '<rect x="122" y="42" width="76" height="92" rx="6" fill="' + X.V + '" stroke="' + P + '" stroke-width="' + F(5 * X.sw) + '"/><rect x="128" y="48" width="64" height="80" rx="3" fill="none" stroke="' + L + '" stroke-width="1.4"/>';
    for (const [x, y] of [[122, 42], [198, 42], [122, 134], [198, 134]]) s += '<circle cx="' + x + '" cy="' + y + '" r="4.5" fill="' + L + '" stroke-width="1.4"/>';
    s += '<clipPath id="' + X.id + 'b"><rect x="128" y="48" width="64" height="80"/></clipPath><rect x="128" y="48" width="64" height="80" filter="url(#' + X.id + 'n)" opacity=".28" clip-path="url(#' + X.id + 'b)" stroke="none"/>' + darkEyes(X, 160, 92, 4.2, 0);
    s += chain(X, 112, 142, 160, 196, 208, 142, 11, 6.5, L) + '<path d="M160 168l8 8-8 10-8-10Z" fill="' + X.G + '" stroke-width="1.6"/>';
    return s;
  },
  Place(X) {
    const { P, L, D } = X; let s = '', hz = 118;
    s += '<circle cx="' + X.I(220, 260) + '" cy="52" r="30" fill="' + P + '"/><circle cx="' + X.I(205, 245) + '" cy="42" r="6" fill="' + L + '" stroke="none"/>';
    s += '<rect x="-4" y="' + hz + '" width="328" height="90" fill="' + INK + '"/>';
    let g = ''; for (let x = -240; x <= 560; x += 48) g += 'M160 ' + hz + 'L' + x + ' 204'; for (let k = 1; k <= 6; k++) g += 'M0 ' + F(hz + 86 * Math.pow(k / 6, 1.7)) + 'H320';
    s += '<path d="' + g + '" stroke="' + L + '" stroke-width="1" opacity=".55" fill="none"/>';
    let h = 'M-4 ' + hz; for (let x = -4; x <= 324; x += 16) h += 'L' + x + ' ' + F(hz - 4 - X.r() * 22 * (x % 48 === 0 ? 1.6 : 1)); s += '<path d="' + h + 'L324 ' + hz + 'Z" fill="' + INK + '"/>';
    s += '<path d="M112 204C140 176 204 168 156 130L160 ' + hz + 'L164 130C220 170 190 190 218 204Z" fill="' + P + '"/>';
    s += '<path d="M146 ' + hz + 'V86Q160 76 174 86V' + hz + 'Z" fill="' + INK + '"/><path d="M151 ' + hz + 'V90Q160 83 169 90V' + hz + 'Z" fill="' + X.G + '" stroke-width="1"/><path d="M151 99h18M151 106h18M151 113h18" stroke="' + INK + '" stroke-width=".8" opacity=".5"/>' + eye(X, 160, 101, 5.5);
    s += '<path d="M174 ' + hz + 'L240 ' + (hz + 28) + 'L226 ' + (hz + 34) + 'Z" fill="' + X.G + '" opacity=".22" stroke="none"/>';
    s += '<path d="M44 190L48 130M48 154L30 138M48 144L66 124M47 132L36 116M60 128L72 114" stroke-width="' + F(4 * X.sw) + '"/><path d="M270 196L268 144M268 164L284 150M268 154L254 138" stroke-width="' + F(3.4 * X.sw) + '"/>';
    return s;
  },
  Creature(X) {
    const { P, L, D } = X; let s = '', cx = 160, cy = 100;
    s += '<path d="M24 100Q160 -16 296 100Q160 216 24 100Z" fill="' + P + '"/><clipPath id="' + X.id + 'a"><path d="M24 100Q160 -16 296 100Q160 216 24 100Z"/></clipPath><rect x="0" y="0" width="320" height="64" fill="' + INK + '" opacity=".0"/>' + hatch([24, 20, 296, 70], X.id + 'a', 4, 20, 1.2, 0.6) + hatch([24, 140, 296, 184], X.id + 'a', 5, -20, 1, 0.4);
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="46" fill="hsl(' + X.h + ' 62% 52%)"/><circle cx="' + cx + '" cy="' + cy + '" r="40" fill="none" stroke="' + X.G + '" stroke-width="3" opacity=".8"/>';
    const rot = X.R(0, 6.28); let sp = ''; for (let i = 0; i <= 64; i++) { const t = i / 64, a = t * Math.PI * 7 + rot, r = 2 + t * 36; sp += (i ? 'L' : 'M') + Math.round(cx + Math.cos(a) * r) + ' ' + Math.round(cy + Math.sin(a) * r); }
    s += '<path d="' + sp + '" stroke-width="' + F(3.2 * X.sw) + '"/><circle cx="' + cx + '" cy="' + cy + '" r="7" fill="' + INK + '"/><circle cx="' + (cx - 14) + '" cy="' + (cy - 16) + '" r="6" fill="' + P + '" stroke="none"/>';
    s += '<path d="M24 100Q160 -16 296 100Q160 216 24 100Z" fill="none"/>';
    let l = ''; for (let i = 1; i < 12; i++) { const t = i / 12, u = 1 - t, x = u * u * 24 + 2 * u * t * 160 + t * t * 296, y = u * u * 100 + 2 * u * t * -16 + t * t * 100, nx = (x - 160) / 160 * 0.5, ny = -1, d = 12 + X.r() * 12; l += 'M' + pt(x - 5, y + 2) + 'L' + pt(x + nx * d * 1.6 + X.R(-3, 3), y + ny * d) + 'L' + pt(x + 5, y + 2); const y2 = 200 - y; if (i % 2) l += 'M' + pt(x - 4, y2 - 2) + 'L' + pt(x + nx * d, y2 + d * 0.9) + 'L' + pt(x + 4, y2 - 2); }
    s += '<path d="' + l + '" fill="' + INK + '"/><path d="M24 100C-4 118 2 150 18 164M296 100C324 120 318 150 302 166" stroke-width="' + F(4 * X.sw) + '"/>' + eye(X, 18, 168, 6, 20) + eye(X, 302, 170, 6, -20);
    return s;
  },
  Organisation(X) {
    const { P, L, D } = X; let s = '';
    s += '<path d="M104 52L216 52" stroke="none"/><path d="M160 26L36 4L36 56ZM160 26L284 4L284 56Z" fill="' + X.G + '" opacity=".24" stroke="none"/>';
    s += gearAt(X, 74, 148, 44, 10, 0.2, P) + gearAt(X, 252, 132, 34, 8, 0.1, L);
    s += '<path d="M132 192L142 60H178L188 192Z" fill="' + INK + '"/><path d="M138 60V46H146V52H156V46H164V52H174V46H182V60Z" fill="' + INK + '"/><path d="M146 40H174V54H146Z" fill="' + D + '"/>';
    let wl = '', wd = ''; for (let i = 0; i < 7; i++) for (const dx of [-9, 9]) (X.r() < 0.42 ? (wl += 'M' + (157 + dx) + ' ' + (74 + i * 16) + 'h6v9h-6z') : (wd += 'M' + (157 + dx) + ' ' + (74 + i * 16) + 'h6v9h-6z'));
    s += '<path d="' + wl + '" fill="' + X.G + '" stroke="none"/><path d="' + wd + '" fill="' + D + '" stroke="none"/>';
    s += eye(X, 160, 26, 17) + chain(X, 138, 60, 104, 100, 100, 118, 5, 5) + chain(X, 182, 60, 224, 90, 246, 108, 5, 5);
    s += '<path d="M0 192H320" stroke-width="' + F(3 * X.sw) + '"/>';
    return s;
  },
  Event(X) {
    const { P, L, D } = X; let s = '', cx = 160, cy = 100;
    let sp = ''; for (let i = 0; i < 26; i++) { const a = X.r() * 6.28, r0 = 98 + X.r() * 10, r1 = r0 + 14 + X.r() * 34; sp += 'M' + pt(cx + Math.cos(a) * r0 * 1.25, cy + Math.sin(a) * r0 * 0.9) + 'L' + pt(cx + Math.cos(a) * r1 * 1.4, cy + Math.sin(a) * r1 * 1.0); }
    s += '<path d="' + sp + '" stroke-width="' + F(2.2 * X.sw) + '"/>';
    s += '<path transform="translate(7 7)" d="' + burst(cx, cy, 96, 52, 11, 0.35, X.r) + '" fill="' + INK + '" stroke="none"/>';
    const b = burst(cx, cy, 96, 52, 11, 0.35, X.r); s += '<path d="' + b + '" fill="' + P + '"/>';
    s += '<clipPath id="' + X.id + 'a"><path d="' + b + '"/></clipPath>' + hatch([60, 100, 260, 200], X.id + 'a', 4, 45, 1.4, 0.55) + hatch([60, 0, 260, 100], X.id + 'a', 7, -45, 1, 0.3);
    s += '<path d="' + burst(cx, cy, 64, 34, 11, 0.3, X.r) + '" fill="' + L + '"/><path d="' + burst(cx, cy, 42, 24, 9, 0.3, X.r) + '" fill="' + INK + '"/>';
    s += eye(X, cx, cy, 20) + eye(X, cx - 26, cy + 12, 6, 20) + eye(X, cx + 26, cy + 12, 6, -20);
    for (let i = 0; i < 6; i++) { const a = X.r() * 6.28, r = 112 + X.r() * 40, x = cx + Math.cos(a) * r * 1.3, y = cy + Math.sin(a) * r * 0.78, z = 4 + X.r() * 6; s += '<path d="M' + pt(x, y - z) + 'L' + pt(x + z, y + z * 0.8) + 'L' + pt(x - z, y + z * 0.6) + 'Z" fill="' + INK + '" stroke="none"/>'; }
    return s;
  },
  Idea(X) {
    const { P, L, D } = X; let s = '', cx = 160, cy = 100;
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="92" fill="' + P + '" opacity=".4" stroke="none"/><circle cx="' + cx + '" cy="' + cy + '" r="88"/><circle cx="' + cx + '" cy="' + cy + '" r="70" stroke-width="' + F(1.6 * X.sw) + '"/>';
    let r = ''; const n = 28; for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n, k = X.r(); r += 'M' + pt(cx + Math.cos(a) * 73, cy + Math.sin(a) * 73); r += k < 0.4 ? 'L' + pt(cx + Math.cos(a) * 85, cy + Math.sin(a) * 85) : k < 0.75 ? 'L' + pt(cx + Math.cos(a + 0.05) * 80, cy + Math.sin(a + 0.05) * 80) + 'L' + pt(cx + Math.cos(a - 0.05) * 85, cy + Math.sin(a - 0.05) * 85) : 'M' + pt(cx + Math.cos(a) * 79, cy + Math.sin(a) * 79) + 'l.1.1'; }
    s += '<path d="' + r + '" stroke-width="' + F(2.6 * X.sw) + '"/>';
    const tri = (rad, a0) => 'M' + [0, 1, 2].map((i) => pt(cx + Math.cos(a0 + i * 2.0944) * rad, cy + Math.sin(a0 + i * 2.0944) * rad)).join('L') + 'Z';
    s += '<path d="' + tri(66, -1.5708) + '" fill="' + L + '"/><path d="' + tri(66, 1.5708) + '" fill="none" stroke-width="' + F(1.8 * X.sw) + '"/><clipPath id="' + X.id + 'a"><path d="' + tri(66, -1.5708) + '"/></clipPath>' + hatch([90, 40, 230, 160], X.id + 'a', 4, 50, 1.2, 0.5);
    s += '<circle cx="' + cx + '" cy="' + (cy + 6) + '" r="30" fill="' + INK + '"/>' + eye(X, cx, cy + 6, 28);
    for (let i = 0; i < 5; i++) { const a = X.r() * 6.28; s += '<circle cx="' + F(cx + Math.cos(a) * 79) + '" cy="' + F(cy + Math.sin(a) * 79) + '" r="5" fill="' + INK + '"/><circle cx="' + F(cx + Math.cos(a) * 79) + '" cy="' + F(cy + Math.sin(a) * 79) + '" r="1.8" fill="' + X.G + '" stroke="none"/>'; }
    return s;
  },
  Answer(X) {
    const { P, L, D } = X; let s = '';
    s += '<path d="M160 100L20 20M160 100L300 24M160 100L10 120M160 100L310 130" stroke="' + P + '" stroke-width="10" opacity=".28" stroke-linecap="butt"/>';
    s += '<path d="M104 196V84Q104 28 160 28Q216 28 216 84V196Z" fill="' + P + '"/><path d="M114 196V86Q114 38 160 38Q206 38 206 86V196Z" fill="' + INK + '"/>';
    s += '<clipPath id="' + X.id + 'a"><path d="M114 196V86Q114 38 160 38Q206 38 206 86V196Z"/></clipPath>' + hatch([114, 38, 206, 196], X.id + 'a', 6, 60, 1, 0.2);
    s += '<path d="M114 70H206M114 150H206" stroke="' + D + '" stroke-width="5"/><circle cx="128" cy="70" r="3" fill="' + P + '" stroke="none"/><circle cx="192" cy="70" r="3" fill="' + P + '" stroke="none"/><circle cx="128" cy="150" r="3" fill="' + P + '" stroke="none"/><circle cx="192" cy="150" r="3" fill="' + P + '" stroke="none"/>';
    s += '<circle cx="160" cy="104" r="22" fill="' + X.G + '"/><path d="M150 118L160 150L170 118Z" fill="' + X.G + '"/>' + eye(X, 160, 102, 15);
    s += '<path d="M96 196H224" stroke-width="' + F(4 * X.sw) + '"/>' + chain(X, 104, 90, 76, 120, 70, 160, 6, 5);
    return s;
  },
  Skill(X) {
    const g = glyphSvg({ chapter: X.chapter || 'index', name: X.name || X.key, kind: 'skill' }, 88), inner = (/^<svg[^>]*>([\s\S]*)<\/svg>$/.exec(g) || [0, ''])[1].replace(/<text[\s\S]*?<\/text>/g, '');
    const { P, L, D } = X; let s = '';
    s += '<circle cx="160" cy="98" r="88" fill="' + L + '" opacity=".35"/><circle cx="160" cy="98" r="88"/><circle cx="160" cy="98" r="80" stroke-width="' + F(1.3 * X.sw) + '"/>';
    X.defs.push('<g id="' + X.id + 'y">' + inner + '</g>');
    const gu = (dx, dy, c) => '<use href="#' + X.id + 'y" x="' + dx + '" y="' + dy + '" style="color:' + c + '"/>';
    s += '<g transform="translate(160 98)scale(2.3)translate(-44 -44)" stroke-width="3">' + gu(3, 3, P) + gu(-0.5, 0, INK) + gu(0.5, 0, INK) + gu(0, -0.5, INK) + gu(0, 0.5, INK) + '</g>';
    s += chain(X, 20, 150, 60, 190, 112, 188, 6, 5) + chain(X, 300, 40, 270, 10, 224, 8, 6, 5) + eye(X, 52, 40, 9, -12) + eye(X, 270, 160, 9, 12);
    return s;
  },
  Miniature(X) {
    const { P, L, D } = X; let s = '';
    s += PLATES.Skill(X);
    s += '<ellipse cx="160" cy="180" rx="76" ry="14" fill="' + INK + '"/><ellipse cx="160" cy="176" rx="62" ry="10" fill="' + D + '"/>';
    return s;
  },
};
function gearAt(X, cx, cy, R, n, rot, fill) {
  const d = gear(cx, cy, R, n, rot), id = X.id + 'k' + cx;
  let s = '<path d="' + d + '" fill="' + fill + '"/><clipPath id="' + id + '"><path d="' + d + '"/></clipPath>' + hatch([cx - R, cy - R, cx + R, cy + R], id, 6, 40, 1.2, 0.4);
  s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + F(R * 0.55) + '" fill="none"/><circle cx="' + cx + '" cy="' + cy + '" r="' + F(R * 0.2) + '" fill="' + INK + '"/>';
  let sp = ''; for (let i = 0; i < 4; i++) { const a = rot + i * Math.PI / 2; sp += 'M' + pt(cx + Math.cos(a) * R * 0.2, cy + Math.sin(a) * R * 0.2) + 'L' + pt(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55); }
  return s + '<path d="' + sp + '"/>';
}

// ---- the whole picture ----
/** the art's body (defs first) for a w x h box: embed it in any <svg viewBox="0 0 w h"> */
export function artInner(card = {}, { w = 520, h = 170 } = {}) {
  const mots = motifsFor(card.nouns); // what the answer is about (lib/card-subject.js): drawn instead of the generic plate, and the haunted skin steps aside
  const kind = KINDS.includes(card.kind) ? card.kind : kindWord(card.kind);
  const key = String(card.key || card.name || kind), rk = rarityKey(card.rarity);
  // card.ink (lib/art-meta.js: a film's or song's decade): the line quality of another rarity's look, the foil and stars stay the card's own rating
  const ik = card.ink && card.ink in RARITY_LOOK ? card.ink : '', RL = ik ? { ...RARITY_LOOK[rk], ink: RARITY_LOOK[ik].ink, wob: RARITY_LOOK[ik].wob, dens: RARITY_LOOK[ik].dens, w: RARITY_LOOK[ik].w } : RARITY_LOOK[rk];
  // the haunted skin (bats, candle, eyes) only on a card about something spooky: on any other subject it hid what the card is about (owner's K-pop
  // card, 2026-10-17: "it didnt look" like K-pop at all, a candle and bats over a music genre)
  const hot = card.season === 'halloween' && !mots.length && SPOOKY.test(String(card.key || card.name || '') + ' ' + (card.nouns || []).join(' '));
  const hue = Number.isFinite(+card.hue) ? Math.round(+card.hue) % 360 : seedOf(key) % 360;
  const seed = seedOf(key + '|' + kind), r = rng(seed);
  const id = 'a' + seed.toString(36) + (hot ? 'h' : 'b') + rk[0] + (ik ? 'i' + ik[0] : '') + (kind === 'Game' && card.glyph ? 'g' : '');
  const X = {
    defs: [], r, id, h: hue, hot, sw: RL.w, chapter: card.chapter, name: card.name, key,
    R: (a, b) => a + r() * (b - a), I: (a, b) => Math.floor(a + r() * (b - a + 1)),
    P: 'hsl(' + hue + ' 32% 88%)', L: 'hsl(' + hue + ' 46% 70%)', D: 'hsl(' + hue + ' 34% 30%)', V: 'hsl(' + hue + ' 40% 8%)', G: hot ? '#ffb347' : '#fff0a8',
  };
  const plateKind = kind === 'Skill' || kind === 'Miniature' || (kind === 'Game' && card.glyph) ? (kind === 'Miniature' ? 'Miniature' : 'Skill') : kind;
  const s = Math.min(w / 320, h / 180) * 1.0, ox = (w - 320 * s) / 2, oy = (h - 200 * s) / 2 + h * 0.01;
  const flip = r() < 0.5 && plateKind !== 'Album' && plateKind !== 'Song' && plateKind !== 'Book';
  const unit = h / 170;
  let defs = '<radialGradient id="' + id + 'b" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="hsl(' + hue + ' 50% 72%)"/><stop offset=".55" stop-color="hsl(' + hue + ' 48% 48%)"/><stop offset="1" stop-color="hsl(' + hue + ' 46% 24%)"/></radialGradient>';
  defs += '<radialGradient id="' + id + 'v" cx=".5" cy=".5" r=".72"><stop offset=".45" stop-color="' + INK + '" stop-opacity="0"/><stop offset="1" stop-color="' + INK + '" stop-opacity=".82"/></radialGradient>';
  defs += '<radialGradient id="' + id + 'g"><stop offset="0" stop-color="' + X.G + '" stop-opacity=".5"/><stop offset="1" stop-color="' + X.G + '" stop-opacity="0"/></radialGradient>';
  defs += '<filter id="' + id + 'n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="' + (seed % 90) + '"/><feColorMatrix type="saturate" values="0"/></filter>';
  let body = '<rect width="' + w + '" height="' + h + '" fill="url(#' + id + 'b)"/>';
  // corner crosshatch under the vignette
  defs += '<clipPath id="' + id + 'c"><circle cx="0" cy="0" r="' + F(h * 0.85) + '"/><circle cx="' + w + '" cy="' + h + '" r="' + F(h * 0.9) + '"/></clipPath>';
  body += '<g stroke="' + INK + '" fill="none">' + hatch([0, 0, h * 0.85, h * 0.85], id + 'c', 8 * unit, 38, 1.2 * unit * RL.w, 0.5) + hatch([0, 0, h * 0.6, h * 0.6], id + 'c', 11 * unit, -50, 1 * unit, 0.45) + hatch([w - h * 0.9, h * 0.1, w, h], id + 'c', 9 * unit, -40, 1.1 * unit, 0.4) + '</g>';
  body += '<rect width="' + w + '" height="' + h + '" fill="url(#' + id + 'v)"/>';
  if (hot) {
    defs += '<linearGradient id="' + id + 'm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3e9d8" stop-opacity="0"/><stop offset="1" stop-color="#f3e9d8" stop-opacity=".5"/></linearGradient>';
    body += '<rect y="' + F(h * 0.55) + '" width="' + w + '" height="' + F(h * 0.45) + '" fill="url(#' + id + 'm)"/>';
    for (let i = 0; i < 4; i++) body += '<ellipse cx="' + F(r() * w) + '" cy="' + F(h * (0.72 + r() * 0.25)) + '" rx="' + F(w * (0.18 + r() * 0.2)) + '" ry="' + F(h * (0.07 + r() * 0.08)) + '" fill="#f3e9d8" opacity="' + F(0.2 + r() * 0.2) + '"/>';
  }
  defs += '<filter id="' + id + 'r" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves="2" seed="' + (seed % 50) + '" result="t"/><feDisplacementMap in="SourceGraphic" in2="t" scale="' + RL.wob + '" result="d"/><feDropShadow in="d" dx="3.5" dy="4.5" stdDeviation="0" flood-color="' + INK + '" flood-opacity=".55"/></filter>';
  const plate = '<g filter="url(#' + id + 'r)" style="opacity:calc(0.3 + 0.7 * var(--ink-density,' + RL.dens + '))" stroke="' + RL.ink + '" stroke-width="' + F(2.4 * RL.w) + '" stroke-linejoin="round" stroke-linecap="round" fill="none">' + (PLATES[plateKind] || PLATES.Idea)(X) + '</g>';
  if (mots.length) body += motifSvg(mots, w, h, { P: X.P, L: X.L, G: '#f3d77a', ink: RL.ink, sw: RL.w });
  else body += '<g transform="translate(' + F(ox + (flip ? 320 * s : 0)) + ' ' + F(oy) + ')scale(' + F(flip ? -s : s) + ' ' + F(s) + ')">' + plate + '</g>';
  // glitch tears and scanlines
  for (let i = 0, n = hot ? 4 : 3; i < n; i++) {
    const y = r() * h, tw = (0.2 + r() * 0.45) * w, tx = r() * (w - tw), th = (1.2 + r() * 2.6) * unit;
    body += '<g stroke="none"><rect x="' + F(tx - 3 * unit) + '" y="' + F(y) + '" width="' + F(tw) + '" height="' + F(th) + '" fill="#37f2ff" opacity=".28"/><rect x="' + F(tx + 3 * unit) + '" y="' + F(y + th * 0.4) + '" width="' + F(tw) + '" height="' + F(th) + '" fill="#ff4fd8" opacity=".24"/><rect x="' + F(tx) + '" y="' + F(y + th * 0.2) + '" width="' + F(tw * 0.55) + '" height="' + F(th * 0.5) + '" fill="' + X.P + '" opacity=".55"/></g>';
  }
  // splatters
  for (let i = 0, n = 2 + (RL.w > 1.2 ? 1 : 0); i < n; i++) body += splat(X, r() < 0.5 ? r() * w * 0.2 : w * (0.8 + r() * 0.2), r() * h * 0.9, (2.2 + r() * 3.2) * unit);
  // eyes in the dark
  for (let i = 0, n = hot ? 6 : 3; i < n; i++) {
    const side = i % 2 ? 1 : 0, x = side ? w * (0.86 + r() * 0.1) : w * (0.04 + r() * 0.1), y = h * (0.12 + r() * 0.7);
    body += darkEyes(X, x, y, (1.6 + r() * 2.2) * unit, r() * 1.2 - 0.6);
  }
  // torn paper at the foot and the head
  const jag = (y0, up) => { let d = 'M0 ' + up; for (let x = 0; x <= w + 12; x += 10 + r() * 12) d += 'L' + F(x) + ' ' + F(y0 + (r() - 0.5) * 6 * unit); return d + 'L' + w + ' ' + up + 'Z'; };
  body += '<path d="' + jag(h - 8 * unit, h) + '" fill="' + X.P + '" opacity=".92"/><path d="' + jag(h - 4.5 * unit, h) + '" fill="' + INK + '"/><path d="' + jag(5 * unit, 0) + '" fill="' + INK + '"/>';
  body += '<rect width="' + w + '" height="' + h + '" fill="none" stroke="' + INK + '" stroke-width="' + F(5 * unit * RL.w) + '"/>';
  if (hot) {
    defs += '<path id="' + id + 't" d="M0-2L2-5L3-2Q8-6 15-4Q12-2 12 1Q9-1 7 2Q5 0 3 2L0 6L-3 2Q-5 0-7 2Q-9-1-12 1Q-12-2-15-4Q-8-6-3-2L-2-5Z"/>';
    defs += '<radialGradient id="' + id + 'k"><stop offset="0" stop-color="#ff8a1f" stop-opacity=".8"/><stop offset="1" stop-color="#ff8a1f" stop-opacity="0"/></radialGradient>';
    for (let i = 0; i < 4; i++) body += '<use href="#' + id + 't" transform="translate(' + F(w * (0.1 + r() * 0.8)) + ' ' + F(h * (0.06 + r() * 0.34)) + ')scale(' + F((0.7 + r() * 0.7) * unit) + ')rotate(' + F(r() * 30 - 15) + ')" fill="' + INK + '" stroke="none"/>';
    const cx = r() < 0.5 ? w * 0.08 : w * 0.92, cy = h * 0.86;
    body += '<circle cx="' + F(cx) + '" cy="' + F(cy - 6 * unit) + '" r="' + F(h * 0.4) + '" fill="url(#' + id + 'k)"><animate attributeName="opacity" values=".7;1;.75;.95;.6;.9" dur="2.4s" repeatCount="indefinite"/></circle>';
    body += '<g stroke="' + INK + '" stroke-width="' + F(1.2 * unit) + '"><rect x="' + F(cx - 3 * unit) + '" y="' + F(cy - 4 * unit) + '" width="' + F(6 * unit) + '" height="' + F(14 * unit) + '" fill="' + X.P + '"/><path d="M' + pt(cx, cy - 4 * unit) + 'q' + pt(-3.4 * unit, -5 * unit) + ' ' + pt(0, -10 * unit) + 'q' + pt(3.4 * unit, 5 * unit) + ' ' + pt(0, 10 * unit) + 'Z" fill="#ffd27a"/></g>';
    body += '<rect x="' + F(2.5 * unit) + '" y="' + F(2.5 * unit) + '" width="' + F(w - 5 * unit) + '" height="' + F(h - 5 * unit) + '" fill="none" stroke="#ff7a1a" stroke-width="' + F(3 * unit) + '"/>';
  }
  if (RL.foil) {
    defs += '<linearGradient id="' + id + 'f" x1="0" y1="0" x2="1" y2="1">' + RL.foil.map((c, i, a) => '<stop offset="' + F(0.12 + 0.76 * i / (a.length - 1)) + '" stop-color="' + c + '" stop-opacity="' + (i % 2 ? 0.55 : 0.85) + '"/>').join('') + '</linearGradient>';
    body += '<rect width="' + w + '" height="' + h + '" fill="url(#' + id + 'f)" opacity="' + RL.a + '"/>';
    for (let i = 0; i < RL.stars; i++) { const x = r() * w, y = r() * h, z = (2.5 + r() * 3.5) * unit; body += '<path d="M' + pt(x, y - z) + 'Q' + pt(x, y) + ' ' + pt(x + z, y) + 'Q' + pt(x, y) + ' ' + pt(x, y + z) + 'Q' + pt(x, y) + ' ' + pt(x - z, y) + 'Q' + pt(x, y) + ' ' + pt(x, y - z) + 'Z" fill="' + RL.foil[0] + '" opacity=".85"/>'; }
  }
  if (X.eyeDef) defs += '<g id="' + id + 'e"><path d="M-1 0Q0-.9 1 0Q0 .8-1 0Z" fill="' + X.G + '" stroke="none"/><ellipse rx=".14" ry=".55" fill="' + INK + '" stroke="none"/></g>';
  return '<defs>' + defs + X.defs.join('') + '</defs>' + body;
}

/** one idea's art as an SVG string. card: { key, name, kind, chapter, hue, rarity, season, glyph }; size: { w, h } is the viewBox (default 520 x 170).
 *  The same key always draws the same picture; kind picks the plate; rarity the ink weight and foil; season 'halloween' the haunted skin. Pure. */
export function artSvg(card = {}, size = {}) {
  const w = Math.max(40, Math.min(2000, Math.round(+size.w || 520))), h = Math.max(30, Math.min(2000, Math.round(+size.h || 170)));
  return '<svg xmlns="http://www.w3.org/2000/svg" class="vc-art-svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid slice" role="img" aria-label="' + esc(card.name || card.key || 'card art') + '">' + artInner(card, { w, h }) + '</svg>';
}
