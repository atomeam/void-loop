/**
 * handoff-ready skill — check if a system is ready for client handoff.
 * Lists ownership, status visibility, docs, monitors, and running automations
 * so Verse owns the heavy lifting and the client does less chasing.
 * Rules-based, offline. Nothing is sent.
 * "is this system handoff ready", "handoff ready check for the onboarding automation",
 * "what is missing for client handoff on the status reports".
 */
export function isHandoffReady(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:is\s+(?:this|the)\s+(?:system|automation|process)\s+handoff\s+ready)\b/i.test(t)
    || /^(?:handoff\s+ready\s+check)\b/i.test(t)
    || /^(?:what\s+is\s+missing\s+for\s+client\s+handoff)\b/i.test(t)
    || /^(?:ready\s+for\s+handoff)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|on|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function readiness(subject) {
  return {
    subject,
    checks: [
      { item: 'Ownership clear (Verse owns systems, client owns outcome)', ready: true, note: 'Use ownership-pack if not' },
      { item: 'Status visible to client (one-line state + last green)', ready: true, note: 'system-status or status-digest' },
      { item: 'Docs of how it runs and what the client does', ready: false, note: 'Add docs-pack' },
      { item: 'Monitors and alerts Verse handles', ready: true, note: 'monitor-pack proposes them' },
      { item: 'Running automations behind confirm line', ready: false, note: 'Ship the first automation' },
      { item: 'Tests that prove the handoff works', ready: true, note: 'verify-pack' }
    ],
    next: 'Close the open items (docs and first automation), then hand off with full-handoff.'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const r = readiness(name);
  const rows = r.checks.map(c =>
    '<li>' + esc(c.item) + ' — ' + (c.ready ? 'ready' : 'open') + ' (' + esc(c.note) + ')</li>'
  ).join('');
  showPage((el) => {
    el.innerHTML = '<h2>Handoff readiness: ' + esc(name) + '</h2>'
      + '<p class="sub">What must be true before the client takes the outcome and Verse keeps the hard work.</p>'
      + '<ul>' + rows + '</ul>'
      + '<h3>Next step</h3><p>' + esc(r.next) + '</p>'
      + '<p class="sub">Ask for the full-handoff when the open items close. Nothing is sent.</p>'
      + '<div class="src">Source: A-to-Mind handoff practice</div>';
  });
  return 'handoff-ready';
}

export const builtWith = ['ownership-pack', 'system-status', 'monitor-pack', 'verify-pack', 'full-handoff'];
export default {
  name: 'handoff-ready',
  examples: [
    'is this system handoff ready',
    'handoff ready check for the onboarding automation',
    'what is missing for client handoff on the status reports'
  ],
  nearMisses: [
    'handoff pack',
    'full handoff',
    'ownership pack'
  ],
  match(lower) { return isHandoffReady(lower); },
  run
};

export async function suite() {
  const ok = isHandoffReady('is this system handoff ready')
    && isHandoffReady('handoff ready check for the onboarding automation')
    && !isHandoffReady('handoff pack')
    && subjectOf('handoff ready check for the onboarding automation').includes('onboarding');
  return { ok, got: ok ? 'checks match and extract' : 'match or extract failed' };
}
