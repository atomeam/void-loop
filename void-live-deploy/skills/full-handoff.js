/**
 * full-handoff skill — package a running system or automation into a complete client handoff.
 * Lists ownership, status, docs, monitors, automations, lift summary, reuse map, client offer and the next step
 * so the client does less and Verse owns the heavy lifting. The handoff reads as one finished package.
 * Rules-based, offline. Nothing is sent.
 * "full handoff for the invoice automation", "client handoff pack on onboarding", "package the handoff for support router".
 */
import { summaryFor } from './lift-summary.js';
import { suggestReuse } from './reuse-pack.js';

export function isFullHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (/\bhand-?off\s+checklist\b/i.test(t)) return false; // a handoff checklist stays with handoff-checklist
  return /^(?:full|complete|client)\s+handoff\b/i.test(t)
    || /^(?:handoff|hand-off)\s+(?:pack|package|for|of|on)\b/i.test(t)
    || /^(?:make|generate|create|show|package)\s+(?:a\s+|the\s+)?(?:(?:full|complete)\s+)?handoff\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function handoffFor(subject) {
  const name = subjectOf(subject);
  const lift = summaryFor(name);
  const reuse = suggestReuse(name);
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
    docs: ['Ownership map', 'Monitor list', 'Handoff checklist', 'Status digest', 'Lift summary', 'Reuse map', 'Client offer'],
    monitors: ['Daily status from /api/status', 'Incident log watch'],
    automations: ['The scheduled jobs on the clock', 'The confirm-line gates'],
    lift: {
      owns: lift.owns,
      clientDoesLess: lift.clientDoesLess,
      next: lift.next
    },
    reuse: reuse,
    offer: {
      today: 'Manual follow-ups, status chasing, repeated setup and monitoring.',
      takesOver: [
        'Capture and clarify the idea into a system plan',
        'Design, build, connect, test and monitor the systems',
        'Run the automations behind the confirm line',
        'Hand off status, docs and running jobs'
      ],
      reduced: 'No more building the tools, watching the runs, or writing the status. One yes on the outcome.'
    },
    next: 'Client can summon status digest or delivery board anytime; Verse keeps owning the heavy lifting'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const name = subjectOf(text);
  const h = handoffFor(text);
  const owns = h.owns.map(i => '<li>' + esc(i) + '</li>').join('');
  const docs = h.docs.map(i => '<li>' + esc(i) + '</li>').join('');
  const monitors = h.monitors.map(i => '<li>' + esc(i) + '</li>').join('');
  const automations = h.automations.map(i => '<li>' + esc(i) + '</li>').join('');
  const liftOwns = h.lift.owns.map(i => '<li>' + esc(i) + '</li>').join('');
  const liftLess = h.lift.clientDoesLess.map(i => '<li>' + esc(i) + '</li>').join('');
  const reuseList = h.reuse.map(r => '<li><strong>' + esc(r.tool) + '</strong> — ' + esc(r.why) + '</li>').join('');
  const offerTakes = h.offer.takesOver.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Full handoff: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the heavy lifting. This packages the complete handoff so the client does less. One finished package.</p>'
      + '<h3>What Verse owns</h3><ul>' + owns + '</ul>'
      + '<h3>Current status</h3><p>' + esc(h.status) + '</p>'
      + '<h3>Docs included</h3><ul>' + docs + '</ul>'
      + '<h3>Monitors</h3><ul>' + monitors + '</ul>'
      + '<h3>Automations</h3><ul>' + automations + '</ul>'
      + '<h3>Client lift summary</h3>'
      + '<p>What Verse owns</p><ul>' + liftOwns + '</ul>'
      + '<p>Client work that drops</p><ul>' + liftLess + '</ul>'
      + '<p>Next: ' + esc(h.lift.next) + '</p>'
      + '<h3>Reuse tools map</h3>'
      + '<p>Existing processes against what Verse already owns (from void.existing-tools.md).</p>'
      + '<ul>' + reuseList + '</ul>'
      + '<h3>Client offer proposal</h3>'
      + '<p>What the client does today: ' + esc(h.offer.today) + '</p>'
      + '<p>What Verse takes over</p><ul>' + offerTakes + '</ul>'
      + '<p>Reduced client work: ' + esc(h.offer.reduced) + '</p>'
      + '<h3>Next</h3><p>' + esc(h.next) + '</p>'
      + '<p class="sub">Nothing is invented as already done. Ask for the live status digest when ready.</p>'
      + '<div class="src">Source: A-to-Mind full handoff · nothing sent</div>';
  });
  return 'full-handoff';
}

export const builtWith = ['delivery-pack', 'system-handoff', 'delivery-board', 'status-digest', 'docs-pack', 'lift-summary', 'reuse-pack', 'client-offer'];
export default {
  name: 'full-handoff',
  examples: [
    'full handoff for the invoice automation',
    'client handoff pack on onboarding flow',
    'package the handoff for the support router',
    'show the complete handoff for weekly reports',
    'full handoff for client onboarding with lift and offer'
  ],
  nearMisses: [
    'what is a handoff',
    'handoff the baton',
    'status update',
    'delivery board',
    'make a handoff checklist for invoice reminders',
    'lift summary for onboarding',
    'reuse pack for tickets'
  ],
  match: (low, raw) => isFullHandoff(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isFullHandoff) && !this.nearMisses.some(isFullHandoff);
    const h = handoffFor('invoice automation');
    const hasSections = h.lift && h.reuse && h.offer && h.docs.includes('Lift summary');
    return { ok: ok && hasSections, got: ok && hasSections ? 'match and package works' : 'match or package broke' };
  }
};
