/**
 * status-digest skill: a client-visible digest of the systems Verse owns, so the client does no chasing.
 * "status digest for the invoice automation", "client digest: onboarding flow", "weekly status for my systems".
 * It is one family with client-status-pack and delivery-board (skills/client-status.js, lists run 19): the digest reads the same live
 * readings (/api/status and /incidents.json) through delivery-board's progressOf, and a reading that did not answer is named. It never
 * prints a fixed "all green" line. Nothing is sent.
 */
import { progressOf, subjectOf } from './delivery-board.js';

export function isStatusDigest(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:status|client|weekly)\s+digest\b/i.test(t)
    || /^(?:make|generate|show)\s+(?:a\s+)?(?:status|client)\s+digest\b/i.test(t)
    || /^weekly\s+status\s+(?:for|of|on)\b/i.test(t)
    || /\bdigest\s+(?:for|of)\s+(?:my\s+|the\s+)?systems?\b/i.test(t);
}

/** the digest from live readings. Pure: the headline follows the guards' overall state, never a fixed claim. */
export function digestOf(text, statusBody, statusError, incidentsBody, incidentsError) {
  const p = progressOf(statusBody, statusError, incidentsBody, incidentsError);
  const headline = p.overall === 'up' ? 'The guards Verse watches are up; the incident line below says what is open.'
    : p.overall === 'degraded' ? 'Some guards are degraded; see the lines below.'
    : 'A reading did not answer, so this digest cannot say everything is fine.';
  return { subject: subjectOf(text), overall: p.overall, headline, lines: p.lines };
}

async function readJson(url, fetchFn) {
  try { const r = await fetchFn(url, { cache: 'no-cache' }); if (!r || !r.ok) return { error: 'answered HTTP ' + ((r && r.status) || 0) }; return { body: await r.json() }; }
  catch (_) { return { error: 'did not answer' }; }
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const fetchFn = typeof api.fetch === 'function' ? api.fetch : ((u, o) => fetch(u, o));
  const [status, incidents] = await Promise.all([readJson('/api/status', fetchFn), readJson('/incidents.json', fetchFn)]);
  const d = digestOf(text, status.body, status.error ? 'the status API ' + status.error : '', incidents.body, incidents.error ? 'the incident log ' + incidents.error : '');
  showPage((el) => {
    el.innerHTML = '<h2>Status digest: ' + esc(d.subject) + '</h2>'
      + '<p><strong>' + esc(d.headline) + '</strong></p>'
      + '<ul>' + d.lines.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<div class="src">Source: GET /api/status and /incidents.json, the same readings as the client status pack and the delivery board</div>'
      + '<p class="sub">Nothing is invented as already done. A reading that did not answer is named.</p>';
  });
  return 'status-digest';
}

export default {
  name: 'status-digest',
  examples: [
    'status digest for the invoice automation',
    'client digest: onboarding flow',
    'weekly status for my systems',
    'show a status digest of the support router'
  ],
  nearMisses: ['what is a digest', 'digest this email', 'status update'],
  match(lower, text) { return isStatusDigest(text || lower); },
  run,
  suite() {
    const ok = this.examples.every(isStatusDigest) && !this.nearMisses.some(isStatusDigest)
      && digestOf('status digest for x', null, 'the status API did not answer', null, 'the incident log answered HTTP 404').overall === 'unknown';
    return { ok, got: ok ? 'match works; an unanswered reading is named' : 'mismatch' };
  }
};
