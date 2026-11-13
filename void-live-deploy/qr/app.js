import { qrMatrix, qrSvg } from '/lib/qr.js';
import { qrPageText } from '/lib/qr-page.js';

const input = document.querySelector('#text');
const out = document.querySelector('#out');
const meta = document.querySelector('#meta');
const err = document.querySelector('#err');

function show(raw) {
  const page = qrPageText(raw);
  out.replaceChildren();
  meta.textContent = '';
  if (!page.ok) {
    err.textContent = page.reason === 'long' ? 'That line is too long for one code.' : '';
    return;
  }
  const code = qrMatrix(page.text);
  if (!code) {
    err.textContent = 'That line is too long for one code.';
    return;
  }
  err.textContent = '';
  const tpl = document.createElement('template');
  tpl.innerHTML = qrSvg(code, { margin: 4, label: 'QR code' }); // void-review: ok (qrSvg is built from numbers and a fixed label only)
  out.appendChild(tpl.content);
  meta.textContent = 'Version ' + code.version + ', level ' + code.ecl;
}

document.querySelector('form').addEventListener('submit', (e) => {
  const page = qrPageText(input.value);
  if (!page.ok) {
    e.preventDefault();
    show(input.value);
    return;
  }
  input.value = page.text;
  const u = new URL(location.href);
  u.searchParams.set('text', page.text);
  history.replaceState(null, '', u);
  if (out.querySelector('svg')) return;
  e.preventDefault();
  show(page.text);
});

input.addEventListener('input', () => show(input.value));

const start = new URLSearchParams(location.search).get('text') || '';
if (start && !out.querySelector('svg')) {
  input.value = start;
  show(start);
}
