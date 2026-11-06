// /brain/'s first view (owner, 2026-11-03: "make it into a more functional usable brain"): what Verse knows, searchable, light and 2D. The
// wants it holds now (/api/will, live), every skill with what it does and the page it powers, every tool page, every site Versus took on and
// what came of it, the lessons its model recalls when it proposes a fix, and what it did lately: brain/knows.json (tools/brain-knows.mjs).
// The simulation (app.js, map.js, dreams.js: twenty-four organs, a canvas and a map) loads only when asked for, with "Watch it think",
// ?view=watch or ?t=words, so the first view costs one small module and one file instead of 50 modules and two animation loops.
import { KINDS, LABEL, wantsOf, search, countsOf, hrefOf } from '/lib/brain-knows.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const PAGE = 40;
let items = [], kind = params.get('k') || 'all', query = params.get('find') || '', shown = PAGE, watching = false;

const knows = $('#knows'), list = $('#kList'), chips = $('#kChips'), box = $('#kFind'), sum = $('#kSum'), more = $('#kMore'), watchBtn = $('#watchBtn');
if (!KINDS.some(([k]) => k === kind)) kind = 'all';

/** the simulation, imported once (its modules start the brain the moment they load) */
const watch = () => {
  if (watching) return; watching = true;
  document.body.classList.remove('knows-on'); knows.hidden = true;
  watchBtn.textContent = 'What it knows'; watchBtn.setAttribute('aria-pressed', 'true');
  const u = new URL(location.href); if (!u.searchParams.has('t')) u.searchParams.set('view', 'watch'); u.searchParams.delete('find'); u.searchParams.delete('k'); history.replaceState(null, '', u);
  import('/brain/app.js').then(() => import('/brain/map.js')).then(() => import('/brain/dreams.js')).then(() => { document.body.dataset.ready = '1'; }).catch((e) => { document.body.dataset.watchError = String(e && e.message || e).slice(0, 120); });
};
watchBtn.addEventListener('click', () => { if (watching) location.assign('/brain/'); else watch(); }); // back to Knows is a fresh page: the simulation's loops end with it

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
const when = (at) => { const t = Date.parse(at); return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : ''; };

function row(it) {
  const li = el('li', 'k-item k-' + it.k), a = el('a', 'k-t', it.t); a.href = hrefOf(it);
  if (/^https?:/.test(a.href) && !a.href.startsWith(location.origin)) { a.target = '_blank'; a.rel = 'noopener'; }
  const head = el('div', 'k-head'); head.append(el('span', 'k-tag', it.got ? LABEL.got : LABEL[it.k] || it.k), a);
  if (it.st) head.append(el('span', 'k-st', it.st)); if (it.tier) head.append(el('span', 'k-st', it.tier));
  li.append(head);
  if (it.d) li.append(el('p', 'k-d', it.d));
  if (it.withLine) li.append(el('p', 'k-with', it.withLine));
  const foot = [];
  if (it.k === 'skill' && it.ex && it.ex.length) foot.push(['Try', '/?q=' + encodeURIComponent(it.ex[0]), '“' + it.ex[0] + '”']);
  if (it.k === 'site' && it.u) foot.push(['Page', it.u, it.u]);
  if (it.k === 'site' && it.src) foot.push(['Site', it.src, it.src.replace(/^https?:\/\//, '').replace(/\/$/, '')]);
  if (it.k === 'page') foot.push(['Ask', '/?q=' + encodeURIComponent(it.t.split(':')[0]), 'ask Verse instead']);
  const date = when(it.at);
  if (foot.length || date) {
    const f = el('p', 'k-f');
    for (const [label, href, text] of foot) { const x = el('a', null, text); x.href = href; if (/^https?:/.test(href)) { x.target = '_blank'; x.rel = 'noopener'; } f.append(label + ' ', x, ' '); }
    if (date) f.append(el('span', 'k-at', date));
    li.append(f);
  }
  return li;
}

function draw() {
  const hits = search(items, query, kind), counts = countsOf(items, query);
  chips.replaceChildren(...KINDS.filter(([k]) => k === 'all' || k === kind || counts[k]).map(([k, name]) => { // a kind with nothing to show is no chip
    const b = el('button', 'k-chip', name + ' ' + (counts[k] || 0)); b.type = 'button'; b.setAttribute('aria-pressed', String(k === kind));
    b.addEventListener('click', () => { kind = k; shown = PAGE; sync(); draw(); }); return b;
  }));
  list.replaceChildren(...hits.slice(0, shown).map(row));
  if (!hits.length) {
    const li = el('li', 'k-none'), a = el('a', null, 'Ask Verse about “' + query + '”'); a.href = '/?q=' + encodeURIComponent(query);
    li.append(items.length ? 'Nothing it knows matches that. ' : 'Still reading what it knows… ', query ? a : ''); list.append(li);
  }
  sum.textContent = hits.length + (hits.length === 1 ? ' thing' : ' things') + (query ? ' match “' + query + '”' : '') + (kind !== 'all' ? ' in ' + KINDS.find(([k]) => k === kind)[1].toLowerCase() : '');
  more.hidden = hits.length <= shown; more.textContent = 'Show ' + Math.min(PAGE, hits.length - shown) + ' more of ' + (hits.length - shown);
  $('#kAsk').href = query ? '/?q=' + encodeURIComponent(query) : '/';
  document.body.dataset.knowsReady = items.length ? '1' : '0';
}

const sync = () => { const u = new URL(location.href); if (query) u.searchParams.set('find', query); else u.searchParams.delete('find'); if (kind !== 'all') u.searchParams.set('k', kind); else u.searchParams.delete('k'); history.replaceState(null, '', u); };
let t = 0;
box.value = query;
box.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { query = box.value.trim(); shown = PAGE; sync(); draw(); }, 80); });
$('#kForm').addEventListener('submit', (e) => { e.preventDefault(); query = box.value.trim(); sync(); draw(); const first = list.querySelector('a.k-t'); if (first && search(items, query, kind).length === 1) location.assign(first.href); });
more.addEventListener('click', () => { shown += PAGE; draw(); });

if (params.get('view') === 'watch' || params.has('t')) watch();
else {
  document.body.classList.add('knows-on'); knows.hidden = false; draw();
  const file = fetch('/brain/knows.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const will = fetch('/api/will').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  file.then((j) => {
    if (!j) { $('#kNote').textContent = 'What it knows could not be read just now; the search comes back on a reload.'; return; }
    items = [...items.filter((x) => x.k === 'want'), ...(j.items || [])];
    if (j.builtWith) $('#kNote').textContent = j.builtWith + (j.builtWith === 1 ? ' skill built with skills' : ' skills built with skills');
    draw();
  });
  will.then((w) => { const ws = wantsOf(w); if (ws.length) { items = [...ws, ...items.filter((x) => x.k !== 'want')]; draw(); } $('#kWill').textContent = w && w.at ? 'Wants chosen ' + new Date(w.at).toLocaleString() : ''; });
}
