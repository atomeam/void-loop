// /progress/: the outcome exam's latest run and history (tools/exam.mjs writes /exam/latest.json and /exam/history.json).
// An external file, so the page needs no inline-script hash in the CSP rule budget (tools/csp-hashes.mjs).
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const cls = (n) => n == null ? '' : n >= 70 ? 'hi' : n < 40 ? 'low' : '';
function chart(history) {
  const runs = (history || []).slice(-16);
  if (runs.length < 2) return '';
  const W = 640, H = 88, names = ['podcasts', 'songs', 'videos'];
  const x = (i) => (i / (runs.length - 1)) * (W - 8) + 4, y = (v) => H - 10 - (Math.max(0, v) / 100) * (H - 18);
  const line = (name) => runs.map((r, i) => x(i).toFixed(1) + ',' + y((r.domains && r.domains[name] && r.domains[name].score) || 0).toFixed(1)).join(' ');
  const strokes = ['#ff8d84', '#ffbe5a', '#7ddeaf'];
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="podcast, song and video scores over ' + runs.length + ' runs">'
    + names.map((n, i) => '<polyline points="' + line(n) + '" fill="none" stroke="' + strokes[i] + '" stroke-width="2"/>').join('')
    + '</svg><p class="note">Podcasts, songs, then videos, oldest run on the left. A line moves only when that domain’s exam moves.</p>';
}
function row(name, d) {
  const h = d && d.holdout, hs = h ? (h.score == null ? '—' : h.score + (h.fresh === false ? '*' : '')) : '—';
  return '<tr><th>' + esc(name) + '</th><td class="num ' + cls(d && d.score) + '">' + esc(d && d.score != null ? d.score : '—') + '</td><td class="num">' + esc(hs) + '</td><td class="num">' + esc(d ? (d.measured + '/' + d.of) : '—') + '</td><td class="num">' + esc(d && d.fails ? d.fails.length : '—') + '</td></tr>';
}
Promise.all([fetch('/exam/latest.json').then((r) => r.json()), fetch('/exam/history.json').then((r) => r.json()).catch(() => [])]).then(([latest, history]) => {
  const when = document.getElementById('when');
  when.textContent = 'Run ' + (latest.at || '').replace('T', ' ').slice(0, 16) + ' UTC against ' + (latest.against || 'live') + (latest.scale ? ', scale ' + latest.scale : '') + '. Lowest: ' + (latest.lowest ? latest.lowest.domain + ' at ' + latest.lowest.score : '—') + '. A star on a holdout score means it was not remeasured this run.';
  document.getElementById('chart').innerHTML = chart(history);
  const body = document.getElementById('rows'), fails = document.getElementById('fails');
  body.innerHTML = Object.entries(latest.domains || {}).map(([k, v]) => row(k, v)).join('');
  fails.innerHTML = Object.entries(latest.domains || {}).map(([k, v]) => {
    const list = (v.fails || []).slice(0, 8);
    if (!list.length) return '';
    return '<h3>' + esc(k) + '</h3><ul class="fails">' + list.map((f) => '<li>' + esc(f.ask) + ' <span class="note">(' + esc((f.failed || []).join(', ')) + ')</span></li>').join('') + '</ul>';
  }).join('') || '<p class="note">Nothing failed the checks that were measured.</p>';
}).catch(() => { const when = document.getElementById('when'); if (when) when.textContent = 'No domain exam is published yet.'; });
fetch('/progress/exam.json', { cache: 'no-cache' }).then((r) => r.json()).then((j) => {
  const cases = (j && j.cases) || [], failed = cases.filter((c) => !c.ok);
  const sum = document.getElementById('fixed');
  if (sum) sum.textContent = failed.length ? 'Regressed: ' + failed.map((c) => c.ask).join('; ') : 'No regression. ' + cases.length + ' fixed asks hold. A pull request that makes one fail is not merged.';
  const list = document.getElementById('fixed-list');
  if (!list) return;
  list.textContent = '';
  for (const c of cases) {
    const li = document.createElement('li');
    const mark = document.createElement('span');
    mark.className = c.ok ? 'hi' : 'low';
    mark.textContent = c.ok ? 'holds' : 'regressed';
    li.appendChild(mark);
    li.appendChild(document.createTextNode(' · ' + String(c.ask || '')));
    list.appendChild(li);
  }
}).catch(() => { const sum = document.getElementById('fixed'); if (sum) sum.textContent = 'The fixed asks did not load.'; });
fetch('/progress/nightly.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
  const main = document.querySelector('main'); if (!main) return;
  const h = document.createElement('h2'); h.textContent = 'Last night';
  const p = document.createElement('p'); p.className = 'note'; p.id = 'night';
  if (!j || !j.share) p.textContent = 'No nightly note yet.';
  else p.textContent = String(j.at || '').slice(0, 10) + ': Verse\'s loop authored ' + (j.share.share == null ? 'no measured share of' : j.share.share + '% of') + ' merged pulls against outside agents. Next: ' + ((j.pick && j.pick.why) || 'nothing picked') + '.';
  main.append(h, p);
}).catch(() => {});
const LANES = ['links', 'health', 'speed', 'twins', 'plain', 'fresh', 'seo', 'coverage', 'deps', 'handoff', 'next-tool', 'leaks', 'cards', 'tower', 'deploy', 'quality', 'home'];
const money = (c) => c === null ? 'Treasury, not metered per call.' : (c > 0 ? c + ' cents from the treasury.' : 'Nothing from the treasury.');
function mountLoops() {
  const main = document.querySelector('main');
  const before = document.getElementById('fails');
  if (!main || document.getElementById('loops')) return;
  const h = document.createElement('h2'); h.textContent = 'What Verse is doing';
  const note = document.createElement('p'); note.className = 'note';
  note.textContent = 'Each row is one job Verse runs on its own. A model is used only when a sentence has to be written, the free ones first. The treasury pays only after those are used up, and only when it holds a month of the stronger model. The minutes on each row, once a day, are the Actions time. This public repo is not billed for standard runner minutes.';
  const table = document.createElement('table');
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  for (const label of ['Loop', 'Last result', 'Status', 'Cost']) { const th = document.createElement('th'); th.textContent = label; hr.appendChild(th); }
  head.appendChild(hr);
  const body = document.createElement('tbody'); body.id = 'loops';
  const wait = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 4; td.textContent = 'Reading the loops.'; wait.appendChild(td); body.appendChild(wait);
  table.appendChild(head); table.appendChild(body);
  const anchor = before ? before.previousElementSibling : null;
  if (anchor && anchor.parentNode === main) main.insertBefore(table, anchor), main.insertBefore(note, table), main.insertBefore(h, note);
  else main.append(h, note, table);
  return body;
}
const loopsBody = mountLoops();
Promise.all(LANES.map((id) => fetch('/progress/loops/' + id + '.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : null).catch(() => null))).then((rows) => {
  const body = loopsBody || document.getElementById('loops');
  if (!body) return;
  body.textContent = '';
  for (const id of LANES) {
    const row = rows[LANES.indexOf(id)];
    const tr = document.createElement('tr');
    const cells = row ? [row.name, row.last || 'Nothing recorded yet.', row.status, (row.cost && row.cost.minutes != null ? 'About ' + row.cost.minutes + ' minutes. ' : '') + money(row.cost && row.cost.paidCents) + ' ' + ((row.cost && row.cost.note) || '')] : [id, 'Nothing recorded yet.', 'Waiting for its first run.', 'Nothing from the treasury.'];
    for (const text of cells) { const cell = document.createElement('td'); cell.textContent = text; tr.appendChild(cell); }
    body.appendChild(tr);
  }
}).catch(() => {});
// the owner's compounding row (tools/tower-compound.mjs): the file is owner-only, so a visitor gets a 404 and the box stays hidden
fetch('/tower.compound.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((c) => import('/lib/compound.js').then((m) => {
  const box = document.getElementById('compound'); if (!c || !c.last || !box) return;
  box.querySelector('p').textContent = c.last.at + ': ' + m.sayRow(c.last); box.hidden = false;
})).catch(() => {});
