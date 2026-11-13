/**
 * delivery-ready skill — check if a business idea is ready for client handoff
 * (ownership, monitors, tests, status, docs packaged) so Verse confirms the heavy lifting is covered
 * and the client does less final chasing.
 * Rules-based, offline. Nothing sent. Reuses existing packs.
 * "is the invoice automation delivery ready", "handoff ready for onboarding", "ready to hand off the weekly reports".
 */
export function isDeliveryReady(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:is\s+(?:this|the|it)\s+)?(?:delivery|handoff)\s+ready\b/i.test(t)
    || /^(?:ready\s+(?:for|to)\s+(?:handoff|delivery)|check\s+delivery\s+readiness)\b/i.test(t)
    || /\bdelivery\s+ready\s+for\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function readinessFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    checks: [
      'Ownership clarified (ownership-pack / systems-owned)',
      'Monitors and status path proposed (monitor-pack / reliability-pack / system-status)',
      'Verification tests Verse owns (verify-pack)',
      'First-week kickoff packaged (kickoff-pack)',
      'Full handoff package ready (full-handoff / delivery-pack)',
      'ROI and time-saved visible (roi-pack / time-saved)',
      'Status digest the client can summon (status-digest / progress-report)'
    ],
    ready: 'All core packs exist; summon them to confirm details for this idea',
    next: 'Summon "systems owned for ' + name + '" or "full handoff for ' + name + '" to complete the package'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = readinessFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Delivery ready: ' + esc(p.subject) + '</h2>'
      + '<p><strong>Status:</strong> ' + esc(p.ready) + '</p>'
      + '<h3>Checks Verse covers</h3><ul>' + p.checks.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
      + '<p class="sub">Reuse existing tools and packs. No uptime or completion claimed until a real check answers.</p>'
      + '<div class="src">Source: A-to-Mind delivery-ready · verse does the hard work</div>';
  });
  return 'delivery-ready';
}

export const builtWith = ['systems-owned', 'ownership-pack', 'monitor-pack', 'verify-pack', 'full-handoff', 'kickoff-pack', 'reliability-pack'];
export default {
  name: 'delivery-ready',
  examples: [
    'is the invoice automation delivery ready',
    'handoff ready for onboarding flow',
    'ready to hand off the weekly reports',
    'check delivery readiness for support router'
  ],
  nearMisses: [
    'ready',
    'delivery',
    'handoff',
    'is it ready'
  ],
  match: (low, raw) => isDeliveryReady(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isDeliveryReady) && !this.nearMisses.some(isDeliveryReady)
      && readinessFor('delivery ready for x').checks.length >= 6;
    return { ok, got: ok ? 'match works; lists readiness checks' : 'mismatch' };
  }
};
