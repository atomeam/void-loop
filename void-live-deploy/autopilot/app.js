// a-to-mind.com/autopilot/ (and /status/): Verse's status first (lib/status.js, /api/status), then what Verse did on its own, read live (functions/api/autopilot.js, /api/coder, /incidents.json).
// A source that does not answer says so where its number would be; nothing here is estimated or filled in.
import { mountRelated } from '/lib/toolkit.js';
import { incidentsIn } from '/lib/autopilot.js';
import { PROBES, probeSummary } from '/lib/status.js';

const $ = (id) => document.getElementById(id);
const KIND = { fix: 'fixed', build: 'built', assimilate: 'assimilated', measure: 'measured', watch: 'watched', revert: 'took back', other: 'did' };
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '?');
const when = (iso) => { try { return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }); } catch (_) { return iso; } };
const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60e3); return !Number.isFinite(m) ? '' : m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
let days = 1; try { if (new URLSearchParams(location.search).get('days') === '7') days = 7; } catch (_) {}

async function get(url) { const r = await fetch(url, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const chip = (n, label) => { const c = el('span', 'chip'); c.append(el('b', null, fmt(n)), ' ' + label); return c; };
const line = (kind, cls, text) => { const li = el('li'); li.append(el('span', 'kind', kind), el('span', cls, text)); return li; };
const tile = (id, v, why) => { const el = $(id); el.textContent = v == null ? 'n/a' : fmt(v); el.title = v == null ? (why || 'this source did not answer') : ''; };

function coderPanel(c) {
  const box = $('coder'); box.textContent = '';
  if (!c || !c.day) { box.append(el('span', 'note', 'The coder\'s budget did not answer just now.')); return; }
  const full = c.room === false, pct = Math.min(100, Math.round((c.day.used / Math.max(1, c.day.cap)) * 100));
  const p = document.createElement('p'); p.style.margin = '0';
  p.append(el('b', null, fmt(c.day.used)), ' of ' + fmt(c.day.cap) + ' calls today, ', el('b', null, fmt(c.hour.used)), ' of ' + fmt(c.hour.cap) + ' this hour');
  const m = document.createElement('div'); m.className = 'meter' + (full ? ' full' : ''); const bar = el('i'); bar.style.width = pct + '%'; m.append(bar);
  const n = document.createElement('p'); n.className = 'note'; n.style.margin = '0';
  n.textContent = full ? 'Used up. The conductor holds coding jobs until ' + new Date(c.until).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) + ' instead of starting runs that would only fail.' : 'Room left: coding jobs run as the conductor starts them.';
  if (c.model) n.textContent += ' Model: ' + c.model.replace(/^@cf\//, '') + '.';
  box.append(p, m, n);
}

function hourBars(byHour, updated) {
  const bars = $('bars'); bars.textContent = '';
  const max = Math.max(1, ...byHour);
  byHour.forEach((n, i) => { const b = document.createElement('i'); b.style.height = Math.max(2, Math.round((n / max) * 80)) + 'px'; if (!n) b.className = 'zero'; b.title = n + ' job' + (n === 1 ? '' : 's') + ', ' + (23 - i) + ' h ago'; bars.append(b); });
  bars.setAttribute('aria-label', 'Jobs started each hour, oldest first: ' + byHour.join(', '));
  $('ax0').textContent = '24 h before ' + (updated ? when(updated) : 'now');
}

function feed(d) {
  const ul = $('feed'); ul.textContent = '';
  const kinds = $('kinds'); kinds.textContent = '';
  for (const [k, n] of Object.entries(d.kinds || {}).sort((a, b) => b[1] - a[1])) kinds.append(chip(n, KIND[k] || k));
  if (d.merged) kinds.append(chip(d.merged, 'pull requests its auto-merge landed'));
  const own = Array.isArray(d.own) ? d.own : [];
  if (!own.length) { ul.append(line('quiet', 'note', 'Verse\'s own loops landed nothing on main in this window. Its coder and conductor numbers above say why.')); return; }
  for (const c of own.slice(0, 60)) {
    const li = document.createElement('li'), k = document.createElement('span'); k.className = 'kind ' + (c.kind === 'assimilate' ? 'build' : c.kind === 'watch' ? 'measure' : c.kind); k.textContent = KIND[c.kind] || c.kind;
    const body = document.createElement('span'), a = document.createElement('a'); a.href = c.url; a.rel = 'noopener'; a.textContent = c.title;
    const t = document.createElement('span'); t.className = 'when'; t.textContent = when(c.at) + ' · ' + c.sha.slice(0, 7);
    body.append(a, t); li.append(k, body); ul.append(li);
  }
  if (own.length > 60) ul.append(line('more', 'note', fmt(own.length - 60) + ' more in the window: every one is in main\'s history on GitHub.'));
}

// ---- Status (/status/ opens this): Verse's own hourly guards (/api/status), the pages opened after each deploy (/api/selfcheck), the last
// deploy (the autopilot snapshot's time), incidents, and a few pages timed by this browser now. Nothing is estimated: no answer says so.
const STATE = { up: 'up', down: 'down', unknown: 'no answer' };
function guardRow(g) {
  const row = el('div', 'st'), name = el('span'), dot = el('span', 'dot ' + g.now);
  name.append(dot, g.name); name.title = g.what;
  const now = el('span', g.now === 'down' ? 'bad' : g.now === 'up' ? 'ok' : 'note', STATE[g.now] || g.now);
  if (g.lastAt) now.title = 'checked ' + ago(g.lastAt);
  const hist = el('span', 'hist'); hist.setAttribute('role', 'img');
  hist.setAttribute('aria-label', g.name + ', last ' + g.history.length + ' checks: ' + g.history.map((x) => (x === 'u' ? 'up' : x === 'd' ? 'down' : 'no answer')).join(', '));
  for (let i = 0; i < 24 - g.history.length; i++) hist.append(el('i'));
  for (const x of g.history) hist.append(el('i', x === 'u' ? 'u' : x === 'd' ? 'd' : ''));
  const up = el('span', 'num', g.uptime == null ? 'n/a' : g.uptime + '%'); up.title = g.up + ' up, ' + g.down + ' down of ' + g.checks + ' checks (7 days)';
  row.append(name, now, hist, up);
  return row;
}
async function timeOne(p) {
  const t0 = performance.now();
  try {
    const r = await fetch(p.path, { method: p.method, cache: 'no-store', headers: p.body ? { 'content-type': 'application/json', accept: 'application/json' } : {}, body: p.body, signal: AbortSignal.timeout(8000) });
    const ms = Math.round(performance.now() - t0), ok = r.ok;
    if (p.body) { const j = await r.json().catch(() => null); return { ms, ok: ok && !!(j && j.result) }; }
    if (p.key) { const j = await r.json().catch(() => null); return { ms, ok: ok && !!(j && j[p.key] != null) }; }
    return { ms, ok };
  } catch (_) { return { ms: null, ok: false }; }
}
async function liveSpeed() {
  const box = $('st-live'); const rows = await Promise.all(PROBES.map(async (p) => ({ p, r: await timeOne(p) })));
  box.textContent = '';
  const sum = probeSummary(rows.map((x) => x.r)), head = el('div', 'chips'), chip = el('span', 'chip');
  chip.append(el('span', 'dot ' + (sum.all ? 'up' : 'down')), el('b', null, sum.ok + ' of ' + sum.total + ' answering' + (sum.median == null ? '' : ', median ' + sum.median + ' ms')));
  head.append(chip); box.append(head);
  for (const [kind, title] of [['page', 'Pages'], ['api', 'APIs and feeds']]) {
    const mine = rows.filter((x) => (x.p.kind || 'page') === kind); if (!mine.length) continue;
    box.append(el('h3', 'st-kind', title));
    for (const { p, r } of mine) {
      const row = el('div', 'st'), name = el('span'); name.append(el('span', 'dot ' + (r.ok ? 'up' : 'down')), p.name);
      const path = el('a', 'note', p.method + ' ' + p.path); path.href = p.path;
      row.append(name, el('span', r.ok ? 'ok' : 'bad', r.ok ? 'up' : 'down'), path, el('span', 'num', r.ms == null ? 'n/a' : r.ms + ' ms'));
      box.append(row);
    }
  }
}
async function loadStatus() {
  const [st, sc, ap, inc] = await Promise.allSettled([get('/api/status'), get('/api/selfcheck'), get('/api/autopilot?days=1'), get('/incidents.json')]);
  const head = $('st-head'); head.textContent = '';
  const s = st.status === 'fulfilled' ? st.value : null;
  if (s) {
    const o = el('span', 'chip'); o.append(el('span', 'dot ' + (s.overall === 'up' ? 'up' : s.overall === 'degraded' ? 'down' : '')), el('b', null, s.overall === 'up' ? 'All guards up' : s.overall === 'degraded' ? 'Something is down' : 'No guard has answered yet')); head.append(o);
    $('st-guards').replaceChildren(...s.guards.map(guardRow));
  } else { head.append(el('span', 'err', 'Verse\'s guards did not answer just now.')); }
  const a = ap.status === 'fulfilled' ? ap.value : null, dep = a && (a.snapshotAt || a.keysAt);
  if (dep) { const c = el('span', 'chip'); c.append('Last deploy ', el('b', null, ago(dep))); c.title = new Date(dep).toLocaleString(); head.append(c); }
  const r = sc.status === 'fulfilled' && sc.value && sc.value.report;
  if (r) { const c = el('span', 'chip'); c.append(el('b', null, fmt(r.fine) + ' of ' + fmt(r.checked)), ' pages fine after it'); c.title = 'every page in the sitemap opened in headless Chrome after the deploy ' + ago(r.at); head.append(c); }
  const ul = $('st-inc'); ul.textContent = '';
  const list = inc.status === 'fulfilled' && Array.isArray(inc.value.incidents) ? inc.value.incidents.slice(0, 3) : null;
  if (!list) ul.append(line('n/a', 'err', 'The incident log did not answer just now.'));
  else if (!list.length) ul.append(line('none', 'note', 'No red suite on main in the log.'));
  else for (const i of list) {
    const li = document.createElement('li'), body = el('span'), lk = document.createElement('a'); lk.href = i.run; lk.rel = 'noopener';
    lk.textContent = (i.suite || 'a suite on main') + ': ' + (Array.isArray(i.checks) ? i.checks.length : 0) + ' check' + ((i.checks || []).length === 1 ? '' : 's') + ' red' + (i.healed ? ', healed' : '');
    body.append(lk, el('span', 'when', when(i.at) + ' · ' + String(i.sha || '').slice(0, 7)));
    li.append(el('span', 'kind ' + (i.healed ? 'fix' : 'revert'), i.healed ? 'healed' : 'red'), body); ul.append(li);
  }
  liveSpeed();
}

async function load() {
  for (const b of document.querySelectorAll('[data-days]')) b.setAttribute('aria-pressed', String(Number(b.dataset.days) === days));
  $('t-own').nextElementSibling.textContent = 'changes Verse landed on its own (' + (days === 1 ? '24 h' : '7 days') + ')';
  $('t-deploys').nextElementSibling.textContent = 'deploys to a-to-mind.com (' + (days === 1 ? '24 h' : '7 days') + ')';
  const [ap, coder, inc] = await Promise.allSettled([get('/api/autopilot?days=' + days), get('/api/coder'), get('/incidents.json')]);
  const d = ap.status === 'fulfilled' ? ap.value : null, src = (d && d.sources) || {};
  const read = (k) => src[k] === 'ok' || src[k] === 'snapshot';
  tile('t-own', d && read('commits') ? d.ownCount : null, 'GitHub did not answer: ' + (src.commits || 'no reply'));
  tile('t-deploys', d && read('deploys') ? d.deploys : null);
  tile('t-reverts', d && read('commits') ? ((d.kinds || {}).revert || 0) : null);
  tile('t-started', d && d.conductor && d.conductor.last24h ? d.conductor.last24h.started : null);
  const since = Date.now() - days * 86400e3;
  if (inc.status === 'fulfilled') { const i = incidentsIn(inc.value.incidents, since); tile('t-open', i.open); $('t-open').nextElementSibling.textContent = 'open incidents on main' + (i.healed ? ' (' + i.healed + ' healed, median ' + i.medianMinutes + ' min)' : ''); } else tile('t-open', null);
  // Verse's own keys (tools/key-keeper.mjs, read at the last deploy): how many jobs the keymaster can mint a key for
  const k = d && d.keys;
  if (k && k.keymaster) { const ok = k.jobs.filter((j) => j.ok); $('t-keys').textContent = ok.length + ' of ' + k.jobs.length; $('t-keys').title = ''; $('t-keys').nextElementSibling.textContent = 'jobs Verse mints its own key for' + (ok.length < k.jobs.length ? ' (not yet: ' + k.jobs.filter((j) => !j.ok).map((j) => j.job).join(', ') + ')' : ''); }
  else { $('t-keys').textContent = k ? 'none' : 'n/a'; $('t-keys').title = k ? '' : 'the last deploy did not read the keys'; $('t-keys').nextElementSibling.textContent = k ? 'keys Verse mints: waiting for its one keymaster key' : 'keys Verse mints for itself'; }
  coderPanel(coder.status === 'fulfilled' ? coder.value : null);
  if (d && d.conductor) {
    hourBars(d.conductor.byHour || new Array(24).fill(0), d.conductor.updated);
    const held = $('held'); held.textContent = '';
    const c = d.conductor.last24h || {};
    for (const [n, label] of [[c.requeued, 'requeued after a failed run'], [c.probes, 'probes of a loop'], [d.conductor.held, 'held right now'], [d.conductor.broken, 'loops it found broken']]) {
      if (Number.isFinite(n)) held.append(chip(n, label));
    }
    for (const why of d.conductor.heldWhy || []) { const s = document.createElement('span'); s.className = 'chip'; s.textContent = 'Held: ' + why; held.append(s); }
  } else { $('bars').textContent = ''; $('held').replaceChildren(el('span', 'err', 'The conductor\'s record did not answer: ' + (src.conductor || 'no reply') + '.')); }
  if (d && read('commits')) { feed(d); if (d.complete === false) $('feed').append(line('cut', 'note', 'The window held more commits than one read takes; the newest are shown.')); }
  else $('feed').replaceChildren(line('n/a', 'err', 'Main\'s history did not answer just now (' + (src.commits || (ap.reason && ap.reason.message) || 'no reply') + '). Nothing is shown instead of a guess.'));
  $('asof').textContent = d ? 'Read ' + ago(d.read) + (d.cached ? ' (cached up to 10 min)' : '') + (d.snapshotAt ? '; main\'s history as of the deploy ' + ago(d.snapshotAt) : '') : '';
}

for (const b of document.querySelectorAll('[data-days]')) b.addEventListener('click', () => {
  days = Number(b.dataset.days) === 7 ? 7 : 1;
  try { const u = new URL(location.href); if (days === 7) u.searchParams.set('days', '7'); else u.searchParams.delete('days'); history.replaceState(null, '', u); } catch (_) {}
  load();
});

mountRelated($('related'), '/autopilot/', [
  { label: 'Share this window', run: () => { try { navigator.clipboard.writeText(location.href); return 'Link copied'; } catch (_) { return ''; } } },
  { label: 'Every merged change in the ledger', href: () => '/ledger/?repo=atomeam%2Fvoid-loop&tab=pr&state=merged' },
  { label: 'Verse Brain', href: () => '/brain/' },
  { label: 'Team chat: give Verse work', href: () => '/team/' },
]);
loadStatus();
load();
