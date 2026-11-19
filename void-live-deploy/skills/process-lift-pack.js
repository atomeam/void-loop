/**
 * process-lift-pack skill — package a business process or idea into the specific heavy lifting Verse owns
 * so the client does less: clarify the ask, design the flow, connect existing tools, test it, monitor it, and hand off the running package.
 * Rules-based, offline. Nothing is sent. Reuses existing skills and tools.
 * "process lift pack for client onboarding", "package the hard work for invoice automation", "verse does the lift for support routing"
 */
export function isProcessLiftPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:process\s+)?lift\s+(?:pack|package)\b/i.test(t)
    || /^(?:package|pack)\s+the\s+(?:heavy\s+)?lift(?:ing)?\b/i.test(t)
    || /^(?:we\s+own\s+the\s+lift)\b/i.test(t)
    || /^(?:heavy\s+lift(?:ing)?\s+pack)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 180) : 'the business process';
}

export function liftFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    clarify: 'Structured intake that turns the raw process into clear requirements and ownership boundaries',
    design: 'Core flow or automation designed so Verse owns the steps',
    connect: 'Reuse existing Verse skills and tools first (see domains/void.existing-tools.md and reuse-pack)',
    test: 'Suite checks and verification Verse handles so the client does not test',
    monitor: 'Status card, monitors and incident path the client can summon but does not watch',
    handoff: 'Complete package of ownership, status, docs and running automations',
    clientDoesLess: 'The client no longer clarifies, designs, connects, tests, monitors or chases status; Verse owns the hard work'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = liftFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Process lift pack: ' + esc(name) + '</h2>'
      + '<p class="sub">What Verse owns so the client does less. We package "verse does the hard work."</p>'
      + '<h3>Clarify</h3><p>' + esc(pack.clarify) + '</p>'
      + '<h3>Design</h3><p>' + esc(pack.design) + '</p>'
      + '<h3>Connect</h3><p>' + esc(pack.connect) + '</p>'
      + '<h3>Test</h3><p>' + esc(pack.test) + '</p>'
      + '<h3>Monitor</h3><p>' + esc(pack.monitor) + '</p>'
      + '<h3>Handoff</h3><p>' + esc(pack.handoff) + '</p>'
      + '<h3>How the client does less</h3><p>' + esc(pack.clientDoesLess) + '</p>'
      + '<p class="sub">Ask for the ownership pack, progress report or full handoff when the systems ship.</p>'
      + '<div class="src">Source: A-to-Mind process lift practice · existing tools preferred</div>';
  });
  return 'process-lift-pack';
}

export const builtWith = ['client-intake', 'reuse-pack', 'ownership-pack', 'monitor-pack', 'verify-pack', 'full-handoff'];
export default {
  name: 'process-lift-pack',
  examples: [
    'process lift pack for client onboarding',
    'package the hard work for invoice automation',
    'verse does the lift for support routing',
    'hard work pack for the sales follow-up process'
  ],
  nearMisses: ['what is hard work', 'lift the card', 'process map'],
  match(lower, text) { return isProcessLiftPack(text || lower); },
  run,
  suite() {
    const ok = isProcessLiftPack('process lift pack for client onboarding')
      && isProcessLiftPack('package the hard work for invoice automation')
      && isProcessLiftPack('verse does the lift for support routing')
      && isProcessLiftPack('hard work pack for the sales follow-up process')
      && !isProcessLiftPack('what is hard work')
      && !isProcessLiftPack('lift the card')
      && !isProcessLiftPack('process map');
    return { ok, got: 'match works' };
  }
};
