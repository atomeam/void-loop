/**
 * systems-connect-pack skill — package the connections between systems for a business idea.
 * Lists the systems to connect, how Verse owns the integration (existing tools first), the automations that run across them,
 * the monitoring, and the handoff so client work drops. Rules-based, offline. Nothing is sent.
 * "systems connect pack for client onboarding", "make a systems connect pack for invoice automation" (a bare "connect systems for …" is connect-flows),
 * "package the connections for weekly reports".
 */
export function isSystemsConnect(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:systems?\s+connect(?:\s+pack)?|connect\s+systems(?:\s+pack)?|package\s+(?:the\s+)?connections?\s+for)\b/i.test(t)
    || /^(?:make|generate|create|package)\s+(?:a\s+)?(?:systems?\s+connect(?:\s+pack)?)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the idea';
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    systems: [
      'Intake (forms, email, or existing CRM)',
      'Core process (tasks, data store, or workflow tool)',
      'Output (reports, notifications, or client portal)'
    ],
    owns: [
      'Map the connections using existing tools before inventing',
      'Build and test the flows between systems',
      'Monitor the connections and alert on breaks',
      'Docs and the handoff of the running connections'
    ],
    clientDoesLess: [
      'No longer wires or watches the integrations',
      'No manual data moves between systems',
      'Keeps only the outcome and the final yes'
    ],
    next: 'Ask for the handoff checklist or systems monitor when the first connection ships'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = packFor(text);
  showPage((el) => {
    const sys = pack.systems.map(i => '<li>' + esc(i) + '</li>').join('');
    const owns = pack.owns.map(i => '<li>' + esc(i) + '</li>').join('');
    const less = pack.clientDoesLess.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Systems connect pack: ' + esc(name) + '</h2>'
      + '<p class="sub">The connections Verse owns so the client work drops. Existing tools first.</p>'
      + '<h3>Systems to connect</h3><ul>' + sys + '</ul>'
      + '<h3>What Verse owns</h3><ul>' + owns + '</ul>'
      + '<h3>Client work that drops</h3><ul>' + less + '</ul>'
      + '<h3>Next</h3><p>' + esc(pack.next) + '</p>'
      + '<div class="src">Source: A-to-Mind systems connect pack · nothing sent</div>';
  });
  return 'systems-connect-pack';
}

export const builtWith = ['business-clarify', 'systems-monitor', 'handoff-checklist', 'client-offer'];
export default {
  name: 'systems-connect-pack',
  examples: [
    'systems connect pack for client onboarding',
    'make a systems connect pack for invoice automation',
    'package the connections for weekly status reports',
    'make a systems connect pack for the support process'
  ],
  nearMisses: [
    'what is a system',
    'connect to wifi',
    'monitor the systems',
    'clarify this idea'
  ],
  match: (low, raw) => isSystemsConnect(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isSystemsConnect) && !this.nearMisses.some(isSystemsConnect);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
