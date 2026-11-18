/**
 * connect-flows skill — map the data flows and handoff points between systems Verse will own.
 * Given a business process, suggests how the pieces connect (intake → processing → output → monitoring)
 * so the client does less architecture and Verse owns the connections. Rules-based, offline. Nothing is sent.
 * "connect the systems for invoice reminders", "show the data flows for client onboarding",
 * "map connections for the support router".
 */
export function isConnectFlows(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:connect|map)\s+(?:the\s+)?(?:systems?|flows?|connections?)\b/i.test(t)
    || /^(?:show|list)\s+(?:the\s+)?(?:data\s+)?flows?\s+for\b/i.test(t)
    || /^(?:map|show)\s+connections?\s+for\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the process';
}

export function flowsFor(subject) {
  const name = subjectOf(subject);
  const t = name.toLowerCase();
  const flows = [];
  if (/email|inbox|support|customer|message/.test(t)) {
    flows.push({ from: 'incoming email', to: 'triage skill', what: 'parsed ask + priority' });
    flows.push({ from: 'triage skill', to: 'draft replies', what: 'suggested reply behind confirm line' });
    flows.push({ from: 'draft replies', to: 'status card', what: 'unanswered age for monitoring' });
  }
  if (/invoice|bill|payment|remind/.test(t)) {
    flows.push({ from: 'unpaid list', to: 'reminder scheduler', what: 'due dates' });
    flows.push({ from: 'reminder scheduler', to: 'confirm line', what: 'yes before send' });
    flows.push({ from: 'confirm line', to: 'status digest', what: 'sent / waiting count' });
  }
  if (/onboard|signup|client|welcome/.test(t)) {
    flows.push({ from: 'signup form', to: 'onboarding checklist', what: 'new client record' });
    flows.push({ from: 'onboarding checklist', to: 'stalled-step alert', what: 'step age' });
    flows.push({ from: 'stalled-step alert', to: 'client status card', what: 'progress for the client' });
  }
  if (flows.length === 0) {
    flows.push({ from: 'intake', to: 'core processing', what: 'structured request' });
    flows.push({ from: 'core processing', to: 'output / handoff', what: 'result + status' });
    flows.push({ from: 'output / handoff', to: 'monitor', what: 'health and next step' });
  }
  return { subject: name, flows, next: 'Ask for a handoff checklist or systems monitor for ' + name };
}

function run(text, api) {
  const { showPage, esc } = api;
  const pack = flowsFor(text);
  showPage((el) => {
    const rows = pack.flows.map((f) =>
      '<tr><td>' + esc(f.from) + '</td><td>' + esc(f.to) + '</td><td>' + esc(f.what) + '</td></tr>'
    ).join('');
    el.innerHTML = '<h2>Connect flows for ' + esc(pack.subject) + '</h2>'
      + '<p>Verse owns these connections so the client does less architecture.</p>'
      + '<table><thead><tr><th>From</th><th>To</th><th>What moves</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<p><b>Next:</b> ' + esc(pack.next) + '</p>'
      + '<div class="src">Source: rules from the ask · nothing invented as already built · as of 2026-11</div>';
  });
  return 'connect-flows';
}

export default {
  name: 'connect-flows',
  examples: [
    'connect the systems for invoice reminders',
    'show the data flows for client onboarding',
    'map connections for the support router'
  ],
  nearMisses: [
    'handoff checklist for the invoice system'
  ],
  match(lower) { return isConnectFlows(lower); },
  run
};
