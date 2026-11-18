/**
 * ops-digest skill — package a weekly operations digest for systems Verse owns.
 * Shows monitors, automations running, open items and next handoff so the client does less chasing and ops work.
 * Rules-based, offline. Nothing is sent.
 * "ops digest for client onboarding", "weekly ops for invoice reminders",
 * "show the ops digest for support tickets".
 */
export function isOpsDigest(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:ops|operations)\s+(?:digest|summary|report)\b/i.test(t)
    || /^(?:weekly)\s+(?:ops|operations)\b/i.test(t)
    || /^(?:show)\s+(?:the\s+)?ops\s+digest\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the systems';
}

export function digestFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    items: [
      { what: 'Monitors live', owns: 'Verse (monitor-pack)', status: 'Green on key steps' },
      { what: 'Automations running', owns: 'Verse (automation-proposal)', status: 'Intake, reminders, status line' },
      { what: 'Open items', owns: 'Verse', status: 'Docs and first full automation' },
      { what: 'Next handoff', owns: 'Verse (handoff-ready / full-handoff)', status: 'When open items close' }
    ],
    lift: 'Client sees one weekly digest; Verse owns the monitors, automations and packaging so daily ops work drops.'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = digestFor(text);
  const rows = pack.items.map(i => '<tr><td>' + esc(i.what) + '</td><td>' + esc(i.owns) + '</td><td>' + esc(i.status) + '</td></tr>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Ops digest: ' + esc(name) + '</h2>'
      + '<p class="sub">Weekly operations Verse owns so the client does less watching and chasing.</p>'
      + '<table><thead><tr><th>Item</th><th>Verse owns</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<h3>How the client does less</h3><p>' + esc(pack.lift) + '</p>'
      + '<p class="sub">Ask for the handoff-ready check or full-handoff next. Nothing is sent.</p>'
      + '<div class="src">Source: A-to-Mind ops digest</div>';
  });
  return 'ops-digest';
}

export const builtWith = ['monitor-pack', 'automation-proposal', 'handoff-ready', 'full-handoff'];
export default {
  name: 'ops-digest',
  examples: [
    'ops digest for client onboarding',
    'weekly ops for invoice reminders',
    'show the ops digest for support tickets',
    'operations summary of weekly status reports'
  ],
  nearMisses: [
    'what is ops',
    'digest of news',
    'ops status',
    'show the process map'
  ],
  match: (low, raw) => isOpsDigest(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isOpsDigest) && !this.nearMisses.some(isOpsDigest);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
