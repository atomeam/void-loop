/**
 * system-plan skill — capture a vague business idea and turn it into a structured plan of systems,
 * automations, tests, monitors and handoff points so Verse owns the heavy lifting.
 * Rules-based, offline. Nothing is sent or claimed as already built.
 * "system plan for client onboarding", "plan the systems for invoice automation",
 * "clarify and plan the support process", "make a system plan for weekly reports".
 */
export function isSystemPlan(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:system\s+plan|plan\s+the\s+systems|clarify\s+and\s+plan)\b/i.test(t)
    || /^(?:make|generate|create|show)\s+(?:a\s+)?(?:system\s+)?plan\s+for\b/i.test(t)
    || /^system\s+plan\s+for\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function planFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    clarify: 'Capture the idea into systems Verse designs, builds, connects, tests and monitors.',
    systems: [
      'Intake and clarify the process (client-intake)',
      'Next smallest useful slice (system-slice)',
      'Ownership map so client work drops',
      'Reuse existing tools where they fit'
    ],
    automations: ['One scheduled job behind the confirm line', 'Status updates the client does not chase'],
    tests: ['Verification pack for the critical path', 'Suite check so delivery stays reliable'],
    monitors: ['Daily status the client can summon', 'Incident watch so Verse owns the watching'],
    handoff: 'Full handoff package with lift summary, reuse map and offer when the slice is live',
    next: 'Ask for the system slice or the full handoff once the plan is clear.'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = planFor(text);
  const list = (arr) => arr.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>System plan: ' + esc(p.subject) + '</h2>'
      + '<p>' + esc(p.clarify) + '</p>'
      + '<h3>Systems Verse will own</h3><ul>' + list(p.systems) + '</ul>'
      + '<h3>Automations</h3><ul>' + list(p.automations) + '</ul>'
      + '<h3>Tests and verification</h3><ul>' + list(p.tests) + '</ul>'
      + '<h3>Monitors</h3><ul>' + list(p.monitors) + '</ul>'
      + '<h3>Handoff</h3><p>' + esc(p.handoff) + '</p>'
      + '<p><strong>Next:</strong> ' + esc(p.next) + '</p>'
      + '<p class="sub">Nothing is invented as already built. The plan packages we own the heavy lifting.</p>'
      + '<div class="src">Source: A-to-Mind system plan · nothing sent</div>';
  });
  return 'system-plan';
}

export const builtWith = ['client-intake', 'system-slice', 'ownership-pack', 'reuse-pack', 'full-handoff', 'verify-pack', 'monitor-pack'];
export default {
  name: 'system-plan',
  examples: [
    'system plan for client onboarding',
    'plan the systems for invoice automation',
    'clarify and plan the support process',
    'make a system plan for weekly reports'
  ],
  nearMisses: [
    'what\'s the plan',
    'system status',
    'full handoff',
    'status digest'
  ],
  match: (low, raw) => isSystemPlan(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isSystemPlan) && !this.nearMisses.some(isSystemPlan)
      && planFor('system plan for x').systems.length === 4;
    return { ok, got: ok ? 'match works; plan has the four system steps' : 'mismatch' };
  }
};
