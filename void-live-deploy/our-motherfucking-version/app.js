import { weigh } from '/lib/versus.js';

const box = document.querySelector('#html');
const out = document.querySelector('#out');

function lineFor(value) {
  if (!value) return '';
  const w = weigh(value);
  return w.bytes + ' bytes · ' + w.images + ' pictures · ' + w.fonts + ' font requests · ' + w.scripts + ' scripts';
}

function run() {
  out.value = lineFor(box.value);
  const u = new URL(location.href);
  if (box.value) u.searchParams.set('html', box.value);
  else u.searchParams.delete('html');
  history.replaceState(null, '', u);
}

box.addEventListener('input', run);
const q = new URLSearchParams(location.search).get('html');
if (q != null) box.value = q;
run();
