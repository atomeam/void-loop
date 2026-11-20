/**
 * delivery-reliability-pack skill — package the reliability pieces for a business idea
 * so Verse owns the tests, monitors and incident response and the client does less checking.
 * Rules-based, offline. Nothing is sent. Reuses existing verify and monitor suggestions.
 * "reliability pack for the invoice automation", "delivery reliability for onboarding",
 * "make the reliability package for support routing".
 */
export function isDeliveryReliabilityPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:delivery\s+)?reliability\s+(?:pack|package)\b/i.test(t)
    || /^(?:make|generate|package|show)\s+(?:a\s+)?(?:delivery\s+)?reliability\s+(?:pack|package)\b/i.test(t)
    || /\breliability\s+pack\s+(?:for|of)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    tests: [
      'Core flow runs end to end without client intervention',
      'Failures surface on the status card before the client notices',
      'Confirm-line approvals stay required for any send or spend'
    ],
    monitors: [
      'Status line the client can summon any time',
      'Incident log that opens and closes itself',
      'Next-check date so nothing waits silently'
    ],
    clientDoesLess: 'The client no longer watches dashboards, runs tests or chases status. Verse owns the reliability.',
    next: 'Summon the verify pack or monitor pack for the detailed lists, or the full handoff when ready to deliver.'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = packFor(text);
  const list = (arr) => arr.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Delivery reliability pack: ' + esc(p.subject) + '</h2>'
      + '<p><strong>Verse owns the reliability.</strong> The client keeps the outcome and the confirm line.</p>'
      + '<h3>Tests Verse runs</h3><ul>' + list(p.tests) + '</ul>'
      + '<h3>Monitors Verse watches</h3><ul>' + list(p.monitors) + '</ul>'
      + '<p>' + esc(p.clientDoesLess) + '</p>'
      + '<p class="sub">' + esc(p.next) + '</p>'
      + '<div class="src">Source: A-to-Mind delivery practice · nothing sent</div>';
  });
  return 'delivery-reliability-pack';
}

export default {
  name: 'delivery-reliability-pack',
  examples: [
    'delivery reliability pack for the invoice automation',
    'reliability pack for client onboarding',
    'make a reliability package for the support router'
  ],
  nearMisses: ['what is reliability', 'pack the bags', 'reliability score'],
  match(lower, text) { return isDeliveryReliabilityPack(text || lower); },
  run,
  suite() {
    const ok = isDeliveryReliabilityPack('delivery reliability pack for the invoice automation')
      && isDeliveryReliabilityPack('reliability pack for client onboarding')
      && isDeliveryReliabilityPack('make a reliability package for the support router')
      && !isDeliveryReliabilityPack('what is reliability')
      && !isDeliveryReliabilityPack('pack the bags');
    return { ok, got: 'match works' };
  }
};
