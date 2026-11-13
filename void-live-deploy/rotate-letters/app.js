import { reverseShift, rotateLetters, shiftPlaces } from '/lib/versus.js';

const form = document.querySelector('form');
const out = document.querySelector('#out');
const map = document.querySelector('#map');
const wordbit = document.querySelector('#wordbit');

function run() {
  const n = shiftPlaces(form.shift.value);
  if (form.shift.value !== String(n)) form.shift.value = String(n);
  const result = rotateLetters(form.text.value, n);
  out.value = result;
  const alphabet = rotateLetters('ABCDEFGHIJKLMNOPQRSTUVWXYZ', n);
  map.textContent = 'A goes to ' + alphabet[0] + ', and Z goes to ' + alphabet[25] + '.';
  wordbit.textContent = (result.match(/[A-Za-z]+/) || [''])[0];
  const u = new URL(location.href);
  if (form.text.value) {
    u.searchParams.set('text', form.text.value);
    u.searchParams.set('shift', String(n));
  } else {
    u.searchParams.delete('text');
    u.searchParams.delete('shift');
  }
  history.replaceState(null, '', u);
}

function show() {
  run();
  document.dispatchEvent(new Event('input'));
}

form.addEventListener('input', show);
form.addEventListener('change', show);
const copyNote = document.querySelector('#copyNote');
document.querySelector('#copy').addEventListener('click', () => {
  const text = out.textContent || '';
  navigator.clipboard.writeText(text).then(() => { copyNote.textContent = 'Copied.'; }).catch(() => { copyNote.textContent = 'The result is in the box above. Select it and copy it from there.'; });
});
document.querySelector('#back').addEventListener('click', () => {
  form.text.value = out.textContent || '';
  form.shift.value = String(reverseShift(form.shift.value));
  show();
});

const q = new URLSearchParams(location.search);
if (q.has('text')) form.text.value = q.get('text');
if (q.has('shift')) form.shift.value = q.get('shift');
run();
