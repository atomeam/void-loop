/**
 * delivery-board skill — a client-visible board that aggregates ownership, progress, monitors and next handoff
 * for systems Verse owns so the client does less chasing and delivery stays reliable.
 * Its progress is read live from /api/status and /incidents.json (client-status-pack's readings); nothing is sent.
 * It is one family with client-status-pack (skills/client-status.js, lists run 18).
 * "delivery board for the onboarding flow", "client board on invoice reminders",
 * "show the delivery board for the support router".
 */
import { statusView, incidentView } from './client-status-pack.js';

export function isDeliveryBoard(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:delivery|client)\s+board\b/i.test(t)
    || /^(?:show|make|generate|create)\s+(?:a\s+|the\s+)?(?:delivery|client)\s+board\b/i.test(t)
    || /^(?:delivery\s+board)\s+(?:for|of|on)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the systems';
}

/** the board's fixed parts: what Verse owns and the next handoff. Progress is never written here: it is read live (progressOf). Pure. */
export function boardFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    owns: [
      'Design, build and connect the systems',
      'Run the monitors and alerts (monitor-pack)',
      'Own the verification (verify-pack)',
      'Package status, docs and handoff'
    ],
    monitors: ['The guards behind /api/status', 'The incident log (/incidents.json)'],
    nextHandoff: 'The full delivery pack, and this board whenever the client asks for it'
  };
}

/** progress from the same live readings as the client status pack (lists run 18): the guards' overall state and the open incidents,
 * or the reason a reading is missing. Nothing is filled in for a source that did not answer. Pure. */
export function progressOf(statusBody, statusError, incidentsBody, incidentsError) {
  const st = statusView(statusBody, statusError), inc = incidentView(incidentsBody, incidentsError);
  const guards = st.rows.length ? 'Guards: ' + st.overall + ' (' + st.rows.length + ' watched)' : 'Guards: ' + st.overall + (st.note ? ', ' + st.note : '');
  const incidents = inc.available ? 'Incident log: ' + inc.open + ' open' : 'Incident log: ' + inc.note;
  return { overall: st.overall, lines: [guards, incidents] };
}

async function readJson(url, fetchFn) {
  try { const r = await fetchFn(url, { cache: 'no-cache' }); if (!r || !r.ok) return { error: 'answered HTTP ' + ((r && r.status) || 0) }; return { body: await r.json() }; }
  catch (_) { return { error: 'did not answer' }; }
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const name = subjectOf(text);
  const board = boardFor(text);
  const fetchFn = typeof api.fetch === 'function' ? api.fetch : ((u, o) => fetch(u, o));
  const [status, incidents] = await Promise.all([readJson('/api/status', fetchFn), readJson('/incidents.json', fetchFn)]);
  const progress = progressOf(status.body, status.error ? 'the status API ' + status.error : '', incidents.body, incidents.error ? 'the incident log ' + incidents.error : '');
  showPage((el) => {
    const owns = board.owns.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Delivery board: ' + esc(name) + '</h2>'
      + '<p class="sub">Ownership, progress, monitors and the next handoff in one place, so the client does less chasing.</p>'
      + '<h3>What Verse owns</h3><ul>' + owns + '</ul>'
      + '<h3>Progress</h3><ul>' + progress.lines.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<div class="src">Source: GET /api/status and /incidents.json, the same readings as the client status pack</div>'
      + '<h3>Monitors</h3><ul>' + board.monitors.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Next handoff</h3><p>' + esc(board.nextHandoff) + '</p>'
      + '<p class="sub">Nothing is invented as already done. A reading that did not answer is named.</p>';
  });
  return 'delivery-board';
}

export const builtWith = ['progress-report', 'ownership-pack', 'monitor-pack', 'system-status', 'delivery-pack'];
export default {
  name: 'delivery-board',
  examples: [
    'delivery board for the onboarding flow',
    'client board on invoice reminders',
    'show the delivery board for the support router',
    'make a delivery board for weekly status reports'
  ],
  nearMisses: [
    'what is a board',
    'status board',
    'progress report',
    'delivery pack'
  ],
  match: (low, raw) => isDeliveryBoard(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isDeliveryBoard) && !this.nearMisses.some(isDeliveryBoard);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
