import { parseTracks } from '/lib/versus.js';
const box = document.querySelector('#list'), out = document.querySelector('#out'), total = document.querySelector('#total');
const run = () => {
  const p = parseTracks(box.value);
  out.textContent = p.text;
  total.textContent = p.rows.length ? p.rows.length + ' tracks, ' + p.clock(p.total) + ' in all' : '';
  const u = new URL(location.href); u.searchParams.set('list', box.value); history.replaceState(null, '', u);
};
box.addEventListener('input', run);
document.querySelector('#copy').addEventListener('click', () => navigator.clipboard.writeText(out.textContent || box.value).catch(() => {}));
const q = new URLSearchParams(location.search).get('list');
if (q) box.value = q;
run();
