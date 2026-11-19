/**
 * reliability-ownership skill — package the reliability ownership for a system or idea
 * so Verse owns monitoring, exceptions, incidents and status, and the client only hears
 * when a decision is needed. Reduces client work. Rules-based, offline. Nothing is sent.
 * "reliability ownership for the invoice system", "package the quiet ops for onboarding",
 * "verse owns the reliability of the support router", "quiet monitoring pack for deliveries"
 */
export function isReliabilityOwnership(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:reliability\s+ownership|quiet\s+(?:ops|monitoring)\s+pack|verse\s+owns\s+the\s+reliability)\b/i.test(t)
    || /^(?:package|pack)\s+the\s+(?:quiet\s+ops|reliability)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 180) : 'the system';
}

export function ownershipFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    monitors: 'Status cards, health checks and exception alerts that Verse watches',
    exceptions: 'Only decisions or failures that need a person surface; green runs stay quiet',
    incidents: 'Verse opens, tracks and closes incidents; the client sees the resolved note',
    status: 'Client-facing status lives on the delivery board and weekly card; no chasing',
    clientDoesLess: 'The client no longer watches dashboards, restarts jobs or chases green status; Verse owns the reliability',
    next: 'Start from the process lift pack or automation handoff for ' + name + '. This ownership stays here.'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = ownershipFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Reliability ownership: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the monitoring, exceptions and incidents so the client only hears when a decision is needed.</p>'
      + '<h3>Monitors</h3><p>' + esc(pack.monitors) + '</p>'
      + '<h3>Exceptions</h3><p>' + esc(pack.exceptions) + '</p>'
      + '<h3>Incidents</h3><p>' + esc(pack.incidents) + '</p>'
      + '<h3>Status</h3><p>' + esc(pack.status) + '</p>'
      + '<h3>How the client does less</h3><p>' + esc(pack.clientDoesLess) + '</p>'
      + '<h3>Next step</h3><p>' + esc(pack.next) + '</p>'
      + '<p class="sub">Nothing is sent. The ownership stays with the client.</p>'
      + '<div class="src">Source: A-to-Mind reliability ownership · existing tools preferred</div>';
  });
  return 'reliability-ownership';
}

export const builtWith = ['monitor-pack', 'incident-pack', 'systems-monitor', 'client-status', 'process-lift-pack'];
export default {
  name: 'reliability-ownership',
  examples: [
    'reliability ownership for the invoice system',
    'package the quiet ops for onboarding automations',
    'verse owns the reliability of the support router',
    'quiet monitoring pack for client deliveries'
  ],
  nearMisses: ['what is reliability', 'monitor the card', 'status for invoices'],
  match(lower, text) { return isReliabilityOwnership(text || lower); },
  run,
  suite() {
    const ok = isReliabilityOwnership('reliability ownership for the invoice system')
      && isReliabilityOwnership('package the quiet ops for onboarding automations')
      && isReliabilityOwnership('verse owns the reliability of the support router')
      && isReliabilityOwnership('quiet monitoring pack for client deliveries')
      && !isReliabilityOwnership('what is reliability')
      && !isReliabilityOwnership('monitor the card')
      && !isReliabilityOwnership('status for invoices');
    return { ok, got: 'match works' };
  }
};
