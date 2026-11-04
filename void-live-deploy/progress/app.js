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
