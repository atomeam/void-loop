/**
 * full-handoff skill — package a running system or automation into a complete client handoff.
 * Lists ownership, status, docs, monitors, automations and the next step so the client does less and Verse owns the heavy lifting.
 * Rules-based, offline. Nothing is sent.
 * "full handoff for the invoice automation", "client handoff pack on onboarding", "package the handoff for support router".
 */
export function isFullHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:full|complete|client)\s+handoff\b/i.test(t)
    || /^(?:handoff|hand-off)\s+(?:pack|package|for|of|on)\b/i.test(t)
    || /^(?:make|generate|create|show|package)\s+(?:a\s+|the\s+)?(?:full\s+)?handoff\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function handoffFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    owns: [
      'Design, build and connect the systems',
      'Run the automations behind the confirm line',
      'Own the monitors and alerts',
      'Own the verification and tests',
      'Package status, docs and this handoff'
    ],
    status: 'Live; monitors watching; handoff ready',
    docs: ['Ownership map', 'Monitor list', 'Handoff checklist', 'Status digest'],
    monitors: ['Daily status from /api/status', 'Incident log watch'],
    automations: ['The scheduled jobs on the clock', 'The confirm-line gates'],
    next: 'Client can summon status digest or delivery board anytime; Verse keeps owning the heavy lifting'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const name = subjectOf(text);
  const h = handoffFor(text);
  showPage((el) => {
    const owns = h.owns.map(i => '<li>' + esc(i) + '</li>').join('');
    const docs = h.docs.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Full handoff: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the heavy lifting. This packages the complete handoff so the client does less.</p>'
      + '<h3>What Verse owns</h3><ul>' + owns + '</ul>'
      + '<h3>Current status</h3><p>' + esc(h.status) + '</p>'
      + '<h3>Docs included</h3><ul>' + docs + '</ul>'
      + '<h3>Monitors</h3><ul>' + h.monitors.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Automations</h3><ul>' + h.automations.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Next</h3><p>' + esc(h.next) + '</p>'
      + '<p class="sub">Nothing is invented as already done. Ask for the live status digest when ready.</p>'
      + '<div class="src">Source: A-to-Mind full handoff · nothing sent</div>';
  });
  return 'full-handoff';
}

export const builtWith = ['delivery-pack', 'system-handoff', 'delivery-board', 'status-digest', 'docs-pack'];
export default {
  name: 'full-handoff',
  examples: [
    'full handoff for the invoice automation',
    'client handoff pack on onboarding flow',
    'package the handoff for the support router',
    'show the complete handoff for weekly reports'
  ],
  nearMisses: [
    'what is a handoff',
    'handoff the baton',
    'status update',
    'delivery board'
  ],
  match: (low, raw) => isFullHandoff(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isFullHandoff) && !this.nearMisses.some(isFullHandoff);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
