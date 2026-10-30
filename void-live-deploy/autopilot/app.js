// a-to-mind.com/autopilot/: what Verse did on its own, read live (functions/api/autopilot.js, /api/coder, /incidents.json).
// A source that does not answer says so where its number would be; nothing here is estimated or filled in.
import { mountRelated } from '/lib/toolkit.js';
import { incidentsIn } from '/lib/autopilot.js';

const $ = (id) => document.getElementById(id);
const KIND = { fix: 'fixed', build: 'built', assimilate: 'assimilated', measure: 'measured', watch: 'watched', revert: 'took back', other: 'did' };
const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('en-US') : '?');
const when = (iso) => { try { return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }); } catch (_) { return iso; } };
const ago = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60e3); return !Number.isFinite(m) ? '' : m < 1 ? 'just now' : m < 60 ? m + ' min ago' : Math.round(m / 60) + ' h ago'; };
let days = 1; try { if (new URLSearchParams(location.search).get('days') === '7') days = 7; } catch (_) {}

async function get(url) { const r = await fetch(url, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
const tile = (id, v, why) => { const el = $(id); el.textContent = v == null ? 'n/a' : fmt(v); el.title = v == null ? (why || 'this source did not answer') : ''; };

function coderPanel(c) {
  const box = $('coder'); box.textContent = '';
  if (!c || !c.day) { box.innerHTML = '<span class="note">The coder\'s budget did not answer just now.</span>'; return; }
  const full = c.room === false, pct = Math.min(100, Math.round((c.day.used / Math.max(1, c.day.cap)) * 100));
  const p = document.createElement('p'); p.style.margin = '0';
  p.innerHTML = '<b>' + fmt(c.day.used) + '</b> of ' + fmt(c.day.cap) + ' calls today, <b>' + fmt(c.hour.used) + '</b> of ' + fmt(c.hour.cap) + ' this hour';
  const m = document.createElement('div'); m.className = 'meter' + (full ? ' full' : ''); m.innerHTML = '<i style="width:' + pct + '%"></i>';
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
  for (const [k, n] of Object.entries(d.kinds || {}).sort((a, b) => b[1] - a[1])) { const c = document.createElement('span'); c.className = 'chip'; c.innerHTML = '<b>' + fmt(n) + '</b> '; c.append(KIND[k] || k); kinds.append(c); }
  if (d.merged) { const c = document.createElement('span'); c.className = 'chip'; c.innerHTML = '<b>' + fmt(d.merged) + '</b> '; c.append('pull requests its auto-merge landed'); kinds.append(c); }
  const own = Array.isArray(d.own) ? d.own : [];
  if (!own.length) { const li = document.createElement('li'); li.innerHTML = '<span class="kind">quiet</span><span class="note">Verse\'s own loops landed nothing on main in this window. Its coder and conductor numbers above say why.</span>'; ul.append(li); return; }
  for (const c of own.slice(0, 60)) {
    const li = document.createElement('li'), k = document.createElement('span'); k.className = 'kind ' + (c.kind === 'assimilate' ? 'build' : c.kind === 'watch' ? 'measure' : c.kind); k.textContent = KIND[c.kind] || c.kind;
    const body = document.createElement('span'), a = document.createElement('a'); a.href = c.url; a.rel = 'noopener'; a.textContent = c.title;
    const t = document.createElement('span'); t.className = 'when'; t.textContent = when(c.at) + ' · ' + c.sha.slice(0, 7);
    body.append(a, t); li.append(k, body); ul.append(li);
  }
  if (own.length > 60) { const li = document.createElement('li'); li.innerHTML = '<span class="kind">more</span><span class="note">' + fmt(own.length - 60) + ' more in the window: every one is in main\'s history on GitHub.</span>'; ul.append(li); }
}

async function load() {
  for (const b of document.querySelectorAll('[data-days]')) b.setAttribute('aria-pressed', String(Number(b.dataset.days) === days));
  $('t-own').nextElementSibling.textContent = 'changes Verse landed on its own (' + (days === 1 ? '24 h' : '7 days') + ')';
  $('t-deploys').nextElementSibling.textContent = 'deploys to a-to-mind.com (' + (days === 1 ? '24 h' : '7 days') + ')';
  const [ap, coder, inc] = await Promise.allSettled([get('/api/autopilot?days=' + days), get('/api/coder'), get('/incidents.json')]);
  const d = ap.status === 'fulfilled' ? ap.value : null, src = (d && d.sources) || {};
  tile('t-own', d && src.commits === 'ok' ? d.ownCount : null, 'GitHub did not answer: ' + (src.commits || 'no reply'));
  tile('t-deploys', d && src.deploys === 'ok' ? d.deploys : null);
  tile('t-reverts', d && src.commits === 'ok' ? ((d.kinds || {}).revert || 0) : null);
  tile('t-started', d && d.conductor && d.conductor.last24h ? d.conductor.last24h.started : null);
  const since = Date.now() - days * 86400e3;
  if (inc.status === 'fulfilled') { const i = incidentsIn(inc.value.incidents, since); tile('t-open', i.open); $('t-open').nextElementSibling.textContent = 'open incidents on main' + (i.healed ? ' (' + i.healed + ' healed, median ' + i.medianMinutes + ' min)' : ''); } else tile('t-open', null);
  coderPanel(coder.status === 'fulfilled' ? coder.value : null);
  if (d && d.conductor) {
    hourBars(d.conductor.byHour || new Array(24).fill(0), d.conductor.updated);
    const held = $('held'); held.textContent = '';
    const c = d.conductor.last24h || {};
    for (const [n, label] of [[c.requeued, 'requeued after a failed run'], [c.probes, 'probes of a loop'], [d.conductor.held, 'held right now'], [d.conductor.broken, 'loops it found broken']]) {
      if (!Number.isFinite(n)) continue; const s = document.createElement('span'); s.className = 'chip'; s.innerHTML = '<b>' + fmt(n) + '</b> '; s.append(label); held.append(s);
    }
    for (const why of d.conductor.heldWhy || []) { const s = document.createElement('span'); s.className = 'chip'; s.textContent = 'Held: ' + why; held.append(s); }
  } else { $('bars').innerHTML = ''; $('held').innerHTML = '<span class="err">The conductor\'s record did not answer: ' + (src.conductor || 'no reply') + '.</span>'; }
  if (d && src.commits === 'ok') { feed(d); if (d.complete === false) $('feed').insertAdjacentHTML('beforeend', '<li><span class="kind">cut</span><span class="note">The window held more commits than one read takes; the newest are shown.</span></li>'); }
  else $('feed').innerHTML = '<li><span class="kind">n/a</span><span class="err">Main\'s history did not answer just now (' + (src.commits || (ap.reason && ap.reason.message) || 'no reply') + '). Nothing is shown instead of a guess.</span></li>';
  $('asof').textContent = d ? 'Read ' + ago(d.read) + (d.cached ? ' (cached up to 10 min)' : '') : '';
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
load();
