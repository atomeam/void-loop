/**
 * status-handoff skill — package current status, last checks and ownership into a client-ready handoff card
 * so Verse owns the monitoring summary and the client does less checking.
 * Honest: nothing is marked green until a real signal is connected. Reduces client work on status tracking.
 * "status handoff for client onboarding", "handoff the status of the invoice system", "package status for the support router"
 */
export function isStatusHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:status|system)\s+handoff\b/i.test(t)
    || /^(?:handoff|package|give)\s+(?:me\s+)?(?:the\s+)?status\b/i.test(t)
    || /^(?:package|make)\s+(?:a\s+)?status\s+(?:handoff|pack|summary)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim() : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

function run(text, api) {
  const { showPage, esc } = api;
  const subject = subjectOf(text);
  showPage((el) => {
    el.innerHTML = '<h2>Status handoff: ' + esc(subject) + '</h2>'
      + '<p><strong>Verse owns:</strong> the status summary, last check ages, and ownership line. The client keeps the outcome and does not chase dashboards.</p>'
      + '<h3>Current status</h3><ul>'
      + '<li>Flow: not yet connected to a live signal (honest surface)</li>'
      + '<li>Last check: none recorded yet</li>'
      + '<li>Incidents: none open</li>'
      + '</ul>'
      + '<h3>Ownership</h3><ul>'
      + '<li>Verse: monitoring, alerts through confirm line, status asks</li>'
      + '<li>Client: decisions and final outcomes</li>'
      + '</ul>'
      + '<p class="sub">Ask again after a signal is wired to see live ages. Client work on status tracking drops.</p>'
      + '<div class="src">Source: A-to-Mind delivery practice · nothing sent</div>';
  });
  return 'status-handoff';
}

export default {
  name: 'status-handoff',
  examples: [
    'status handoff for client onboarding',
    'handoff the status of the invoice system',
    'package status for the support router',
    'make a status handoff for weekly reports'
  ],
  nearMisses: [
    'system status',
    'what is the status',
    'handoff checklist',
    'status of the weather'
  ],
  match(lower, text) { return isStatusHandoff(text || lower); },
  run,
  suite() {
    const ok = isStatusHandoff('status handoff for client onboarding')
      && isStatusHandoff('handoff the status of the invoice system')
      && isStatusHandoff('package status for the support router')
      && isStatusHandoff('make a status handoff for weekly reports')
      && !isStatusHandoff('system status')
      && !isStatusHandoff('what is the status')
      && !isStatusHandoff('handoff checklist');
    return { ok, got: 'match works' };
  }
};
