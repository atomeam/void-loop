// /bots/: every live bot in one searchable list, built in the browser: the hand-made and grown bots in bots/registry.json, every family
// variant from bots/families.js (thousands, so only one page of cards is drawn at a time), and Verse's free site tools from /tools.json
// (listed once: a tool whose name matches a bot is not listed twice). Every bot card runs its bot here on what the visitor types.
import { BOT, compose } from '/bots/kit.js';
const $ = (id) => document.getElementById(id), PER = 48;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const norm = (s) => String(s).toLowerCase().replace(/^skill_/, '').replace(/[^a-z0-9]/g, '');
const reg = await fetch('/bots/registry.json', { cache: 'no-cache' }).then((r) => r.json());
const all = reg.bots.filter((b) => b.status === 'live').map((b) => ({ ...b, run: b.pipe ? compose({ ...b, probe: { in: '' } }).run : BOT(b.id).run, sample: b.probe.in, said: b.probe.out }));
try { const { families, check } = await import('/bots/families.js'); for (const b of families()) if (check(b).ok) all.push({ ...b, cat: b.cat, sample: '1', said: '' }); } catch (_) { /* families not deployed yet */ }
const seen = new Set(all.map((b) => norm(b.id)));
try { const t = await fetch('/tools.json').then((r) => r.json()); for (const x of (t.mcp && t.mcp.tools) || []) if (!seen.has(norm(x.name))) { seen.add(norm(x.name)); all.push({ id: x.name, cat: 'site tools', job: x.title || x.description, from: ['/tools.json (MCP at /api/mcp)'], tool: true }); } } catch (_) { /* no tool list */ }
const counts = all.reduce((m, b) => ((m[b.cat] = (m[b.cat] || 0) + 1), m), {}), cats = ['all', ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];
const S = { cat: 'all', q: '', page: 0 };
try { const u = new URLSearchParams(location.search); S.q = u.get('q') || ''; S.cat = cats.includes(u.get('cat')) ? u.get('cat') : 'all'; } catch (_) { /* plain address */ }
$('q').value = S.q;
$('sum').textContent = all.length.toLocaleString() + ' bots live, every one passing its checks' + (reg.failed ? ' · ' + reg.failed + ' failing and not counted' : '') + (reg.held ? ' · ' + reg.held + ' held for a judge' : '') + '.';
const from = (f) => (f || []).map((x) => (x.startsWith('bots/') ? '<a href="?q=' + esc(x.slice(5)) + '">' + esc(x.slice(5)) + '</a>' : esc(x))).join(', ');
const list = () => { const q = S.q.trim().toLowerCase(), words = q.split(/\s+/).filter(Boolean); return all.filter((b) => (S.cat === 'all' || b.cat === S.cat) && words.every((w) => (b.id + ' ' + b.job + ' ' + (b.family || '')).toLowerCase().includes(w))); };
const card = (b) => '<article class="bot" id="' + esc(b.id) + '"><h2>' + esc(b.id) + (b.tool ? ' <span class="ok">free site tool</span>' : ' <span class="ok">✓ checks passed</span>') + '</h2><small>' + esc(b.family || b.cat) + ' · ' + esc(b.job) + '</small><small>built from: ' + from(b.from) + '</small>'
  + (b.tool ? '<small>Call it over MCP at /api/mcp, or ask Verse on the home page.</small>' : '<textarea rows="2" aria-label="Input for ' + esc(b.id) + '">' + esc(b.sample) + '</textarea><button type="button" data-run="' + esc(b.id) + '">Run</button><output>' + esc(b.said) + '</output>') + '</article>';
function draw() {
  const L = list(), pages = Math.max(1, Math.ceil(L.length / PER)); S.page = Math.min(S.page, pages - 1);
  $('cats').innerHTML = cats.map((c) => '<button type="button" data-c="' + esc(c) + '" aria-pressed="' + (c === S.cat) + '">' + esc(c) + ' ' + (c === 'all' ? all.length : counts[c]).toLocaleString() + '</button>').join('');
  $('grid').innerHTML = L.slice(S.page * PER, S.page * PER + PER).map(card).join('') || '<p class="muted">No bot does that yet. Verse adds bots for missed searches.</p>';
  $('page').textContent = L.length.toLocaleString() + ' bots · page ' + (S.page + 1) + ' of ' + pages; $('prev').disabled = S.page === 0; $('next').disabled = S.page >= pages - 1;
  history.replaceState(null, '', '?' + new URLSearchParams({ ...(S.q ? { q: S.q } : {}), ...(S.cat !== 'all' ? { cat: S.cat } : {}) }) + location.hash);
}
$('cats').addEventListener('click', (e) => { const c = e.target.closest('[data-c]'); if (c) { S.cat = c.dataset.c; S.page = 0; draw(); } });
let t = 0; $('q').addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { S.q = $('q').value; S.page = 0; draw(); }, 150); });
$('find').addEventListener('submit', (e) => e.preventDefault());
$('prev').addEventListener('click', () => { S.page--; draw(); scrollTo(0, 0); }); $('next').addEventListener('click', () => { S.page++; draw(); scrollTo(0, 0); });
$('grid').addEventListener('click', (e) => {
  const id = e.target.dataset && e.target.dataset.run; if (!id) return;
  const el = e.target.closest('.bot'), b = all.find((x) => x.id === id);
  try { el.querySelector('output').textContent = String(b.run(el.querySelector('textarea').value)); } catch (err) { el.querySelector('output').textContent = 'That input did not work: ' + err.message; }
});
if (location.hash) { S.q = location.hash.slice(1); $('q').value = S.q; }
draw();
