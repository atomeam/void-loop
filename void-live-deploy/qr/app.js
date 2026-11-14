import { qrMatrix, qrSvg } from '/lib/qr.js?v=2';
import { qrPageText, qrWifi, qrContact } from '/lib/qr-page.js?v=2';

function qrHex(color, fallback) {
  const s = String(color || '').trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

const input = document.querySelector('#text');
const dark = document.querySelector('#dark');
const light = document.querySelector('#light');
const out = document.querySelector('#out');
const meta = document.querySelector('#meta');
const err = document.querySelector('#err');
const svgdl = document.querySelector('#svgdl');
const pngdl = document.querySelector('#pngdl');
const share = document.querySelector('#share');
let svgUrl = '';
let pngUrl = '';

function colors() {
  return { dark: qrHex(dark.value, '#000000'), light: qrHex(light.value, '#ffffff') };
}

function pngOf(code, ink, paper) {
  const scale = 8, margin = 4, n = code.size + margin * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n * scale;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = ink;
  for (let y = 0; y < code.size; y++) for (let x = 0; x < code.size; x++) {
    if (code.modules[y][x]) ctx.fillRect((x + margin) * scale, (y + margin) * scale, scale, scale);
  }
  return canvas.toDataURL('image/png');
}

function show(raw) {
  const page = qrPageText(raw);
  out.replaceChildren();
  meta.textContent = '';
  svgdl.removeAttribute('href');
  pngdl.removeAttribute('href');
  if (!page.ok) {
    err.textContent = page.reason === 'long' ? 'That line is too long for one code.' : 'Type a line first.';
    return;
  }
  const ink = colors();
  const code = qrMatrix(page.text);
  if (!code) {
    err.textContent = 'That line is too long for one code.';
    return;
  }
  err.textContent = '';
  const svg = qrSvg(code, { margin: 4, label: 'QR code', dark: ink.dark, light: ink.light });
  const tpl = document.createElement('template');
  tpl.innerHTML = svg; // void-review: ok (qrSvg is built from numbers, a fixed label, and a checked colour)
  out.appendChild(tpl.content);
  meta.textContent = 'Version ' + code.version + ', level ' + code.ecl;
  if (svgUrl) URL.revokeObjectURL(svgUrl);
  svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  svgdl.href = svgUrl;
  if (pngUrl) URL.revokeObjectURL(pngUrl);
  pngUrl = pngOf(code, ink.dark, ink.light);
  pngdl.href = pngUrl;
  const u = new URL(location.href);
  u.searchParams.set('text', page.text);
  u.searchParams.set('dark', ink.dark);
  u.searchParams.set('light', ink.light);
  share.href = u.pathname + u.search;
  share.textContent = u.pathname + u.search;
}

document.querySelector('form').addEventListener('submit', (e) => {
  const page = qrPageText(input.value);
  if (!page.ok) {
    e.preventDefault();
    show(input.value);
    return;
  }
  input.value = page.text;
  show(page.text);
});

for (const el of [input, dark, light]) el.addEventListener('input', () => show(input.value));
document.querySelector('#wifi').addEventListener('click', () => {
  input.value = qrWifi(document.querySelector('#ssid').value, document.querySelector('#pass').value, document.querySelector('#auth').value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
document.querySelector('#card').addEventListener('click', () => {
  input.value = qrContact(document.querySelector('#cname').value, document.querySelector('#cphone').value, document.querySelector('#cemail').value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

const q = new URLSearchParams(location.search);
if (q.get('dark')) dark.value = qrHex(q.get('dark'), dark.value);
if (q.get('light')) light.value = qrHex(q.get('light'), light.value);
const start = q.get('text') || '';
if (start) {
  input.value = start;
  show(start);
}
