/**
 * automation-handoff skill — package the running automations for a client handoff.
 * Turns a system or idea into a client-facing card that lists the automations that run,
 * their triggers, how status is handed off, monitoring points, and what client work drops.
 * Rules-based, offline. Nothing is sent. The card stays on the stage so the handoff can be shared.
 * "automation handoff for the email reminders", "handoff the running automations for onboarding",
 * "package the running jobs for the client: invoice follow-ups".
 */
export function isAutomationHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t) return false;
  return /^(?:automation\s+handoff|handoff\s+the\s+running\s+automations|package\s+the\s+running\s+jobs)\b/i.test(t)
    || /^(?:make|generate|create|build)\s+(?:an?\s+)?automation\s+handoff\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 2 ? s.slice(0, 160) : 'this system';
}

export function handoffFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    automations: [
      'Capture and clarify the incoming idea or request',
      'Design and build the connecting systems',
      'Run the scheduled or triggered jobs behind the confirm line',
      'Monitor status and surface only the exceptions',
      'Hand off docs, status and the running automations'
    ],
    status: 'Status lives on the client status card and the delivery board. Exceptions ping the owner; green runs stay quiet.',
    reduced: 'What drops off the client list: watching the runs, chasing status and re-starting failed jobs.',
    next: 'Start from the idea-to-system or client-offer card for ' + name + '. This handoff stays here for the client.'
  };
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const h = handoffFor(text);
  const autos = h.automations.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Automation handoff: ' + esc(name) + '</h2>'
      + '<p>The running automations, packaged for handoff.</p>'
      + '<h3>Automations that run</h3><ul>'
      + autos
      + '</ul>'
      + '<h3>Status and monitoring</h3><p>' + esc(h.status) + '</p>'
      + '<h3>Client work that drops</h3><p>' + esc(h.reduced) + '</p>'
      + '<h3>Next step</h3><p>' + esc(h.next) + '</p>'
      + '<p class="sub">Nothing is sent. The handoff stays with the client.</p>'
      + '<div class="src">Source: A-to-Mind automation handoff</div>';
  });
  return 'automation-handoff';
}

export const builtWith = ['client-offer', 'handoff-checklist', 'systems-monitor', 'client-status'];
export default {
  name: 'automation-handoff',
  examples: [
    'automation handoff for the email reminders',
    'handoff the running automations for onboarding',
    'package the running jobs for the client',
    'make an automation handoff for invoice follow-ups',
    'automation handoff for the support router'
  ],
  nearMisses: [
    'client offer for email',
    'handoff checklist for onboarding',
    'system status for reports',
    'lift summary for Acme'
  ],
  match(lower) { return isAutomationHandoff(lower); },
  run
};
