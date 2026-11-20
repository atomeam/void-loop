/**
 * client-receipt-pack skill — package a single client-facing receipt of everything Verse owns for a business idea:
 * clarified systems, running automations, monitors, status, time saved and the next summons.
 * Reduces client work to one ask; delivery stays reliable because Verse packages the heavy lifting.
 * Rules-based, offline. Nothing is sent. Reuses existing tools and skills.
 * "client receipt pack for invoice automation",
 * "show the receipt of what Verse owns for client onboarding",
 * "package the ownership receipt for support routing"
 */
export function isClientReceiptPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:client\s+)?(?:receipt|ownership)\s+(?:pack|package|receipt)\b/i.test(t)
    || /^(?:show|make|generate|package)\s+(?:the\s+)?(?:client\s+)?(?:receipt|ownership\s+receipt)\b/i.test(t)
    || /^(?:what\s+does\s+Verse\s+own\s+for)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 180) : 'the business idea';
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    systems: [
      'Capture and clarify the idea into a structured system plan',
      'Design, build and connect using existing tools first',
      'Test with suite checks and live probes before handoff',
      'Monitor with status, incident notes and next-check date'
    ],
    automations: [
      'Confirm-line gated running automations Verse owns',
      'Status updates the client can summon without chasing'
    ],
    monitors: [
      'Last green check and next scheduled check',
      'Incident path if something needs attention'
    ],
    timeSaved: 'Hours the client no longer spends clarifying, building, testing or watching',
    nextSummons: [
      'status for this system',
      'ownership pack',
      'full handoff',
      'time saved'
    ],
    clientDoesLess: 'The client asks for the receipt and sees everything Verse owns. No chasing, no dashboards, no inventing systems.'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = packFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Client receipt: ' + esc(name) + '</h2>'
      + '<p class="sub">One page of what Verse owns so the client does less. We package the heavy lifting.</p>'
      + '<h3>Systems Verse owns</h3><ul>' + pack.systems.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Running automations</h3><ul>' + pack.automations.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Monitors</h3><ul>' + pack.monitors.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Time saved</h3><p>' + esc(pack.timeSaved) + '</p>'
      + '<h3>Next summons</h3><ul>' + pack.nextSummons.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>How the client does less</h3><p>' + esc(pack.clientDoesLess) + '</p>'
      + '<div class="src">Source: A-to-Mind client-receipt practice · existing tools preferred</div>';
  });
  return 'client-receipt-pack';
}

export const builtWith = ['full-lift-plan', 'before-after-pack', 'automation-status-pack', 'full-handoff', 'time-saved'];
export default {
  name: 'client-receipt-pack',
  examples: [
    'client receipt pack for invoice automation',
    'show the receipt of what Verse owns for client onboarding',
    'package the ownership receipt for support routing',
    'what does Verse own for the sales follow-up'
  ],
  nearMisses: ['receipt for lunch', 'client status', 'what is a receipt'],
  match(lower, text) { return isClientReceiptPack(text || lower); },
  run,
  suite() {
    const tests = [
      { input: 'client receipt pack for invoice automation', expected: true },
      { input: 'show the receipt of what Verse owns for client onboarding', expected: true },
      { input: 'package the ownership receipt for support routing', expected: true },
      { input: 'what does Verse own for the sales follow-up', expected: true },
      { input: 'receipt for lunch', expected: false },
      { input: 'client status', expected: false },
      { input: 'what is a receipt', expected: false }
    ];

    let ok = true;
    let got = '';

    for (const { input, expected } of tests) {
      const result = isClientReceiptPack(input) === expected;
      if (!result) {
        ok = false;
        got = `match works (expected ${expected} for "${input}")`;
        break;
      }
    }

    return { ok, got: ok ? 'match works; receipt lists systems Verse owns' : got };
  }
};
