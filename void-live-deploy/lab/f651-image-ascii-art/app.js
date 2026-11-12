const $ = id => document.getElementById(id);
const fileIn = $('file');
const widthIn = $('width');
const contrastIn = $('contrast');
const charsetSel = $('charset');
const customIn = $('customCharset');
const customLabel = $('customLabel');
const preview = $('preview');
const canvas = $('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const info = $('info');
const KEY = 'verse-f651-ascii';

let img = null;
let lastName = '';

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (s.width) widthIn.value = s.width;
    if (s.contrast) contrastIn.value = s.contrast;
    if (s.charset) charsetSel.value = s.charset;
    if (s.custom) customIn.value = s.custom;
    if (s.name) lastName = s.name;
    updateCustom();
  } catch (e) { console.debug("lab f651-image-ascii-art:", e); }
}
function saveState() {
  const s = {
    width: +widthIn.value,
    contrast: +contrastIn.value,
    charset: charsetSel.value,
    custom: customIn.value,
    name: lastName
  };
  localStorage.setItem(KEY, JSON.stringify(s));
}
function updateCustom() {
  customLabel.style.display = charsetSel.value === 'custom' ? '' : 'none';
}
function getCharset() {
  return charsetSel.value === 'custom' ? customIn.value || ' .' : charsetSel.value;
}
function luminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
function render() {
  if (!img) { preview.textContent = 'Upload an image to begin.'; return; }
  const cols = Math.max(20, Math.min(200, +widthIn.value || 80));
  const aspect = img.height / img.width;
  const rows = Math.max(8, Math.round(cols * aspect * 0.5)); // char aspect correction
  canvas.width = cols;
  canvas.height = rows;
  ctx.drawImage(img, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const charset = getCharset();
  const contrast = +contrastIn.value || 1;
  let out = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      let L = luminance(data[i], data[i+1], data[i+2]) / 255;
      L = Math.pow(L, contrast); // simple contrast
      L = Math.max(0, Math.min(1, L));
      const idx = Math.floor(L * (charset.length - 1));
      out += charset[idx] || ' ';
    }
    out += '\n';
  }
  preview.textContent = out;
  info.textContent = `${cols}×${rows} · ${lastName || 'image'}`;
  saveState();
}

fileIn.addEventListener('change', e => {
  const f = e.target.files[0];
  if (!f) return;
  lastName = f.name;
  const url = URL.createObjectURL(f);
  img = new Image();
  img.onload = () => { URL.revokeObjectURL(url); render(); };
  img.src = url;
});
widthIn.addEventListener('input', render);
contrastIn.addEventListener('input', render);
charsetSel.addEventListener('change', () => { updateCustom(); render(); });
customIn.addEventListener('input', render);

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(preview.textContent);
    info.textContent = 'Copied!';
  } catch {
    info.textContent = 'Copy failed — use download';
  }
});
$('download').addEventListener('click', () => {
  const blob = new Blob([preview.textContent], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (lastName || 'ascii').replace(/\.[^.]+$/, '') + '.txt';
  a.click();
  URL.revokeObjectURL(a.href);
});

loadState();
updateCustom();
