/**
 * automation-proposal skill — propose concrete automations Verse will own for a process
 * so the client does less manual work, tracking and chasing.
 * Rules-based, offline. Nothing is sent.
 * "propose automations for client onboarding", "what automations for invoice reminders",
 * "automation proposal for support tickets".
 */
export function isAutomationProposal(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:propose|suggest|what)\s+(?:automations?|automation)\b/i.test(t)
    || /^(?:automation)\s+(?:proposal|ideas|plan)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the described process';
}

export function proposalsFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    automations: [
      { name: 'Intake capture', owns: 'Verse (client-intake + confirm line)', does: 'Captures the request, clarifies, routes to the right system' },
      { name: 'Status monitor', owns: 'Verse (monitor-pack + status card)', does: 'Watches key steps, posts a live status line the client sees' },
      { name: 'Reminder sequence', owns: 'Verse', does: 'Sends timed reminders or escalations without the client chasing' },
      { name: 'Handoff package', owns: 'Verse (full-handoff / delivery-pack)', does: 'Packages ownership, docs, monitors and next step automatically' },
      { name: 'Verification check', owns: 'Verse (verify-pack)', does: 'Runs the tests and checks before marking a slice done' }
    ],
    lift: 'Client states the outcome and approves the plan; Verse owns the automations that capture, monitor, remind, verify and hand off so manual work drops.'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = proposalsFor(text);
  const rows = pack.automations.map(a => '<tr><td>' + esc(a.name) + '</td><td>' + esc(a.owns) + '</td><td>' + esc(a.does) + '</td></tr>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Automation proposal: ' + esc(name) + '</h2>'
      + '<p class="sub">Concrete automations Verse handles so the client does less manual work.</p>'
      + '<table><thead><tr><th>Automation</th><th>Verse owns</th><th>What it does</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<h3>How the client does less</h3><p>' + esc(pack.lift) + '</p>'
      + '<p class="sub">Ask for the process map or system slice next. Nothing is built yet.</p>'
      + '<div class="src">Source: A-to-Mind automation proposal</div>';
  });
  return 'automation-proposal';
}

export const builtWith = ['client-intake', 'monitor-pack', 'verify-pack', 'delivery-pack', 'full-handoff'];
export default {
  name: 'automation-proposal',
  examples: [
    'propose automations for client onboarding',
    'what automations for invoice reminders',
    'automation proposal for support tickets',
    'suggest automations for weekly status reports'
  ],
  nearMisses: [
    'what is automation',
    'propose a meeting',
    'automation status',
    'show the process'
  ],
  match: (low, raw) => isAutomationProposal(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isAutomationProposal) && !this.nearMisses.some(isAutomationProposal);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
