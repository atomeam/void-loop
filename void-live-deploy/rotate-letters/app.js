import { rotateLetters } from '/lib/versus.js';
const form = document.querySelector('form'), out = document.querySelector('#out');
const run = () => {
  const n = Math.min(25, Math.max(1, Math.trunc(Number(form.shift.value) || 13)));
  form.shift.value = String(n);
  out.textContent = rotateLetters(form.text.value, n);
  const u = new URL(location.href); u.searchParams.set('text', form.text.value); u.searchParams.set('shift', String(n));
  history.replaceState(null, '', u);
};
form.addEventListener('input', run);
document.querySelector('#copy').addEventListener('click', () => navigator.clipboard.writeText(out.textContent || '').catch(() => {}));
const q = new URLSearchParams(location.search);
if (q.has('text')) form.text.value = q.get('text');
if (q.has('shift')) form.shift.value = q.get('shift');
run();
