/**
 * automation-status skill — a short client-facing status of the automations Verse owns
 * so the client stops asking for updates. Lists the running automations, their status,
 * and the next handoff step. Rules-based, offline. Nothing is sent.
 * "automation status for invoice reminders", "what automations are running for onboarding",
 * "status of the automations Verse owns for support".
 */
export function isAutomationStatus(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:automation|automations)\s+status\b/i.test(t)
    || /^(?:status|update)\s+(?:of|on)\s+(?:the\s+)?(?:automations?|jobs?)\b/i.test(t)
    || /^(?:what|which)\s+automations?\s+(?:are|is)\s+running\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 2 ? s.slice(0, 160) : 'the process';
}

function statusFor(subject) {
  const t = subject.toLowerCase();
  const items = [];
  if (/email|inbox|support|customer/.test(t)) {
    items.push({ name: 'draft replies', status: 'running behind confirm line' });
    items.push({ name: 'triage incoming', status: 'green' });
  }
  if (/invoice|bill|payment|remind/.test(t)) {
    items.push({ name: 'send reminders', status: 'scheduled, waiting for yes' });
    items.push({ name: 'mark paid', status: 'ready on client yes' });
  }
  if (/onboard|signup|welcome|client/.test(t)) {
    items.push({ name: 'welcome sequence', status: 'waiting for first yes' });
    items.push({ name: 'stalled-step alert', status: 'watching' });
  }
  if (items.length === 0) {
    items.push({ name: 'core flow', status: 'running' });
    items.push({ name: 'status card', status: 'summonable' });
  }
  return items;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const items = statusFor(name);
  showPage((el) => {
    const list = items.map(i => '<li>' + esc(i.name) + ': ' + esc(i.status) + '</li>').join('');
    el.innerHTML = '<h2>Automation status: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the heavy lifting. This is the status the client can summon anytime.</p>'
      + '<h3>Running automations</h3><ul>' + list + '</ul>'
      + '<h3>Client does less</h3>'
      + '<p>No watching dashboards, no asking "is it running?". One card, one status.</p>'
      + '<h3>Next</h3>'
      + '<p>Ask for the handoff checklist or docs pack when ready to hand off.</p>'
      + '<div class="src">Source: A-to-Mind automation status · we own the heavy lifting · nothing sent</div>';
  });
  return 'automation-status';
}

export const builtWith = ['automation-pack', 'monitor-pack', 'client-status-pack', 'handoff-checklist'];
export default {
  name: 'automation-status',
  examples: [
    'automation status for invoice reminders',
    'what automations are running for onboarding',
    'status of the automations Verse owns for support',
    'update on the automations for weekly reports'
  ],
  nearMisses: [
    'automation pack for invoices',
    'status of the system',
    'what is running',
    'monitor pack'
  ],
  match: (low, raw) => isAutomationStatus(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isAutomationStatus) && !this.nearMisses.some(isAutomationStatus);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
