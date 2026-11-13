import { factorialOf } from '/lib/factorials.js';

const input = document.querySelector('#n');
const out = document.querySelector('#out');
const err = document.querySelector('#err');

function draw(result) {
  out.replaceChildren();
  err.textContent = '';
  if (!result.ok) {
    err.textContent = result.reason === 'big' ? 'Type a whole number from 0 to 20.' : 'Type a whole number from 0 to 20.';
    return;
  }
  const h = document.createElement('h2');
  h.textContent = result.n + '! = ' + result.value;
  const p = document.createElement('p');
  p.textContent = result.n === 0 ? '0! is 1.' : result.n + '! is the product of every whole number from 1 to ' + result.n + '.';
  out.append(h, p);
}

document.querySelector('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const result = factorialOf(input.value);
  if (result.ok) input.value = String(result.n);
  const u = new URL(location.href);
  u.searchParams.set('n', input.value.trim());
  history.replaceState(null, '', u);
  draw(result);
});

const start = new URLSearchParams(location.search).get('n');
if (start != null && !out.querySelector('h2')) {
  input.value = start;
  draw(factorialOf(start));
} else if (!out.querySelector('h2')) {
  draw(factorialOf(input.value));
}
