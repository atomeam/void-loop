/**
 * client-status-pack skill — a client handoff of the status Verse already stores.
 * Reads GET /api/status (the same guards as the systems monitor), /incidents.json,
 * and, when the ask names an address, the browser check system-status uses.
 * A source that does not answer is named. No state is filled in for it.
 * "status pack for onboarding", "client status for the invoice bot", "handoff status pack"
 */
import { parseIncidents } from '../lib/autopsy.js';
import { ping } from './status.js';
import { addressOf } from './system-status.js';
import { boardOf } from './systems-monitor.js';

export function isClientStatusPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t) return false;
  if (/^(?:client\s+)?status\s+(?:pack|package|report)\b/i.test(t)) return true;
  if (/^client\s+status\s+(?:for|of)\b/i.test(t)) return true;
  if (/^(?:make|generate|show)\s+(?:a\s+)?(?:client\s+)?status\s+(?:pack|package|report)\b/i.test(t)) return true;
  if (/^handoff\s+status(?:\s+pack)?\b/i.test(t)) return true;
  return false;
}

/** the system the ask names, or the systems Verse owns. Pure. */
export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the systems Verse owns';
}

/** /api/status, or the reason it could not be read. A missing answer is never up. Pure. */
export function statusView(body, error) {
  if (error) return { overall: 'unknown', rows: [], note: String(error) };
  return boardOf(body);
}

/** /incidents.json: open count and the newest rows, or why the log could not be read. Pure. */
export function incidentView(body, error) {
  if (error) return { available: false, note: String(error), open: null, recent: [] };
  const raw = Array.isArray(body) ? body : (body && typeof body === 'object' && Array.isArray(body.incidents) ? body.incidents : null);
  if (!raw) return { available: false, note: 'the incident log had no incident list', open: null, recent: [] };
  const list = parseIncidents(body);
  return {
    available: true,
    note: list.length ? '' : 'no red suite in the incident log',
    open: list.filter((i) => !i.closedAt).length,
    recent: list.slice(0, 3).map((i) => ({
      at: i.at.slice(0, 25),
      sha: i.sha.slice(0, 7),
      suite: i.suite || 'a suite on main',
      checks: i.checks.length,
      closed: !!i.closedAt,
    })),
  };
}

/** a named address checked with system-status's ping, or an honest gap when the ask names none. Pure. */
export function namedView(subject, pingResult) {
  const url = addressOf(subject);
  if (!url) return { kind: 'none', url: '', ms: null, note: 'Verse has no live signal for this name, so no state is shown for it' };
  if (!pingResult) return { kind: 'unavailable', url, ms: null, note: 'the address was not checked' };
  if (pingResult.ok) return { kind: 'reachable', url, ms: Number.isFinite(pingResult.ms) ? Math.round(pingResult.ms) : null, note: '' };
  return { kind: 'unreachable', url, ms: null, note: pingResult.note || 'did not answer' };
}

/** the three readings the card may show. Pure. */
export function packOf({ subject, statusBody, statusError, incidentsBody, incidentsError, pingResult }) {
  return {
    subject: subject || 'the systems Verse owns',
    status: statusView(statusBody, statusError),
    incidents: incidentView(incidentsBody, incidentsError),
    named: namedView(subject, pingResult),
  };
}

export function packHtml(esc, view) {
  const e = (s) => esc(s == null ? '' : s);
  const status = view.status;
  const guards = status.rows.length
    ? '<p>Overall: <b>' + e(status.overall) + '</b>.</p><table><thead><tr><th>Guard</th><th>Now</th><th>What it watches</th></tr></thead><tbody>'
      + status.rows.map((g) => '<tr><td>' + e(g.name) + '</td><td>' + e(g.now) + '</td><td>' + e(g.what) + '</td></tr>').join('')
      + '</tbody></table>'
    : '<p>Overall: <b>' + e(status.overall) + '</b>. ' + e(status.note || 'No guard state is shown.') + '</p>';
  const inc = view.incidents;
  const incidents = !inc.available || !inc.recent.length
    ? '<p>' + e(inc.note) + '</p>'
    : '<p>' + e(String(inc.open)) + ' open in the log.</p><ul>'
      + inc.recent.map((i) => '<li>' + e(i.suite) + ': ' + e(String(i.checks)) + (i.checks === 1 ? ' check' : ' checks') + (i.closed ? ', closed' : ', open') + ' · ' + e(i.sha) + ' · ' + e(i.at) + '</li>').join('')
      + '</ul>';
  const n = view.named;
  const named = n.kind === 'none'
    ? '<p>' + e(n.note) + ' (' + e(view.subject) + ').</p>'
    : n.kind === 'reachable'
      ? '<p><b>Reachable</b>: ' + e(n.url) + ' answered this browser' + (n.ms == null ? '' : ' in ' + e(String(n.ms)) + ' ms') + '.</p>'
      : '<p><b>Not reachable</b>: ' + e(n.url) + ' ' + e(n.note) + '.</p>';
  return '<h2>Client status: ' + e(view.subject) + '</h2>'
    + '<p>Verse owns design, build, connect, test and monitor. The client owns the outcome and any final approval.</p>'
    + '<h3>Systems Verse watches</h3>' + guards
    + '<div class="src">Source: GET /api/status, the same reading as the systems monitor</div>'
    + '<h3>Incident log</h3>' + incidents
    + '<div class="src">Source: /incidents.json</div>'
    + '<h3>Named system</h3>' + named
    + '<div class="src">Source: ' + (n.kind === 'none' ? 'no signal connected' : 'a request from this browser, the same check as system status') + '</div>'
    + '<p class="sub">Nothing on this card is invented. A source that did not answer is named, and no state is filled in for it.</p>';
}

async function readJson(url, fetchFn) {
  try {
    const r = await fetchFn(url, { cache: 'no-cache' });
    if (!r || !r.ok) return { error: 'answered HTTP ' + ((r && r.status) || 0) };
    return { body: await r.json() };
  } catch (_) {
    return { error: 'did not answer' };
  }
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const subject = subjectOf(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Client status pack</h2><div class="sub">reading /api/status and the incident log…</div>'; });
  const fetchFn = typeof api.fetch === 'function' ? api.fetch : ((u, o) => fetch(u, o));
  const [status, incidents] = await Promise.all([readJson('/api/status', fetchFn), readJson('/incidents.json', fetchFn)]);
  const url = addressOf(subject);
  let pingResult = null;
  if (url) {
    const reach = typeof api.reach === 'function' ? api.reach : ((u, o) => fetchFn(u, { ...o, mode: 'no-cors' }).then(() => ({ ok: true, status: 0 })));
    try { pingResult = await ping({ name: subject, for: 'client status', url }, reach); }
    catch (_) { pingResult = { ok: false, note: 'could not be reached from this browser' }; }
  }
  el.innerHTML = packHtml(esc, packOf({
    subject,
    statusBody: status.body,
    statusError: status.error ? 'the status API ' + status.error : '',
    incidentsBody: incidents.body,
    incidentsError: incidents.error ? 'the incident log ' + incidents.error : '',
    pingResult,
  }));
  return 'client-status-pack';
}

export const builtWith = ['systems-monitor', 'system-status'];
export default {
  name: 'client-status-pack',
  examples: [
    'status pack for onboarding',
    'client status for the invoice bot',
    'handoff status pack',
    'make a client status pack for the support router',
  ],
  nearMisses: [
    'what is the status',
    'status of the build',
    'system status',
    'systems monitor',
    'system status for the onboarding flow',
    'client handoff for the onboarding automation',
    'monitor pack for client onboarding',
    'handoff pack for my idea',
  ],
  match(lower, text) { return isClientStatusPack(text || lower); },
  run,
};
