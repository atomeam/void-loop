import { explainCron, nextRuns } from '/lib/dev-tools.js';

const line = document.querySelector('#line');
const say = document.querySelector('#say');
const next = document.querySelector('#next');
const err = document.querySelector('#err');

const clock = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
};

function show() {
  const explained = explainCron(line.value);
  next.replaceChildren();
  const times = explained.ok ? nextRuns(line.value, new Date(), 5) : [];
  if (!explained.ok) {
    say.textContent = '';
    err.textContent = explained.err;
  } else {
    err.textContent = '';
    say.textContent = explained.text;
    for (const when of times) {
      const li = document.createElement('li');
      li.textContent = clock(when);
      next.appendChild(li);
    }
  }
  const gap = document.querySelector('#gap');
  if (gap) {
    if (times.length >= 2) {
      const mins = Math.max(1, Math.round((times[1] - times[0]) / 60000));
      gap.textContent = mins % 60 === 0 ? (mins / 60) + ' hours in minutes' : mins + ' minutes in hours';
    } else gap.textContent = '';
  }
  const u = new URL(location.href);
  u.searchParams.set('line', line.value);
  history.replaceState(null, '', u);
  const share = document.querySelector('#share');
  share.href = u.pathname + u.search;
  share.textContent = share.href;
}

function fields() {
  const bits = line.value.trim().split(/\s+/);
  return bits.length === 5 && !line.value.trim().startsWith('@') ? bits : null;
}

function selectField(index) {
  const bits = fields();
  if (!bits) return;
  const start = bits.slice(0, index).join(' ').length + (index ? 1 : 0);
  line.focus();
  line.setSelectionRange(start, start + bits[index].length);
}

function putSymbol(symbol) {
  const bits = fields();
  const start = line.selectionStart, end = line.selectionEnd;
  if (bits && start !== end) {
    const next = line.value.slice(0, start) + symbol + line.value.slice(end);
    line.value = next;
    const at = start + symbol.length;
    line.setSelectionRange(at, at);
  } else if (bits) {
    const index = bits.findIndex((_, i) => {
      const from = bits.slice(0, i).join(' ').length + (i ? 1 : 0);
      return start >= from && start <= from + bits[i].length;
    });
    const i = index < 0 ? 0 : index;
    bits[i] = (bits[i] === '*' ? symbol : bits[i] + symbol);
    line.value = bits.join(' ');
    selectField(i);
  }
  show();
}

const SAMPLES = ['*/15 * * * *', '0 0 * * *', '0 9 * * 1-5', '0 12 * * 0', '30 8 1 * *', '@hourly', '@daily'];
document.querySelector('#random').addEventListener('click', () => {
  const now = line.value.trim();
  const rest = SAMPLES.filter((s) => s !== now);
  line.value = rest[Math.floor(Math.random() * rest.length)];
  show();
});
document.querySelector('#copy').addEventListener('click', () => {
  const done = () => { err.textContent = 'Copied.'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(line.value).then(done).catch(done);
  else done();
});
for (const button of document.querySelectorAll('[data-field]')) button.addEventListener('click', () => selectField(Number(button.dataset.field)));
for (const button of document.querySelectorAll('[data-symbol]')) button.addEventListener('click', () => putSymbol(button.dataset.symbol));

line.addEventListener('input', show);
const q = new URLSearchParams(location.search);
if (q.has('line')) line.value = q.get('line');
show();
