// The Versus card's picture (owner, 2026-11-03: "make the 3d tower on the card 2d but still update with each floor"; "make the tower look like an
// epic card picture"): a flat SVG drawn from the same floors the card lists (skills/tower.js miniFloors, the layout of skills/mini/tower.js), so
// each site surpassed lays one more lit floor and the site Verse is on now glows at the top, one floor per site surpassed and the one being fought on top. A deep
// violet night, a glowing emblem, sparkles and glints, in the card art's style. No three.js, no image, no fetch: a few KB of markup, so it
// draws at once on a weak connection, and stands still for anyone who asked for less motion. Pure.
import { layout } from '../skills/mini/tower.js';

const W = 320, H = 260, GROUND = 228, TOP = 46;
const ESC = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const clip = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
// the same stars every time for the same tower (a seeded walk), so a redraw does not twinkle the sky around
const rnd = (seed) => { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };

/** the picture as SVG markup, from the card's floors ({ id, site, state, n, m, page }). Pure. */
export function towerArtSvg(floors, { label = '' } = {}) {
  const L = layout((floors || []).filter((f) => f.state !== 'ahead')), drawn = L.drawn, beaten = drawn.filter((f) => f.state === 'beaten').length;
  const span = GROUND - TOP, unit = L.height > 0 ? span / L.height : 0, r = rnd(7 + L.floors * 31);
  const stars = Array.from({ length: 34 }, (_, i) => { const x = (r() * W).toFixed(1), y = (r() * (GROUND - 30)).toFixed(1), s = (0.4 + r() * 1.1).toFixed(2); return '<circle cx="' + x + '" cy="' + y + '" r="' + s + '" fill="#fff" opacity="' + (0.35 + r() * 0.6).toFixed(2) + '"' + (i % 5 === 0 ? ' class="ta-tw"' : '') + '/>'; }).join('');
  const glint = (x, y, s, k = '') => '<path class="ta-glint' + k + '" d="M' + x + ' ' + (y - s) + 'L' + (x + s * 0.22) + ' ' + (y - s * 0.22) + 'L' + (x + s) + ' ' + y + 'L' + (x + s * 0.22) + ' ' + (y + s * 0.22) + 'L' + x + ' ' + (y + s) + 'L' + (x - s * 0.22) + ' ' + (y + s * 0.22) + 'L' + (x - s) + ' ' + y + 'L' + (x - s * 0.22) + ' ' + (y - s * 0.22) + 'Z" fill="#fff"/>';
  // each floor a slab, a little narrower as it rises; the lit ones gold, the current one violet fire, the next ones an outline of scaffold
  const slabs = drawn.map((f, k) => {
    const h = Math.max(2, L.floorH * unit), cy = GROUND - (f.y - 0.03) * unit, y = cy - h / 2, rise = (GROUND - cy) / span, w = 118 - rise * 46, x = W / 2 - w / 2;
    const fill = f.state === 'current' ? 'url(#ta-cur)' : f.state === 'beaten' ? 'url(#ta-gold)' : 'none', stroke = f.state === 'ahead' ? '#8a7cc0' : f.state === 'current' ? '#f3e8ff' : '#ffe9a8';
    const name = f.labelled && h >= 7 ? '<text x="' + (W / 2) + '" y="' + (cy + Math.min(h, 12) * 0.33).toFixed(1) + '" text-anchor="middle" font-size="' + Math.min(10, Math.max(5, h * 0.62), w * 1.8 / Math.max(1, clip(f.site, 26).length)).toFixed(1) + '" fill="' + (f.state === 'current' ? '#fff' : '#3b2600') + '" font-weight="700">' + ESC(clip(f.site, 26)) + '</text>' : '';
    return '<g class="ta-floor" data-id="' + ESC(f.id) + '" data-art-state="' + f.state + '"' + (f.state === 'current' ? ' filter="url(#ta-glow)"' : '') + '><title>' + ESC(f.site + (f.state === 'beaten' ? ': surpassed' : f.state === 'current' ? ': now assimilating, ' + f.n + ' of ' + f.m : ': up next')) + '</title>'
      + '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + Math.min(3, h / 3).toFixed(1) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (f.state === 'ahead' ? 0.8 : 0.6) + '"' + (f.state === 'ahead' ? ' stroke-dasharray="3 2" opacity=".7"' : '') + '/>' + name + '</g>';
  }).join('');
  const cur = drawn.find((f) => f.state === 'current'), topY = drawn.length ? GROUND - (drawn[drawn.length - 1].y - 0.03) * unit - L.floorH * unit / 2 : GROUND - 20;
  const emY = Math.max(22, topY - 20);
  // the emblem: Verse's glowing cube above the tower, the beam from it to the floor being fought
  const emblem = '<g filter="url(#ta-glow)" class="ta-emblem"><path d="M160 ' + (emY - 14) + 'L172 ' + (emY - 7) + 'L172 ' + (emY + 7) + 'L160 ' + (emY + 14) + 'L148 ' + (emY + 7) + 'L148 ' + (emY - 7) + 'Z" fill="url(#ta-cube)" stroke="#f3e8ff" stroke-width=".8"/><path d="M148 ' + (emY - 7) + 'L160 ' + emY + 'L172 ' + (emY - 7) + 'M160 ' + emY + 'L160 ' + (emY + 14) + '" stroke="#f3e8ff" stroke-width=".6" fill="none" opacity=".8"/></g>';
  const beam = cur ? '<path d="M160 ' + (emY + 14) + 'L' + (160 - 30) + ' ' + topY.toFixed(1) + 'L' + (160 + 30) + ' ' + topY.toFixed(1) + 'Z" fill="url(#ta-beam)" opacity=".55"/>' : '';
  const words = (cur ? 'Now: ' + clip(cur.site, 30) + ' · ' + cur.n + ' of ' + cur.m : 'Every site surpassed') + ' · ' + beaten + ' surpassed' + (L.cut ? ' (' + L.cut + ' more below)' : '');
  return '<svg class="tw-art" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + ESC(label || ('Versus: a tower of ' + beaten + ' surpassed sites' + (cur ? ', ' + cur.site + ' glowing at the top' : ''))) + '" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:auto;border-radius:12px">'
    + '<defs><radialGradient id="ta-sky" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#4b2a8a"/><stop offset=".45" stop-color="#22134a"/><stop offset="1" stop-color="#0a0718"/></radialGradient>'
    + '<linearGradient id="ta-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#e6c35c"/><stop offset="1" stop-color="#a87a1e"/></linearGradient>'
    + '<linearGradient id="ta-cur" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f0d9ff"/><stop offset=".5" stop-color="#b27cff"/><stop offset="1" stop-color="#6a3dd0"/></linearGradient>'
    + '<linearGradient id="ta-cube" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="#d9c2ff"/><stop offset="1" stop-color="#7d4dff"/></linearGradient>'
    + '<linearGradient id="ta-beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9d6ff" stop-opacity=".9"/><stop offset="1" stop-color="#b27cff" stop-opacity="0"/></linearGradient>'
    + '<radialGradient id="ta-halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#c9a6ff" stop-opacity=".55"/><stop offset="1" stop-color="#c9a6ff" stop-opacity="0"/></radialGradient>'
    + '<filter id="ta-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>'
    + '<style>.tw-art .ta-tw{animation:ta-tw 3.2s ease-in-out infinite}.tw-art .ta-glint{animation:ta-tw 2.4s ease-in-out infinite}.tw-art .ta-glint2{animation:ta-tw 2.4s ease-in-out 1.2s infinite}.tw-art [data-art-state=current] rect{animation:ta-pulse 2.2s ease-in-out infinite}'
    + '@keyframes ta-tw{0%,100%{opacity:.25}50%{opacity:1}}@keyframes ta-pulse{0%,100%{opacity:.85}50%{opacity:1}}@media (prefers-reduced-motion:reduce){.tw-art *{animation:none!important}}</style>'
    + '<rect width="' + W + '" height="' + H + '" fill="url(#ta-sky)"/>' + stars
    + '<ellipse cx="160" cy="' + emY + '" rx="70" ry="46" fill="url(#ta-halo)"/>'
    + '<ellipse cx="160" cy="' + (GROUND + 4) + '" rx="120" ry="12" fill="#1a1033" stroke="#5b4a8a" stroke-width=".8"/><ellipse cx="160" cy="' + (GROUND + 2) + '" rx="78" ry="6" fill="#2a1a52"/>'
    + beam + slabs + emblem + glint(54, 40, 6) + glint(268, 70, 5, '2') + glint(236, 26, 3.5) + glint(84, 120, 3, '2')
    + '<text x="160" y="' + (H - 10) + '" text-anchor="middle" font-size="10.5" fill="#e9dcff" font-weight="700" letter-spacing=".3">' + ESC(words) + '</text></svg>';
}
