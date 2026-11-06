// /lab/mind-map/: type an indented outline, see it as a mind map; keep it as SVG or PNG, or a link that opens the same map.
import { treeOf, svgOf, sizeOf, packOf, unpackOf } from './outline.js';
import { mountRelated } from '/lib/toolkit.js';

const $ = (id) => document.getElementById(id), KEY = 'a2m.lab.mindmap.v1';
const SAMPLE = 'Plan the trip\n  Where\n    Lisbon\n    Porto\n  When\n    May\n  Money\n    flights\n    hotel\n    food\n  Pack\n    passport\n    charger';
const box = $('text');
const fromHash = /^#o=/.test(location.hash) ? unpackOf(location.hash.slice(3)) : null;
try { box.value = fromHash || localStorage.getItem(KEY) || SAMPLE; } catch (_) { box.value = fromHash || SAMPLE; }
let svg = '', shown = '';
function draw() {
  const t = treeOf(box.value); svg = t ? svgOf(t, { light: $('light').checked }) : '';
  // shown as an <img> of its own SVG: a map from a shared link can never run anything on this page
  if (shown) URL.revokeObjectURL(shown);
  shown = svg ? URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })) : '';
  if (shown) { const img = new Image(); img.alt = 'Mind map'; img.src = shown; $('map').replaceChildren(img); }
  else $('map').replaceChildren(Object.assign(document.createElement('p'), { className: 'note', textContent: 'Type a first line for the middle, then indent the branches under it.' }));
  $('size').textContent = t ? sizeOf(t) + ' ideas' : '';
  for (const id of ['svg', 'png', 'link']) $(id).disabled = !svg;
  try { localStorage.setItem(KEY, box.value); } catch (_) { /* private mode */ }
}
const nameOf = () => (treeOf(box.value)?.text || 'mind-map').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'mind-map';
const save = (blob, ext) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nameOf() + '.' + ext; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
$('svg').addEventListener('click', () => save(new Blob([svg], { type: 'image/svg+xml' }), 'svg'));
$('png').addEventListener('click', () => {
  const img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  img.onload = () => { const k = 2, c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; const x = c.getContext('2d'); x.scale(k, k); x.drawImage(img, 0, 0); URL.revokeObjectURL(url); c.toBlob((b) => save(b, 'png'), 'image/png'); };
  img.src = url;
});
$('link').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#o=' + packOf(box.value);
  try { await navigator.clipboard.writeText(url); $('link').textContent = 'Link copied'; setTimeout(() => { $('link').textContent = 'Copy link'; }, 1500); } catch (_) { prompt('Copy this link', url); }
});
box.addEventListener('keydown', (e) => {
  // Tab indents the line (a branch under the one above), Shift+Tab brings it back out
  if (e.key !== 'Tab') return; e.preventDefault();
  const v = box.value, s = box.selectionStart, start = v.lastIndexOf('\n', s - 1) + 1;
  if (e.shiftKey) { if (v.slice(start, start + 2) === '  ') { box.value = v.slice(0, start) + v.slice(start + 2); box.selectionStart = box.selectionEnd = Math.max(start, s - 2); } }
  else { box.value = v.slice(0, start) + '  ' + v.slice(start); box.selectionStart = box.selectionEnd = s + 2; }
  draw();
});
box.addEventListener('input', draw); $('light').addEventListener('change', draw);
$('sample').addEventListener('click', () => { box.value = SAMPLE; draw(); });
draw();
mountRelated($('related'), '/lab/mind-map/', [{ label: 'Count the words in it', href: () => '/word-count/?t=' + encodeURIComponent(box.value.slice(0, 1800)) }]);
