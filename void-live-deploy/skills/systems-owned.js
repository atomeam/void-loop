/**
 * systems-owned skill — list the systems, monitors, tests and handoffs Verse owns for a business idea
 * so the client sees what heavy lifting is taken over and does less chasing.
 * Rules-based, offline. Nothing sent. Reuses existing packs (ownership, monitor, verify, handoff).
 * "systems owned for the invoice automation", "what does Verse own for onboarding", "owned systems pack for weekly reports".
 */
export function isSystemsOwned(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:systems?\s+owned|what\s+(?:does|will)\s+verse\s+own|owned\s+systems)\b/i.test(t)
    || /^(?:show|list|package)\s+(?:the\s+)?(?:systems?\s+owned|owned\s+systems)\b/i.test(t)
    || /\bverse\s+owns\s+(?:for|the)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function systemsFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    systems: [
      'Capture & clarify intake (client-intake / idea-to-system)',
      'Design & build core workflow (system-slice)',
      'Connect existing tools first (reuse-pack / void.existing-tools.md)',
      'Verification tests Verse owns (verify-pack)',
      'Monitors and status Verse owns (monitor-pack / system-status)',
      'Ownership map: Verse vs client (ownership-pack)',
      'Full handoff package (full-handoff / delivery-pack)',
      'Progress and status digest the client can summon (progress-report / status-digest)',
      'ROI and time-saved estimate (roi-pack / time-saved)'
    ],
    clientDoesLess: 'No dashboard watching, no test writing, no status chasing, no inventing the systems',
    next: 'Summon any pack above or "full handoff for ' + name + '" for the complete package'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = systemsFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Systems Verse owns: ' + esc(p.subject) + '</h2>'
      + '<p><strong>Client does less:</strong> ' + esc(p.clientDoesLess) + '</p>'
      + '<h3>What Verse owns</h3><ul>' + p.systems.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
      + '<p class="sub">Reuse existing tools and packs. Nothing invented as already running until a check answers.</p>'
      + '<div class="src">Source: A-to-Mind systems-owned · verse does the hard work</div>';
  });
  return 'systems-owned';
}

export const builtWith = ['ownership-pack', 'monitor-pack', 'verify-pack', 'full-handoff', 'delivery-pack', 'roi-pack'];
export default {
  name: 'systems-owned',
  examples: [
    'systems owned for the invoice automation',
    'what does Verse own for onboarding flow',
    'owned systems pack for weekly reports',
    'show the systems Verse owns for support router'
  ],
  nearMisses: [
    'what is a system',
    'own this',
    'systems monitor',
    'status digest'
  ],
  match: (low, raw) => isSystemsOwned(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isSystemsOwned) && !this.nearMisses.some(isSystemsOwned)
      && systemsFor('systems owned for x').systems.length >= 8;
    return { ok, got: ok ? 'match works; lists the owned systems' : 'mismatch' };
  }
};
