import { regexReport } from '/lib/dev-tools.js';

const pattern = document.querySelector('#pattern');
const flags = document.querySelector('#flags');
const sample = document.querySelector('#sample');
const replace = document.querySelector('#replace');
const count = document.querySelector('#count');
const out = document.querySelector('#out');
const err = document.querySelector('#err');
const matchlist = document.querySelector('#matchlist');
const passed = document.querySelector('#passed');
const explain = document.querySelector('#explain');
const replaced = document.querySelector('#replaced');
const share = document.querySelector('#share');
const boxes = [...document.querySelectorAll('#flag-i, #flag-m, #flag-s, #flag-u')];
const idle = 'Nothing is rewritten until you type a replacement. $& stands for the whole match, and $1 stands for the first saved group.';

function syncBoxes() {
  const on = new Set(flags.value.split(''));
  for (const box of boxes) box.checked = on.has(box.value);
}

function show() {
  syncBoxes();
  const report = regexReport(pattern.value, flags.value, sample.value, replace.value);
  out.replaceChildren();
  matchlist.replaceChildren();
  explain.replaceChildren();
  const u = new URL(location.href);
  u.searchParams.set('pattern', pattern.value);
  u.searchParams.set('flags', flags.value);
  u.searchParams.set('sample', sample.value);
  if (replace.value) u.searchParams.set('replace', replace.value);
  else u.searchParams.delete('replace');
  share.href = u.pathname + u.search;
  share.textContent = u.pathname + u.search;
  history.replaceState(null, '', u);
  if (!report.ok) {
    count.textContent = '';
    err.textContent = report.err;
    passed.textContent = '';
    replaced.textContent = '';
    return;
  }
  err.textContent = '';
  count.textContent = report.count;
  for (const piece of report.pieces) {
    out.appendChild(piece.hit ? Object.assign(document.createElement('mark'), { textContent: piece.text }) : document.createTextNode(piece.text));
  }
  for (const line of report.matchLines) matchlist.appendChild(Object.assign(document.createElement('li'), { textContent: line }));
  passed.textContent = report.passed;
  for (const line of report.explain) explain.appendChild(Object.assign(document.createElement('li'), { textContent: line }));
  replaced.textContent = replace.value ? report.replaced : idle;
}

for (const el of [pattern, flags, sample, replace]) el.addEventListener('input', show);
for (const box of boxes) box.addEventListener('change', () => {
  const on = new Set(flags.value.replace(/[^imsu]/g, '').split('').filter(Boolean));
  if (box.checked) on.add(box.value);
  else on.delete(box.value);
  flags.value = ['i', 'm', 's', 'u'].filter((f) => on.has(f)).join('') + flags.value.replace(/[imsu]/g, '');
  flags.dispatchEvent(new Event('input', { bubbles: true }));
});
document.querySelector('#copy').addEventListener('click', () => {
  const text = passed.textContent || '';
  navigator.clipboard.writeText(text).catch(() => {});
});

const q = new URLSearchParams(location.search);
if (q.has('pattern')) pattern.value = q.get('pattern');
if (q.has('flags')) flags.value = q.get('flags');
if (q.has('sample')) sample.value = q.get('sample');
if (q.has('replace')) replace.value = q.get('replace');
show();
document.dispatchEvent(new Event('input'));
