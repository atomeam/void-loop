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
  if (!explained.ok) {
    say.textContent = '';
    err.textContent = explained.err;
  } else {
    err.textContent = '';
    say.textContent = explained.text;
    for (const when of nextRuns(line.value, new Date(), 3)) {
      const li = document.createElement('li');
      li.textContent = clock(when);
      next.appendChild(li);
    }
  }
  const u = new URL(location.href);
  u.searchParams.set('line', line.value);
  history.replaceState(null, '', u);
}

line.addEventListener('input', show);
const q = new URLSearchParams(location.search);
if (q.has('line')) line.value = q.get('line');
show();
