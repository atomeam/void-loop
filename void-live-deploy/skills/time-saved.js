/**
 * time-saved skill — client-visible estimate of hours the client no longer spends because Verse owns the systems, monitors, tests and handoffs.
 * Packages a typical-hours estimate with the systems, monitors, tests and handoffs included. Pure estimate from typical process load; nothing is sent or claimed as measured.
 * "time saved for the invoice automation", "how much time does Verse save me on onboarding", "client time saved: support router".
 */
export function isTimeSaved(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:time|hours)\s+saved\b/i.test(t)
    || /^(?:how\s+much\s+time|client\s+time)\s+(?:does\s+verse\s+)?save/i.test(t)
    || /\btime\s+saved\s+(?:for|of|on)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function estimateFor(subject) {
  const name = subjectOf(subject);
  // Typical load for a small business process Verse owns end-to-end.
  return {
    subject: name,
    hoursPerWeek: 4,
    basis: 'Typical small process: 2h chasing status + 1h manual tests + 1h handoff docs, now owned by Verse',
    owns: ['Status and monitors', 'Verification tests', 'Handoff docs and digests', 'Running automations'],
    note: 'Estimate only. Real hours depend on the process; summon the status digest for live state.'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const e = estimateFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Time saved: ' + esc(e.subject) + '</h2>'
      + '<p><strong>~' + e.hoursPerWeek + ' hours per week</strong></p>'
      + '<p>' + esc(e.basis) + '</p>'
      + '<h3>What Verse owns</h3><ul>' + e.owns.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<p class="sub">' + esc(e.note) + '</p>'
      + '<div class="src">Source: A-to-Mind time-saved estimate · nothing measured live, nothing sent</div>';
  });
  return 'time-saved';
}

export const builtWith = ['status-digest', 'full-handoff', 'delivery-board'];
export default {
  name: 'time-saved',
  examples: [
    'time saved for the invoice automation',
    'how much time does Verse save me on onboarding',
    'client time saved: support router',
    'hours saved for weekly reports'
  ],
  nearMisses: [
    'what time is it',
    'save this',
    'status digest',
    'full handoff'
  ],
  match: (low, raw) => isTimeSaved(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isTimeSaved) && !this.nearMisses.some(isTimeSaved)
      && estimateFor('time saved for x').hoursPerWeek === 4;
    return { ok, got: ok ? 'match works; estimate is fixed typical' : 'mismatch' };
  }
};
