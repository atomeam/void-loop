// /lab/pattern/: grow a seamless pattern (Gray-Scott, wrapping edges), pick two colours, keep it as a PNG tile or a link that grows it again.
import { PRESETS, SIZE, STEPS, seedGrid, step, shades, paint, linkOf, fromLink } from './pattern.js';
import { mountRelated, paletteOf } from '/lib/toolkit.js';

const $ = (id) => document.getElementById(id), KEY = 'a2m.lab.pattern.v1';
let s = { preset: 'coral', seed: 1 + Math.floor(Math.random() * 99999), back: '#0b0a10', ink: '#a58bff' }, g = null, run = 0, sh = null;
const pal = paletteOf(); if (pal) { s.back = pal[0]; s.ink = pal[pal.length - 1]; }
try { const kept = JSON.parse(localStorage.getItem(KEY) || 'null'); if (kept && PRESETS[kept.preset]) s = { ...s, ...kept }; } catch (_) { /* first visit */ }
const fromHash = fromLink(location.hash); if (fromHash) s = fromHash;

for (const [key, p] of Object.entries(PRESETS)) { const o = document.createElement('option'); o.value = key; o.textContent = p.name; $('preset').append(o); }
function sync() { $('preset').value = s.preset; $('back').value = s.back; $('ink').value = s.ink; $('seed').value = String(s.seed); }
function keep() { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) { /* private mode */ } history.replaceState(null, '', '#p=' + linkOf(s)); }

function draw() {
  if (!g) return; sh = shades(g);
  const c = $('view'), x = c.getContext('2d'), px = paint(sh, SIZE, 256, s.back, s.ink);
  x.putImageData(new ImageData(px, 256, 256), 0, 0);
  // the tile, repeated: if a seam showed, it would show here
  $('tiled').style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')';
}
function grow() {
  const me = ++run; g = seedGrid(s.seed); $('state').textContent = 'Growing…'; $('save').disabled = true;
  const tick = () => {
    if (me !== run) return;
    step(g, PRESETS[s.preset], 150); draw();
    if (g.done < STEPS) { $('state').textContent = 'Growing… ' + Math.round((g.done / STEPS) * 100) + '%'; requestAnimationFrame(tick); }
    else { $('state').textContent = PRESETS[s.preset].name + ', seed ' + s.seed + '. It tiles with no seam.'; $('save').disabled = false; }
  };
  requestAnimationFrame(tick);
}
function recolour() { s.back = $('back').value; s.ink = $('ink').value; keep(); draw(); }

$('preset').addEventListener('change', () => { s.preset = $('preset').value; keep(); grow(); });
$('back').addEventListener('input', recolour); $('ink').addEventListener('input', recolour);
$('swap').addEventListener('click', () => { [s.back, s.ink] = [s.ink, s.back]; sync(); keep(); draw(); });
$('new').addEventListener('click', () => { s.seed = 1 + Math.floor(Math.random() * 99999); sync(); keep(); grow(); });
$('seed').addEventListener('change', () => { const v = parseInt($('seed').value, 10); if (v > 0) { s.seed = v; keep(); grow(); } });
$('save').addEventListener('click', () => {
  if (!sh) return; const n = Number($('size').value) || 1024, c = document.createElement('canvas'); c.width = c.height = n;
  c.getContext('2d').putImageData(new ImageData(paint(sh, SIZE, n, s.back, s.ink), n, n), 0, 0);
  c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'pattern-' + s.preset + '-' + s.seed + '-' + n + '.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
});
$('link').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#p=' + linkOf(s);
  try { await navigator.clipboard.writeText(url); $('link').textContent = 'Link copied'; setTimeout(() => { $('link').textContent = 'Copy link'; }, 1500); } catch (_) { prompt('Copy this link', url); }
});
addEventListener('hashchange', () => { const h = fromLink(location.hash); if (h && linkOf(h) !== linkOf(s)) { s = h; sync(); grow(); } });
sync(); keep(); grow();
mountRelated($('related'), '/lab/pattern/', [{ label: 'Use these colours in a gradient', href: () => '/color/gradient/#l90-' + s.back.slice(1) + 'ff.0-' + s.ink.slice(1) + 'ff.100' }]);
