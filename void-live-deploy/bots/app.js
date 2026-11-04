// /bots/: every live bot from bots/registry.json, each one runnable here in the browser (bots/kit.js; grown bots are pipelines of kit bots)
import { BOT, compose } from '/bots/kit.js';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const reg = await fetch('/bots/registry.json', { cache: 'no-cache' }).then((r) => r.json());
const live = reg.bots.filter((b) => b.status === 'live'), cats = ['all', ...new Set(live.map((b) => b.cat))];
$('sum').textContent = live.length + ' bots live, every one passing its probe' + (reg.failed ? ' · ' + reg.failed + ' failing and not counted' : '') + '.';
const runner = (b) => (b.pipe ? compose({ ...b, probe: { in: '' } }) : BOT(b.id));
const from = (f) => f.map((x) => (x.startsWith('bots/') ? '<a href="#' + esc(x.slice(5)) + '">' + esc(x.slice(5)) + '</a>' : esc(x))).join(', ');
function draw(cat) {
  $('cats').innerHTML = cats.map((c) => '<button type="button" data-c="' + esc(c) + '" aria-pressed="' + (c === cat) + '">' + esc(c) + '</button>').join('');
  $('grid').innerHTML = live.filter((b) => cat === 'all' || b.cat === cat).map((b) => '<article class="bot" id="' + esc(b.id) + '"><h2>' + esc(b.id) + ' <span class="ok">✓ probe passed</span></h2><small>' + esc(b.cat) + ' · ' + esc(b.job) + '</small><small>built from: ' + from(b.from) + '</small><textarea rows="2" aria-label="Input for ' + esc(b.id) + '">' + esc(b.probe.in) + '</textarea><button type="button" data-run="' + esc(b.id) + '">Run</button><output>' + esc(b.probe.out) + '</output></article>').join('');
}
$('cats').addEventListener('click', (e) => { const c = e.target.dataset && e.target.dataset.c; if (c) draw(c); });
$('grid').addEventListener('click', (e) => {
  const id = e.target.dataset && e.target.dataset.run; if (!id) return;
  const card = e.target.closest('.bot'), b = live.find((x) => x.id === id);
  try { card.querySelector('output').textContent = String(runner(b).run(card.querySelector('textarea').value)); } catch (err) { card.querySelector('output').textContent = 'That input did not work: ' + err.message; }
});
draw('all');
if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
