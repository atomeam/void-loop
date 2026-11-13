import { diffTexts, withContext, MAX_LINES } from '/lib/textdiff.js';
import { diffSummary } from '/lib/text-diff-page.js';

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

function show() {
  diff.replaceChildren();
  const rows = diffTexts(original.value, changed.value);
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

for (const box of [original, changed]) box.addEventListener('input', show);
document.querySelector('#copy').addEventListener('click', () => {
  const rows = diffTexts(original.value, changed.value);
  if (rows.tooLong) return;
  const summary = diffSummary(rows);
  const body = summary.same ? summary.line : summary.line + '\n' + comparisonText(rows);
  navigator.clipboard.writeText(body).catch(() => {});
});

const q = new URLSearchParams(location.search);
if (q.has('original')) original.value = q.get('original');
if (q.has('changed')) changed.value = q.get('changed');
if (!diff.querySelector('[data-t]')) show();
