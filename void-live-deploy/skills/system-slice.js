/**
 * system-slice skill — propose the next concrete system slice Verse will design, build, connect, test or monitor
 * for a business idea or process so the client does less and Verse owns the heavy lifting.
 * Rules-based, offline. Nothing is sent.
 * "next system slice for the client onboarding", "system slice for invoice reminders",
 * "what should Verse build next for the support flow".
 */
export function isSystemSlice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:next|propose|suggest)\s+(?:system\s+)?slice\b/i.test(t)
    || /^(?:system\s+slice)\s+(?:for|of|on)\b/i.test(t)
    || /^(?:what\s+should\s+verse\s+build\s+next\s+for)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the idea or process';
}

export function sliceFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    nextSlice: 'A live status card + one automation behind the confirm line that the client can summon',
    owns: [
      'Design and build the next smallest useful system',
      'Connect it to existing tools (reuse-pack)',
      'Test it and add a monitor the client does not watch',
      'Hand off the running piece with ownership clear'
    ],
    clientDoesLess: 'The client no longer tracks progress or builds the first automation themselves'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = sliceFor(text);
  showPage((el) => {
    const owns = pack.owns.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Next system slice: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the heavy lifting. This names the next concrete piece so delivery stays reliable.</p>'
      + '<h3>Proposed next slice</h3><p>' + esc(pack.nextSlice) + '</p>'
      + '<h3>What Verse owns on this slice</h3><ul>' + owns + '</ul>'
      + '<h3>How the client does less</h3><p>' + esc(pack.clientDoesLess) + '</p>'
      + '<p class="sub">Nothing is built yet. Ask for the ownership pack or progress report when this slice ships.</p>'
      + '<div class="src">Source: A-to-Mind system slice · we own the heavy lifting</div>';
  });
  return 'system-slice';
}

export const builtWith = ['client-intake', 'heavy-lift-map', 'ownership-pack', 'progress-report'];
export default {
  name: 'system-slice',
  examples: [
    'next system slice for the client onboarding',
    'system slice for invoice reminders',
    'what should Verse build next for the support flow',
    'propose a system slice for weekly status reports'
  ],
  nearMisses: [
    'what is a slice',
    'system status',
    'progress report',
    'build the system'
  ],
  match: (low, raw) => isSystemSlice(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isSystemSlice) && !this.nearMisses.some(isSystemSlice);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
