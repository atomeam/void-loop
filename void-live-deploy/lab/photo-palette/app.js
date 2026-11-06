// /lab/photo-palette/: the colours of a photo, with how much of it each covers; copy them, keep them as the palette every Verse tool uses, or save a swatch card.
import { pointsOf, paletteOf, cssOf, pctOf } from './palette.js';
import { mountRelated, setPalette } from '/lib/toolkit.js';

const $ = (id) => document.getElementById(id);
let pts = null, pal = [], name = 'photo';
const el = (tag, cls, text) => { const x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; };
const flash = (b, t) => { const was = b.textContent; b.textContent = t; setTimeout(() => { b.textContent = was; }, 1400); };
async function copy(text, b) { try { await navigator.clipboard.writeText(text); flash(b, 'Copied'); } catch (_) { prompt('Copy this', text); } }

async function load(file) {
  if (!file || !/^image\//.test(file.type)) { $('state').textContent = 'That is not a picture. A JPG, PNG, WebP or HEIC your browser can open works.'; return; }
  name = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo'; $('state').textContent = 'Reading the colours…';
  try {
    const bmp = await createImageBitmap(file), side = 180, sc = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * sc)); c.height = Math.max(1, Math.round(bmp.height * sc));
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0, c.width, c.height);
    pts = pointsOf(x.getImageData(0, 0, c.width, c.height).data);
    $('thumb').src = c.toDataURL('image/jpeg', 0.85); $('thumb').hidden = false; work();
  } catch (e) { $('state').textContent = 'This browser could not open that picture: ' + (e && e.message || e); }
}
function work() {
  if (!pts) return; pal = paletteOf(pts, Number($('k').value));
  $('kv').textContent = $('k').value; $('state').textContent = pal.length + ' colours, largest share first. Tap one to copy it.';
  const sw = $('swatches'), bar = $('bar'); sw.textContent = ''; bar.textContent = '';
  for (const p of pal) {
    const b = el('button', 'sw'); b.type = 'button'; b.style.setProperty('--c', p.hex); b.append(el('i'), el('span', 'mono', p.hex), el('span', 'note', pctOf(p.share)));
    b.setAttribute('aria-label', 'Copy ' + p.hex + ', ' + pctOf(p.share) + ' of the photo'); b.addEventListener('click', () => copy(p.hex, b.querySelector('.mono'))); sw.append(b);
    const seg = el('span'); seg.style.flex = String(p.share); seg.style.background = p.hex; bar.append(seg);
  }
  for (const id of ['hexes', 'css', 'png', 'keep']) $(id).disabled = !pal.length;
  $('open').href = pal.length ? '/color/?c=' + pal[0].hex.slice(1) : '/color/';
}
$('hexes').addEventListener('click', (e) => copy(pal.map((p) => p.hex).join(', '), e.currentTarget));
$('css').addEventListener('click', (e) => copy(cssOf(pal), e.currentTarget));
$('keep').addEventListener('click', (e) => {
  // darkest to lightest, so tools that take the first and last as ground and ink get a readable pair
  const ok = setPalette([...pal].sort((a, b) => a.L - b.L).map((p) => p.hex)); flash(e.currentTarget, ok ? 'Kept for every tool' : 'Could not keep it here');
});
$('png').addEventListener('click', () => {
  const w = 1200, h = 630, c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = '#0b0a10'; x.fillRect(0, 0, w, h); let at = 40; const span = w - 80;
  for (const p of pal) { const pw = Math.max(1, Math.round(span * p.share)); x.fillStyle = p.hex; x.fillRect(at, 40, pw, 440); at += pw; }
  x.font = '600 26px system-ui, sans-serif'; x.fillStyle = '#ecebf5'; const col = span / pal.length;
  pal.forEach((p, i) => { x.fillStyle = p.hex; x.fillRect(40 + i * col, 510, 32, 32); x.fillStyle = '#ecebf5'; x.fillText(p.hex, 82 + i * col, 536); x.fillStyle = '#a3a0b3'; x.fillText(pctOf(p.share), 82 + i * col, 572); });
  c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name + '-palette.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, 'image/png');
});
$('k').addEventListener('input', work);
$('pick').addEventListener('change', (e) => load(e.target.files[0]));
const drop = $('drop');
drop.addEventListener('click', () => $('pick').click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('pick').click(); } });
for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); });
for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => { e.preventDefault(); load(e.dataTransfer.files[0]); });
addEventListener('paste', (e) => { const f = [...(e.clipboardData && e.clipboardData.files || [])].find((x) => /^image\//.test(x.type)); if (f) load(f); });
mountRelated($('related'), '/lab/photo-palette/', [{ label: 'Make a gradient of these', href: () => pal.length > 1 ? '/color/gradient/#l90-' + pal.slice(0, 6).map((p, i, a) => p.hex.slice(1) + 'ff.' + Math.round((i / (a.length - 1)) * 100)).join('-') : '/color/gradient/' }]);
