// What can the Cloudflare tokens CI already holds read? (usage meter in the owner view, frontier "metabolism"). Report-only: it prints one line per
// token and capability, never the token itself, and always exits 0. Run by .github/workflows/cf-scope.yml (workflow_dispatch) with the repo's secrets.
//   node tools/cf-scope.mjs            reads CLOUDFLARE_API_TOKEN, CLOUDFLARE_WORKERS_TOKEN, CLOUDFLARE_ANALYTICS_TOKEN (a read-only token with Account Analytics: Read, for the usage meter) and CLOUDFLARE_ACCOUNT_ID from the environment
//   node tools/cf-scope.mjs --json
import { pathToFileURL } from 'node:url';
const API = 'https://api.cloudflare.com/client/v4';
const day = (d) => d.toISOString().slice(0, 10);

const QUERIES = {
  'analytics: Workers requests (GraphQL)': (id, from, to) => `{ viewer { accounts(filter: {accountTag: "${id}"}) { workersInvocationsAdaptive(limit: 1, filter: {date_geq: "${from}", date_leq: "${to}"}) { sum { requests } } } } }`,
  'analytics: Workers AI neurons (GraphQL)': (id, from, to) => `{ viewer { accounts(filter: {accountTag: "${id}"}) { aiInferenceAdaptiveGroups(limit: 1, filter: {date_geq: "${from}", date_leq: "${to}"}) { sum { totalNeurons } } } } }`,
  'analytics: D1 rows read (GraphQL)': (id, from, to) => `{ viewer { accounts(filter: {accountTag: "${id}"}) { d1AnalyticsAdaptiveGroups(limit: 1, filter: {date_geq: "${from}", date_leq: "${to}"}) { sum { rowsRead } } } } }`,
};

const short = (s) => String(s || '').replace(/\s+/g, ' ').slice(0, 120);

// one answer from the API → { ok, note }; "ok" only when Cloudflare returned data and no error
export function judge(status, body) {
  const errs = ((body && body.errors) || []).filter(Boolean);
  if (status === 200 && body && body.data && !errs.length) return { ok: true, note: 'readable' };
  const e = errs[0];
  if (e) return { ok: false, note: short((e.extensions && e.extensions.code ? e.extensions.code + ': ' : '') + (e.message || e.code)) };
  return { ok: false, note: 'HTTP ' + status };
}

export async function probe(env, fetcher = fetch, now = new Date()) {
  const rows = [], id = env.CLOUDFLARE_ACCOUNT_ID;
  const tokens = [['CLOUDFLARE_API_TOKEN', env.CLOUDFLARE_API_TOKEN], ['CLOUDFLARE_WORKERS_TOKEN', env.CLOUDFLARE_WORKERS_TOKEN], ['CLOUDFLARE_ANALYTICS_TOKEN', env.CLOUDFLARE_ANALYTICS_TOKEN]];
  const to = day(now), from = day(new Date(now.getTime() - 2 * 864e5));
  const call = async (token, path, body) => {
    try {
      const res = await fetcher(API + path, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined });
      let j = null; try { j = await res.json(); } catch (_) {}
      return { status: res.status, body: j };
    } catch (e) { return { status: 0, body: { errors: [{ message: 'network: ' + short(e && e.message) }] } }; }
  };
  for (const [name, token] of tokens) {
    if (!token) { rows.push({ token: name, check: 'present', ok: false, note: 'not set in this environment' }); continue; }
    if (!id) { rows.push({ token: name, check: 'account id', ok: false, note: 'CLOUDFLARE_ACCOUNT_ID is not set' }); continue; }
    const v = await call(token, '/accounts/' + id + '/tokens/verify');
    const u = v.status === 200 && v.body && v.body.success ? v : await call(token, '/user/tokens/verify');
    rows.push({ token: name, check: 'token verifies', ...(u.body && u.body.success && u.body.result && u.body.result.status === 'active' ? { ok: true, note: 'active' } : judge(u.status, u.body)) });
    for (const [check, q] of Object.entries(QUERIES)) {
      const r = await call(token, '/graphql', { query: q(id, from, to) });
      rows.push({ token: name, check, ...judge(r.status, r.body) });
    }
    const d1 = await call(token, '/accounts/' + id + '/d1/database?per_page=1');
    rows.push({ token: name, check: 'D1 databases (list)', ...(d1.status === 200 && d1.body && d1.body.success ? { ok: true, note: 'readable' } : judge(d1.status, d1.body)) });
  }
  const meter = rows.filter((r) => /GraphQL/.test(r.check) && r.ok), checked = rows.some((r) => /GraphQL/.test(r.check));
  return { rows, usageMeter: !checked ? 'not checked: no Cloudflare token and account id in this environment' : meter.length ? 'can read analytics with ' + [...new Set(meter.map((r) => r.token))].join(', ') : 'no token here can read analytics: the missing scope is Account Analytics: Read (use the Workers AI usage headers meanwhile)' };
}

export function format(report) {
  return report.rows.map((r) => (r.ok ? 'ok     ' : 'NO     ') + r.token + ' / ' + r.check + (r.note ? '  (' + r.note + ')' : '')).join('\n') + '\n\nusage meter: ' + report.usageMeter;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = await probe(process.env);
  console.log(process.argv.includes('--json') ? JSON.stringify(report, null, 2) : format(report));
}
