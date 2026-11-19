/**
 * client-confirm-pack skill — a client-facing card that lists the few confirms
 * the client still gives against everything Verse owns. Makes selling "we own
 * the heavy lifting" clear and keeps client work minimal. Rules-based, offline.
 * Nothing is sent. The card stays on the stage.
 * "confirm pack for the onboarding system", "what does the client still confirm",
 * "client confirms for my idea".
 */
export function isClientConfirm(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:client\s+)?confirm(?:s)?\s+pack\b/i.test(t)
    || /^(?:what\s+does\s+the\s+client\s+still\s+confirm|client\s+confirms?\s+for)\b/i.test(t)
    || /^(?:show|give|make)\s+(?:a\s+)?(?:client\s+)?confirm(?:s)?\s+(?:pack\s+)?for\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function confirmPackFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    clientConfirms: [
      'The yes on the confirm line before any send, book or spend',
      'The outcome review when the system is ready',
      'Any final naming or brand choice'
    ],
    verseOwns: [
      'Capture and clarify the idea',
      'Design, build, connect, test and monitor the systems',
      'Running automations behind the confirm line',
      'Status, docs and handoff package'
    ],
    clientDoesLess: [
      'No wiring integrations',
      'No watching dashboards or chasing status',
      'No writing the tests or the monitors'
    ],
    next: 'Ask "delivery status for ' + name + '" or "handoff checklist for ' + name + '" next'
  };
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = confirmPackFor(name);
  showPage((el) => {
    el.innerHTML = '<h2>Client confirm pack: ' + esc(name) + '</h2>'
      + '<p>Verse owns the heavy lifting. The client keeps only the confirms.</p>'
      + '<h3>What the client still confirms</h3><ul>'
      + pack.clientConfirms.map(s => '<li>' + esc(s) + '</li>').join('')
      + '</ul>'
      + '<h3>What Verse owns</h3><ul>'
      + pack.verseOwns.map(s => '<li>' + esc(s) + '</li>').join('')
      + '</ul>'
      + '<h3>Client work that dropped</h3><ul>'
      + pack.clientDoesLess.map(s => '<li>' + esc(s) + '</li>').join('')
      + '</ul>'
      + '<p><strong>Next:</strong> ' + esc(pack.next) + '</p>'
      + '<p class="sub">Nothing is sent. The confirms stay with the client; everything else is ours.</p>'
      + '<div class="src">Source: A-to-Mind client confirm pack</div>';
  });
  return 'client-confirm-pack';
}

export const builtWith = ['delivery-status-pack', 'lift-summary', 'handoff-checklist', 'ownership'];
export default {
  name: 'client-confirm-pack',
  examples: [
    'confirm pack for the onboarding system',
    'what does the client still confirm for invoice reminders',
    'client confirms for my SaaS idea',
    'show confirm pack for weekly reports'
  ],
  nearMisses: [
    'delivery status for onboarding',
    'handoff checklist',
    'what is a confirm',
    'confirm the order'
  ],
  match(lower, text) { return isClientConfirm(text || lower); },
  run,
};
