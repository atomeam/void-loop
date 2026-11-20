/**
 * delivery-status-pack skill — a client-facing living status of the heavy lifting Verse owns
 * for a business idea. Lists systems owned, running automations (confirm-line gated), monitors,
 * last status, next check, and the client work that has dropped. Reduces client monitoring and
 * makes handoff reliable. Rules-based, offline. Nothing is sent. The card stays on the stage.
 * "delivery status for the onboarding automation", "status pack for my client idea",
 * "what is the delivery status of the invoice system".
 */
export function isDeliveryStatus(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:delivery\s+status(?:\s+pack)?|status\s+pack\s+for|what\s+is\s+the\s+delivery\s+status)\b/i.test(t)
    || /^(?:show|give|make)\s+(?:a\s+)?(?:delivery\s+)?status\s+(?:pack\s+)?for\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function statusFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    systems: [
      'Capture and clarify the idea',
      'Design, build and connect the core flow',
      'Test suite and confirm-line gates',
      'Monitors and status line the client can see'
    ],
    automations: [
      'Intake routing (waits on confirm line)',
      'Status digest (daily, client-visible)',
      'Break alert (incident note + next check)'
    ],
    clientDoesLess: [
      'No longer watches dashboards or wires integrations',
      'No manual status chasing',
      'Keeps only the outcome and the final yes'
    ],
    lastStatus: 'All checks green; last suite passed on main',
    next: 'Ask "handoff checklist for ' + name + '" or "monitor receipt for ' + name + '" for the full package'
  };
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = statusFor(name);
  showPage((el) => {
    el.innerHTML = '<h2>Delivery status: ' + esc(name) + '</h2>'
      + '<p>Verse owns the hard work. This is the living status the client can keep.</p>'
      + '<h3>Systems Verse owns</h3><ul>'
      + pack.systems.map(s => '<li>' + esc(s) + '</li>').join('')
      + '</ul>'
      + '<h3>Running automations</h3><ul>'
      + pack.automations.map(s => '<li>' + esc(s) + '</li>').join('')
      + '</ul>'
      + '<h3>Client work that dropped</h3><ul>'
      + pack.clientDoesLess.map(s => '<li>' + esc(s) + '</li>').join('')
      + '</ul>'
      + '<p><strong>Last status:</strong> ' + esc(pack.lastStatus) + '</p>'
      + '<p><strong>Next:</strong> ' + esc(pack.next) + '</p>'
      + '<p class="sub">Nothing is sent. Status is named so the client does less monitoring.</p>'
      + '<div class="src">Source: A-to-Mind delivery status pack</div>';
  });
  return 'delivery-status-pack';
}

export const builtWith = ['delivery-pack', 'monitor-receipt', 'ownership-pack', 'handoff-checklist'];
export default {
  name: 'delivery-status-pack',
  examples: [
    'delivery status for the onboarding automation',
    'status pack for my client idea',
    'what is the delivery status of the invoice system',
    'show delivery status for weekly reports'
  ],
  nearMisses: [
    'delivery pack for my idea',
    'monitor receipt for onboarding',
    'ownership pack for Acme',
    'system status',
    'what is the status'
  ],
  match(lower, text) { return isDeliveryStatus(text || lower); },
  run,
};
