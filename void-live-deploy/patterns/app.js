import { regexPieces, regexTest } from '/lib/dev-tools.js';

const pattern = document.querySelector('#pattern');
const flags = document.querySelector('#flags');
const sample = document.querySelector('#sample');
const count = document.querySelector('#count');
const out = document.querySelector('#out');
const err = document.querySelector('#err');

function show() {
  const result = regexTest(pattern.value, flags.value, sample.value);
  out.replaceChildren();
  if (!result.ok) {
    count.textContent = '';
    err.textContent = result.err;
    return;
  }
  err.textContent = '';
  const n = result.matches.length;
  count.textContent = n === 1 ? '1 match' : n + ' matches';
  for (const piece of regexPieces(sample.value, result.matches)) {
    out.appendChild(piece.hit ? Object.assign(document.createElement('mark'), { textContent: piece.text }) : document.createTextNode(piece.text));
  }
  const u = new URL(location.href);
  u.searchParams.set('pattern', pattern.value);
  u.searchParams.set('flags', flags.value);
  u.searchParams.set('sample', sample.value);
  history.replaceState(null, '', u);
}

for (const el of [pattern, flags, sample]) el.addEventListener('input', show);
document.querySelector('#copy').addEventListener('click', () => {
  const marks = [...out.querySelectorAll('mark')].map((m) => m.textContent).join('\n');
  navigator.clipboard.writeText(marks).catch(() => {});
});

const q = new URLSearchParams(location.search);
if (q.has('pattern')) pattern.value = q.get('pattern');
if (q.has('flags')) flags.value = q.get('flags');
if (q.has('sample')) sample.value = q.get('sample');
show();
