// Verse's status, the pure half (a-to-mind.com/autopilot/#status, functions/api/status.js; /status/ opens it). Owner, 2026-11-03: build our own
// version of the paid tools we never used (an uptime monitor and its status page). The history is the hourly guards Verse already runs
// (automations/hourly.json, lib/automations-run.js): each check is a watch.check record in void_actions. Only these fixed guards are read,
// and only a yes/no and a time leave the server: never a record's text.
export const GUARDS = Object.freeze([
  { id: 'hourly-site-up', name: 'a-to-mind.com', what: 'the home page answers and says Verse', page: true },
  { id: 'hourly-mcp-tools', name: 'MCP tools', what: 'other AIs can still find ask_void in /tools.json', page: true },
  { id: 'hourly-films-page', name: 'Films', what: 'VERSE FILMS is live', page: true },
  { id: 'hourly-main-green', name: 'Main CI', what: 'the full suite on main passes (GitHub badge)', page: false },
  { id: 'hourly-deploy-green', name: 'Deploys', what: 'deploys of main pass (GitHub badge)', page: false },
]);
export const HISTORY = 24;
export const WINDOW_MS = 7 * 864e5;

/** one watch.check record -> 'up' | 'down' | 'unknown'. A guard's watch MATCHes when the thing it guards broke. A failed check on a page
 * guard means the page did not answer (down); on a GitHub badge it means GitHub did not answer (unknown, not our outage). Pure. */
export function stateOf(row, guard) {
  if (!row) return 'unknown';
  if (row.state === 'done') return /^MATCH\b/.test(String(row.result || '')) ? 'down' : 'up';
  if (row.state === 'failed') return guard && guard.page ? 'down' : 'unknown';
  return 'unknown'; // running, deferred (the far side asked us to wait), stubbed
}

/** rows: [{ ref, state, result, started }] newest first, any guards -> the public summary. Pure. */
export function summarize(rows, now = Date.now()) {
  const since = now - WINDOW_MS;
  const guards = GUARDS.map((g) => {
    const mine = (rows || []).filter((r) => r && r.ref === g.id && Date.parse(r.started) >= since);
    const states = mine.map((r) => ({ at: r.started, s: stateOf(r, g) }));
    const up = states.filter((x) => x.s === 'up').length, down = states.filter((x) => x.s === 'down').length;
    const last = states[0] || null;
    return { id: g.id, name: g.name, what: g.what, checks: states.length, up, down, uptime: up + down ? Math.round((up / (up + down)) * 10000) / 100 : null,
      now: last ? last.s : 'unknown', lastAt: last ? last.at : null, history: states.slice(0, HISTORY).reverse().map((x) => x.s[0]) }; // u/d/u…, oldest first
  });
  const known = guards.filter((g) => g.now !== 'unknown');
  return { at: new Date(now).toISOString(), windowDays: 7, overall: !known.length ? 'unknown' : known.some((g) => g.now === 'down') ? 'degraded' : 'up', guards };
}

/** the probes a visitor's own browser times on the status panel: what it is (a page people open or an API other code calls), method,
 * path, and what a good answer is (2xx; a POST with a body must answer JSON-RPC with a result; `key` = the JSON answer must carry it).
 * Every one is a cheap read: no model call, no write, nothing that costs a visitor's or Verse's quota. */
export const PROBES = Object.freeze([
  { kind: 'page', name: 'Home', path: '/', method: 'GET' },
  { kind: 'page', name: 'Calculator', path: '/calculator/', method: 'GET' },
  { kind: 'page', name: 'Converter', path: '/convert/', method: 'GET' },
  { kind: 'page', name: 'Colour', path: '/color/', method: 'GET' },
  { kind: 'page', name: 'Brain', path: '/brain/', method: 'GET' },
  { kind: 'page', name: 'Store', path: '/store/', method: 'GET' },
  { kind: 'page', name: 'Fix an automation', path: '/fix/', method: 'GET' },
  { kind: 'page', name: 'Team chat', path: '/team/', method: 'GET' },
  { kind: 'api', name: 'MCP endpoint', path: '/api/mcp', method: 'POST', body: '{"jsonrpc":"2.0","id":1,"method":"ping"}' },
  { kind: 'api', name: 'Tools for AIs', path: '/tools.json', method: 'GET', key: 'tools' },
  { kind: 'api', name: 'Skills index', path: '/skills/index.json', method: 'GET' },
  { kind: 'api', name: 'Self-check', path: '/api/selfcheck', method: 'GET' },
  { kind: 'api', name: 'Status', path: '/api/status', method: 'GET', key: 'guards' },
  { kind: 'api', name: 'Incident log', path: '/incidents.json', method: 'GET' },
  { kind: 'api', name: 'Changelog feed', path: '/growth.atom', method: 'GET' },
]);

/** the probes' results [{ ok, ms }] -> the line over them: how many answered, and the median time of those that did. Pure. */
export function probeSummary(results) {
  const r = (results || []).filter(Boolean), ok = r.filter((x) => x.ok), ms = ok.map((x) => x.ms).filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  const median = ms.length ? (ms.length % 2 ? ms[(ms.length - 1) / 2] : Math.round((ms[ms.length / 2 - 1] + ms[ms.length / 2]) / 2)) : null;
  return { total: r.length, ok: ok.length, down: r.length - ok.length, median, all: r.length > 0 && ok.length === r.length };
}
