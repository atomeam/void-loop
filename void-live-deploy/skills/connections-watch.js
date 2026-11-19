/**
 * connections-watch skill — package monitors and handoff for the connections between systems in a business idea.
 * Verse owns the integration watching so the client does less checking that flows still talk to each other.
 * Rules-based, offline. Nothing is sent. Honest: suggestions until a live signal is connected.
 * "connections watch for the onboarding flow", "watch the connections for invoice automation", "package connections monitors for support router".
 */
export function isConnectionsWatch(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:connections?\s+watch|watch\s+(?:the\s+)?connections)\b/i.test(t)
    || /^(?:make|generate|show|package)\s+(?:a\s+|the\s+)?connections?\s+(?:watch|monitors?|handoff)\b/i.test(t)
    || /\bconnections?\s+(?:watch|monitors?)\s+(?:for|of|on)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function suggestWatches(subject) {
  const name = subjectOf(subject);
  const t = name.toLowerCase();
  const watches = [];
  if (/email|inbox|message/.test(t)) watches.push('email intake to task system connection');
  if (/invoice|billing|payment/.test(t)) watches.push('invoice system to payment gateway connection', 'payment confirmation to status update');
  if (/onboard|signup|client/.test(t)) watches.push('signup form to CRM connection', 'welcome automation to email connection');
  if (/support|ticket/.test(t)) watches.push('intake form to ticket system connection', 'ticket to notification connection');
  if (/report|status|dashboard/.test(t)) watches.push('data source to report pipeline connection');
  if (watches.length === 0) watches.push('core system A to system B connection', 'scheduled job to status card connection');
  return watches;
}

export function packFor(text) {
  const name = subjectOf(text);
  return {
    subject: name,
    watches: suggestWatches(name),
    checks: [
      'Connection endpoint answers',
      'Data flows end to end on a test payload',
      'Failure is logged and alerted',
      'Status of the connection is visible on the handoff card'
    ],
    handoff: [
      'List of connections Verse watches',
      'What each connection does',
      'How the client can summon the status',
      'Next step if a connection fails'
    ],
    clientDoesLess: 'No checking that integrations still work, no writing connection tests, no chasing broken flows',
    next: 'Connect a live address or job for one connection so the status shows a real reading, or summon "system status for ' + name + '".'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = packFor(text);
  const watches = p.watches.map(i => '<li>' + esc(i) + '</li>').join('');
  const checks = p.checks.map(i => '<li>' + esc(i) + '</li>').join('');
  const handoff = p.handoff.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Connections watch: ' + esc(p.subject) + '</h2>'
      + '<p><strong>Client does less:</strong> ' + esc(p.clientDoesLess) + '</p>'
      + '<h3>Connections Verse watches</h3><ul>' + watches + '</ul>'
      + '<h3>Checks</h3><ul>' + checks + '</ul>'
      + '<h3>Handoff package</h3><ul>' + handoff + '</ul>'
      + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
      + '<p class="sub">Suggestions only until a live signal is connected. Nothing is claimed as already measured. Nothing is sent. Reuses existing connection and status packs.</p>'
      + '<div class="src">Source: rules from the ask; connections pack and system-status</div>';
  });
  return 'connections-watch';
}

const EXAMPLES = [
  'connections watch for the onboarding flow',
  'watch the connections for invoice automation',
  'package connections monitors for the support router',
  'connections watch for weekly reports'
];
const NEAR = [
  'connections pack',
  'system status',
  'monitor handoff',
  'what is a connection',
  'watch this'
];

export default {
  name: 'connections-watch',
  examples: EXAMPLES,
  nearMisses: NEAR,
  match(lower, text) { return isConnectionsWatch(text || lower); },
  run,
  suite() {
    const matchOk = this.examples.every(isConnectionsWatch) && !this.nearMisses.some(isConnectionsWatch);
    const p = packFor('connections watch for the invoice automation');
    const hasInvoice = p.watches.some(w => /invoice|payment|gateway/i.test(w));
    const honest = !/99(?:\.9+)?\s*%/.test(JSON.stringify(p)) && !/\ball green\b/i.test(JSON.stringify(p));
    return { ok: matchOk && hasInvoice && honest && p.handoff.length >= 3, got: matchOk ? 'match works; invoice connections suggested; honest surface' : 'mismatch' };
  }
};
