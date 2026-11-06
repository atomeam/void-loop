// /life-arb/: the owner's private life-arbitrage list (functions/api/life-arb.js). Reads with the owner key kept on this device
// (the same localStorage key the rest of Verse uses for the owner); without it, it asks for the key and shows nothing.
const KEY = 'a2m.void.owner.v1';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const key = () => { try { return localStorage.getItem(KEY) || ''; } catch (_) { return ''; } };
const usd = (c) => (c == null ? '—' : '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: c % 100 ? 2 : 0 }));
const safeUrl = (u) => (/^https:\/\//.test(String(u || '')) ? u : null);
const left = (iso) => {
  if (!iso) return null;
  const ms = Date.parse(iso) - Date.now(), d = Math.floor(ms / 864e5);
  return ms < 0 ? 'closed' : d >= 1 ? d + ' day' + (d === 1 ? '' : 's') + ' left' : Math.max(1, Math.round(ms / 36e5)) + ' h left';
};
let data = null, show = 'open';

async function api(method, body) {
  const r = await fetch('/api/life-arb', { method, headers: { authorization: 'Bearer ' + key(), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401) { $('key').hidden = false; throw new Error('the owner key is missing or wrong'); }
  if (!r.ok) throw new Error('answered ' + r.status);
  return r.json();
}

function card(o) {
  const url = safeUrl(o.url), l = left(o.deadline);
  const chips = [
    o.urgent ? `<li class="urgent">${esc(l)}</li>` : l ? `<li>${esc(l)}</li>` : '',
    `<li class="${o.value_kind === 'cash' ? 'cash' : ''}">${esc(usd(o.value_cents))} · ${esc(o.value_kind)}</li>`,
    o.cost_cents ? `<li>costs ${esc(usd(o.cost_cents))}</li>` : '<li>costs nothing</li>',
    `<li title="${esc(o.minutes_basis)}">~${esc(o.minutes)} min of yours (estimate)</li>`,
    o.per_hour_cents != null ? `<li class="cash">~${esc(usd(o.per_hour_cents))}/hour (estimate)</li>` : '',
    `<li class="${o.risk === 'high' ? 'high' : ''}">risk ${esc(o.risk)}${o.risk_why ? ': ' + esc(o.risk_why) : ''}</li>`,
    `<li>${o.who === 'verse' ? 'Verse does it' : o.who === 'both' ? 'Verse + you' : 'you'}</li>`,
  ].join('');
  return `<li class="opp${o.mark ? ' done' : ''}" data-id="${esc(o.id)}">
    <header><span class="n">${o.rank}</span>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(o.title)}</a>` : `<b>${esc(o.title)}</b>`}<span class="soft">${esc(o.category)}</span></header>
    <ul class="chips">${chips}</ul>
    <p class="ev">${esc(o.evidence)}${o.value_note ? ' ' + esc(o.value_note) + '.' : ''}</p>
    <p class="next"><b>Next:</b> ${esc(o.next_step)}</p>
    ${o.asks && o.asks.length ? `<ul class="asks">${o.asks.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    <div class="row">${o.mark ? `<span class="soft">${esc(o.mark.status)}</span><button data-mark="open">Reopen</button>` : '<button data-mark="done">Took it</button><button data-mark="skipped">Skip</button>'}</div>
  </li>`;
}

function render() {
  if (!data) return;
  const all = data.opportunities || [], open = all.filter((o) => !o.mark);
  const cash = open.filter((o) => o.per_hour_cents != null && o.value_kind === 'cash').sort((a, b) => b.per_hour_cents - a.per_hour_cents)[0];
  $('tiles').innerHTML = [
    [open.length, 'open'], [open.filter((o) => o.urgent).length, 'close within 7 days'],
    [open.filter((o) => o.who !== 'atom').length, 'Verse can start'], [cash ? usd(cash.per_hour_cents) + '/h' : '—', 'best cash per hour (estimate)'],
  ].map(([b, s]) => `<li><b>${esc(b)}</b><span>${esc(s)}</span></li>`).join('');
  const kinds = ['open', 'urgent', 'cash', 'verse', 'done'];
  $('filters').innerHTML = kinds.map((k) => `<button data-show="${k}" aria-pressed="${k === show}">${{ open: 'Open', urgent: 'Closing soon', cash: 'Cash', verse: 'Verse can start', done: 'Taken or skipped' }[k]}</button>`).join(''); // void-review: ok (the labels and keys are the constants above; nothing from the API goes in)
  const pick = { open: (o) => !o.mark, urgent: (o) => !o.mark && o.urgent, cash: (o) => !o.mark && o.value_kind === 'cash', verse: (o) => !o.mark && o.who !== 'atom', done: (o) => !!o.mark }[show];
  const list = all.filter(pick);
  $('opps').innerHTML = list.length ? list.map(card).join('') : '<li class="soft">Nothing here.</li>'; // void-review: ok (card() passes every field from the API through esc(), and links only through safeUrl())
  $('sources').innerHTML = Object.entries(data.sources || {}).map(([k, v]) => `<li><b>${esc(v.count)}</b><span>${esc(k)}: ${esc(v.state)}</span></li>`).join('');
  $('gaps').innerHTML = (data.gaps || []).map((g) => `<li class="opp"><b>${esc(g.what)}</b><p class="ev">${esc(g.why)}</p><p class="next">${esc(g.ask)}</p></li>`).join('');
  $('status').textContent = 'Scanned ' + new Date(data.as_of).toLocaleString() + (data.queued && data.queued.length ? ' · ' + data.queued.length + ' job(s) handed to Verse\'s queue' : '');
}

async function load() {
  if (!key()) { $('key').hidden = false; $('status').textContent = 'Owner key needed.'; return; }
  try { data = await api('GET'); $('key').hidden = true; render(); } catch (e) { $('status').innerHTML = '<span class="bad">' + esc(e.message) + '</span>'; }
}

$('save').addEventListener('click', () => { try { localStorage.setItem(KEY, $('k').value.trim()); } catch (_) {} $('k').value = ''; load(); });
$('scan').addEventListener('click', async () => {
  $('status').textContent = 'Scanning…';
  try { const r = await api('POST', { action: 'scan' }); if (r.ran === false) $('status').textContent = 'Scanned recently; next scan after ' + new Date(r.next_after).toLocaleTimeString() + '.'; else { await load(); } } catch (e) { $('status').innerHTML = '<span class="bad">' + esc(e.message) + '</span>'; }
});
$('filters').addEventListener('click', (e) => { const b = e.target.closest('[data-show]'); if (b) { show = b.dataset.show; render(); } });
$('opps').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-mark]'); if (!b) return;
  const id = b.closest('[data-id]').dataset.id;
  try { await api('POST', { action: 'mark', id, status: b.dataset.mark }); const o = data.opportunities.find((x) => x.id === id); if (o) o.mark = b.dataset.mark === 'open' ? null : { status: b.dataset.mark }; render(); } catch (err) { $('status').textContent = err.message; }
});
load();
