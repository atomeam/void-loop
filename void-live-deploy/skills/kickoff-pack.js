/**
 * kickoff-pack skill — package the first week Verse will own for a business idea so the client starts with less work.
 * Lists the clarify step, first system slice, monitors and handoff point. Rules-based, offline. Nothing is sent.
 * "kickoff pack for the invoice automation", "first week ownership for onboarding", "start owning the support router".
 */
export function isKickoffPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:kickoff|first\s+week|start\s+owning)\s+(?:pack|package|ownership)?\b/i.test(t)
    || /^(?:make|generate|show|package)\s+(?:a\s+)?(?:kickoff|first\s+week)\s+pack\b/i.test(t)
    || /\bkickoff\s+(?:pack|for|of)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the idea';
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    steps: [
      'Capture and clarify the idea (client-intake or business-clarify)',
      'Propose the first system slice Verse will design and build',
      'Set monitors and verification Verse will own from day one',
      'Prepare the status and handoff package so the client sees progress without chasing'
    ],
    clientDoes: 'Approves the first slice and the outcome; keeps the yes on the confirm line',
    next: 'Ask for the client-intake or system-slice card next; Verse owns the heavy lifting from the start'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = packFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Kickoff pack: ' + esc(p.subject) + '</h2>'
      + '<p>Verse starts owning the heavy lifting in the first week so the client does less from day one.</p>'
      + '<h3>What Verse owns first</h3><ul>' + p.steps.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>What the client keeps</h3><p>' + esc(p.clientDoes) + '</p>'
      + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
      + '<p class="sub">Nothing is sent or claimed as already built. The pack stays on the stage for sharing.</p>'
      + '<div class="src">Source: A-to-Mind kickoff-pack · we own the heavy lifting</div>';
  });
  return 'kickoff-pack';
}

export const builtWith = ['client-intake', 'system-slice', 'monitor-pack', 'full-handoff'];
export default {
  name: 'kickoff-pack',
  examples: [
    'kickoff pack for the invoice automation',
    'first week ownership for onboarding',
    'start owning the support router',
    'kickoff package for weekly reports'
  ],
  nearMisses: [
    'client offer',
    'delivery pack',
    'what is a kickoff',
    'start the timer'
  ],
  match: (low, raw) => isKickoffPack(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isKickoffPack) && !this.nearMisses.some(isKickoffPack)
      && packFor('kickoff pack for x').steps.length === 4;
    return { ok, got: ok ? 'match works; four first-week steps' : 'mismatch' };
  }
};
