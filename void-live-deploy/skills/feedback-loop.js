/**
 * feedback-loop skill — capture client feedback on a shipped system slice and turn it into the next clarified idea
 * or system adjustment so Verse owns the iteration and the client does less.
 * Rules-based, offline. Nothing is sent.
 * "feedback on the onboarding slice", "client feedback for invoice reminders", "what next from the status report feedback".
 */
export function isFeedbackLoop(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:feedback|client\s+feedback)\s+(?:on|for|from)\b/i.test(t)
    || /^(?:capture|record|log)\s+(?:client\s+)?feedback\b/i.test(t)
    || /^(?:next\s+from|what\s+next\s+from)\s+(?:the\s+)?(?:.+?\s+)?feedback\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:on|for|from|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the shipped slice';
}

export function loopFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    captured: 'Client feedback recorded as the next input for clarification',
    next: 'Turn the feedback into a refined idea or the next system slice Verse owns',
    owns: [
      'Capture and clarify the feedback into systems',
      'Propose the adjustment or next slice',
      'Hand off the updated status so the client does not chase',
      'We own the heavy lifting of the iteration'
    ],
    clientDoesLess: 'The client no longer organizes feedback or designs the next piece themselves'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = loopFor(text);
  showPage((el) => {
    const owns = pack.owns.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Feedback loop: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the heavy lifting. This captures feedback and turns it into the next reliable delivery.</p>'
      + '<h3>Captured</h3><p>' + esc(pack.captured) + '</p>'
      + '<h3>What next</h3><p>' + esc(pack.next) + '</p>'
      + '<h3>What Verse owns</h3><ul>' + owns + '</ul>'
      + '<h3>How the client does less</h3><p>' + esc(pack.clientDoesLess) + '</p>'
      + '<p class="sub">Nothing is built yet. Ask for the system-slice or progress-report when ready.</p>'
      + '<div class="src">Source: A-to-Mind feedback loop · we own the heavy lifting</div>';
  });
  return 'feedback-loop';
}

export const builtWith = ['system-slice', 'client-intake', 'progress-report'];
export default {
  name: 'feedback-loop',
  examples: [
    'feedback on the onboarding slice',
    'client feedback for invoice reminders',
    'capture feedback from the status report',
    'what next from the support flow feedback'
  ],
  nearMisses: [
    'what is feedback',
    'system slice',
    'progress report',
    'client intake'
  ],
  match: (low, raw) => isFeedbackLoop(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isFeedbackLoop) && !this.nearMisses.some(isFeedbackLoop);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
