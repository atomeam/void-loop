// /scoreboard/: live, measured numbers only. Each card reads one public source; a source that fails or is empty shows "no data yet".
const esc = (s) => String(s == null ? '' : s);
const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
// built with the DOM and textContent, so no source text is ever parsed as HTML
const card = (label, value, sub, cls) => {
  const d = document.createElement('div'); d.className = 'card';
  const a = document.createElement('span'); a.textContent = label;
  const b = document.createElement('b'); b.className = value == null ? 'note' : (cls || ''); b.textContent = value == null ? 'no data yet' : String(value);
  const c = document.createElement('span'); c.textContent = sub || '';
  d.append(a, b, c); return d;
};
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

async function main() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const [exam, tester, status, evidence, bots, treasury, commits] = await Promise.all([
    get('/exam/latest.json'), get('/tester-log.json'), get('/api/status'), get('/tower.evidence.json'), get('/bots/registry.json'), get('/api/treasury'),
    get('https://api.github.com/repos/atomeam/void-loop/commits?sha=main&per_page=100&since=' + since),
  ]);
  const out = [];
  // exam: tasks asked, score weighted by asks
  if (exam && exam.domains) {
    let asks = 0, w = 0;
    for (const d of Object.values(exam.domains)) { if (d && d.measured) { asks += d.measured; w += (d.score || 0) * d.measured; } }
    out.push(card('Exam tasks measured', asks || null, 'across ' + Object.keys(exam.domains).length + ' domains, ' + esc(new Date(exam.at).toLocaleString())));
    out.push(card('Exam success', asks ? (Math.round((w / asks) * 10) / 10) + '%' : null, 'weighted by tasks; lowest domain: ' + esc((exam.lowest && exam.lowest.domain) || '—')));
  } else { out.push(card('Exam tasks measured', null, '')); }
  // site tester
  if (tester && Array.isArray(tester.runs) && tester.runs.length) {
    const visitor = tester.runs.map((r) => /(\d+)\/(\d+)/.exec(r.note || '')).filter(Boolean);
    const p = visitor.reduce((a, m) => a + +m[1], 0), o = visitor.reduce((a, m) => a + +m[2], 0);
    out.push(card('Site tester runs', tester.runsTotal || tester.runs.length, tester.cases + ' test cases'));
    out.push(card('Visitor checks passed', o ? pct(p, o) + '%' : null, o ? p + ' of ' + o + ' in recent runs' : ''));
  } else { out.push(card('Site tester runs', null, '')); }
  // uptime
  if (status && Array.isArray(status.guards) && status.guards.length) {
    const site = status.guards.find((g) => g.id === 'hourly-site-up') || status.guards[0];
    const up = status.guards.filter((g) => g.now === 'up').length;
    out.push(card('Site uptime (' + status.windowDays + ' days)', site.checks ? site.uptime + '%' : null, site.checks ? site.up + ' of ' + site.checks + ' hourly checks' : '', site.uptime >= 99 ? 'ok' : 'bad'));
    out.push(card('Guards up now', up + ' of ' + status.guards.length, status.guards.filter((g) => g.now !== 'up').map((g) => esc(g.name) + ' down').join(', ') || 'all green', up === status.guards.length ? 'ok' : 'bad'));
  } else { out.push(card('Site uptime', null, '')); }
  // deploys per day
  if (Array.isArray(commits)) {
    out.push(card('Deploys per day (7 days)', commits.length ? (Math.round((commits.length / 7) * 10) / 10) + (commits.length >= 100 ? '+' : '') : null, commits.length + (commits.length >= 100 ? '+' : '') + ' merges to main this week'));
  } else { out.push(card('Deploys per day', null, 'GitHub did not answer')); }
  // head to head
  if (evidence && evidence.floors) {
    const v = {}; for (const f of Object.values(evidence.floors)) for (const a of Object.values(f || {})) { const k = (a && a.verdict) || 'unknown'; v[k] = (v[k] || 0) + 1; }
    const total = Object.values(v).reduce((a, b) => a + b, 0);
    const wins = Object.entries(v).filter(([k]) => ['better', 'equal', 'equal-and-better', 'pass'].includes(k)).reduce((a, [, n]) => a + n, 0);
    out.push(card('Head-to-head checks', total || null, total ? wins + ' even or better, ' + (v.worse || 0) + ' lost, ' + (total - wins - (v.worse || 0)) + ' unproven' : ''));
  } else { out.push(card('Head-to-head checks', null, '')); }
  // bots
  const list = bots && (Array.isArray(bots) ? bots : bots.bots);
  if (Array.isArray(list) && list.length) {
    const passed = list.filter((b) => b.passed === true || b.test === 'pass' || b.status === 'live').length;
    out.push(card('Bots live', passed || list.length, passed ? passed + ' of ' + list.length + ' passed their test' : list.length + ' listed'));
  } else { out.push(card('Bots live', null, '')); }
  // money
  if (treasury && treasury.revenue) {
    const d = (c) => '$' + ((c || 0) / 100).toFixed(2);
    out.push(card('Money in (realized)', treasury.revenue.sales ? d(treasury.revenue.realized_cents) : null, treasury.revenue.sales + ' sales'));
    out.push(card('Money out', treasury.committed_cents ? d(treasury.committed_cents) : null, 'balance ' + d(treasury.balance_cents)));
  } else { out.push(card('Money in', null, '')); }
  document.getElementById('cards').replaceChildren(...out);
}
main();
