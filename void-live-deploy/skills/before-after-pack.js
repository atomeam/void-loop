/**
 * before-after-pack skill — package the before (client hours, manual steps, chasing) and after
 * (Verse owns the systems, automations, tests, monitors and handoff; client does less) for a business idea.
 * Makes selling and delivery concrete: the client sees the lift, Verse packages "verse does the hard work."
 * Rules-based, offline. Nothing is sent. Reuses existing tools and skills.
 * "before after pack for client onboarding", "package the before and after for invoice automation",
 * "show the lift from client work to Verse owns it for support routing"
 */
export function isBeforeAfterPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:before[\s-]?after|before\s+and\s+after)\s+(?:pack|package)\b/i.test(t)
    || /^(?:package|show|make|generate)\s+(?:the\s+)?(?:before[\s-]?after|before\s+and\s+after)\b/i.test(t)
    || /^(?:show\s+the\s+)?lift\s+(?:from|of)\s+(?:client|manual)\b/i.test(t)
    || /^(?:client\s+work\s+drop|pain\s+to\s+systems)\s+(?:pack|for)\b/i.test(t);
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
    before: [
      'Client spends hours clarifying the idea and chasing status',
      'Manual steps for design, connection, testing and monitoring',
      'No consistent handoff; client owns the running work'
    ],
    after: [
      'Verse captures and clarifies into a system plan',
      'Verse designs, builds, connects (existing tools first), tests and monitors',
      'Verse owns the running automations, status, docs and handoff; client summons what they need'
    ],
    clientDoesLess: 'The client no longer does the hard work of setup, running or chasing. Verse packages the ownership.',
    next: 'Ask for the ownership pack, progress report or full handoff when ready to deliver.'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = packFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Before and after: ' + esc(name) + '</h2>'
      + '<p class="sub">What the client does now, and what Verse owns so the client does less. We package the hard work.</p>'
      + '<h3>Before (client does the work)</h3><ul>' + pack.before.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>After (Verse owns it)</h3><ul>' + pack.after.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>How the client does less</h3><p>' + esc(pack.clientDoesLess) + '</p>'
      + '<h3>Next</h3><p>' + esc(pack.next) + '</p>'
      + '<div class="src">Source: A-to-Mind before-after practice · existing tools preferred</div>';
  });
  return 'before-after-pack';
}

export const builtWith = ['client-intake', 'idea-to-system', 'process-lift-pack', 'lift-summary', 'full-handoff'];
export default {
  name: 'before-after-pack',
  examples: [
    'before after pack for client onboarding',
    'package the before and after for invoice automation',
    'show the lift from client work to Verse owns it for support routing',
    'client work drop pack for the sales follow-up'
  ],
  nearMisses: ['what is before and after', 'before the card', 'after the meeting', 'process map'],
  match(lower, text) { return isBeforeAfterPack(text || lower); },
  run,
  suite() {
    const tests = [
      { input: 'before after pack for client onboarding', expected: true },
      { input: 'package the before and after for invoice automation', expected: true },
      { input: 'show the lift from client work to Verse owns it for support routing', expected: true },
      { input: 'client work drop pack for the sales follow-up', expected: true },
      { input: 'what is before and after', expected: false },
      { input: 'before the card', expected: false },
      { input: 'process map', expected: false }
    ];

    let ok = true;
    let got = '';

    for (const { input, expected } of tests) {
      const result = isBeforeAfterPack(input) === expected;
      if (!result) {
        ok = false;
        got = `match works (expected ${expected} for "${input}")`;
        break;
      }
    }

    return { ok, got: ok ? 'match works; before and after listed' : got };
  }
};
