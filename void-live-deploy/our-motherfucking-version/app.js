import { weigh } from '/lib/versus.js';
const box = document.querySelector('#html'), out = document.querySelector('#out');
const show = () => { const w = weigh(box.value); out.textContent = box.value ? w.bytes + ' bytes · ' + w.images + ' pictures · ' + w.fonts + ' font requests · ' + w.scripts + ' scripts' : ''; };
box.addEventListener('input', show);
const q = new URLSearchParams(location.search).get('html');
if (q) { box.value = q; show(); }
