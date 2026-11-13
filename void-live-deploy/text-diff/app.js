import { diffTexts, withContext, MAX_LINES } from '/lib/textdiff.js';
import { diffSummary, foldText } from '/lib/text-diff-page.js';

const original = document.querySelector('#original');
const changed = document.querySelector('#changed');
const say = document.querySelector('#say');
const diff = document.querySelector('#diff');
const err = document.querySelector('#err');

const mark = { del: '−', add: '+', same: ' ' };

function line(row) {
  const el = document.createElement('div');
  el.dataset.t = row.t;
  if (row.t === 'skip') {
    el.textContent = '⋯ ' + row.n + ' unchanged line' + (row.n === 1 ? '' : 's');
    return el;
  }
  const num = document.createElement('span');
  num.textContent = String(row.t === 'add' ? row.b : row.a);
  const sign = document.createElement('span');
  sign.textContent = mark[row.t];
  const text = document.createElement('span');
  text.textContent = row.s;
  el.append(num, sign, text);
  return el;
}

export function comparisonText(rows) {
  return withContext(rows).map((r) => {
    if (r.t === 'skip') return '⋯ ' + r.n + ' unchanged';
    const n = String(r.t === 'add' ? r.b : r.a).padStart(4, ' ');
    return n + ' ' + mark[r.t] + ' ' + r.s;
  }).join('\n');
}

function mode() {
  return { lower: document.querySelector('#fold-case').checked, space: document.querySelector('#fold-space').checked };
}
function show() {
  diff.replaceChildren();
  const rows = diffTexts(foldText(original.value, mode()), foldText(changed.value, mode()));
  if (rows.tooLong) {
    say.textContent = '';
    err.textContent = 'Up to ' + MAX_LINES + ' lines on a side.';
    return;
  }
  err.textContent = '';
  const summary = diffSummary(rows);
  say.textContent = summary.line;
  if (!summary.same) for (const row of withContext(rows)) diff.append(line(row));
}

for (const box of [original, changed, document.querySelector('#fold-case'), document.querySelector('#fold-space')]) box.addEventListener('input', show);
document.querySelector('#fold-case').addEventListener('change', () => { show(); paintShare(); });
document.querySelector('#fold-space').addEventListener('change', () => { show(); paintShare(); });
function loadFile(input, box) {
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { box.value = String(reader.result || ''); box.dispatchEvent(new Event('input', { bubbles: true })); };
    reader.readAsText(file);
  });
}
loadFile(document.querySelector('#file-original'), original);
loadFile(document.querySelector('#file-changed'), changed);
const share = document.querySelector('#share');
function paintShare() {
  const u = new URL(location.href);
  u.searchParams.set('original', original.value);
  u.searchParams.set('changed', changed.value);
  if (document.querySelector('#fold-case').checked) u.searchParams.set('case', '1'); else u.searchParams.delete('case');
  if (document.querySelector('#fold-space').checked) u.searchParams.set('space', '1'); else u.searchParams.delete('space');
  share.href = u.pathname + u.search;
  share.textContent = u.pathname + u.search;
}
original.addEventListener('input', paintShare);
changed.addEventListener('input', paintShare);
document.querySelector('#copy').addEventListener('click', () => {
  const rows = diffTexts(foldText(original.value, mode()), foldText(changed.value, mode()));
  if (rows.tooLong) return;
  const summary = diffSummary(rows);
  const body = summary.same ? summary.line : summary.line + '\n' + comparisonText(rows);
  navigator.clipboard.writeText(body).catch(() => {});
});

const q = new URLSearchParams(location.search);
if (q.has('original')) original.value = q.get('original');
if (q.has('changed') || q.has('text') || q.has('q')) changed.value = q.get('changed') || q.get('text') || q.get('q');
if (q.get('case') === '1') document.querySelector('#fold-case').checked = true;
if (q.get('space') === '1') document.querySelector('#fold-space').checked = true;
if (!diff.querySelector('[data-t]')) show();
paintShare();
