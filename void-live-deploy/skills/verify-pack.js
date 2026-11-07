/**
 * verify-pack skill — propose the tests, checks and verification Verse will own
 * for a business process or system so the client does not do the heavy testing.
 * Reduces client work: the card lists the checks, how they run, and what stays off
 * their plate. Nothing is invented as already green. Nothing is sent.
 * "verify pack for client onboarding", "set up tests for the invoice reminders",
 * "what will Verse verify for the support router".
 */
export function isVerifyPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:verify|test|qa)\s+pack\b/i.test(t)
    || /set\s+up\s+(?:tests|checks|verification)\s+for\b/i.test(t)
    || /^(?:propose|make|generate)\s+(?:a\s+)?(?:verify|test|qa)\s+(?:pack|setup|plan)\b/i.test(t)
    || /^(?:what|which)\s+(?:will|does)\s+verse\s+(?:verify|test|check)\s+for\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim() : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the process';
}

function suggestChecks(subject) {
  const t = subject.toLowerCase();
  const checks = [];
  if (/email|inbox|message|customer|support/.test(t)) {
    checks.push('a message arrives and is answered within the window');
    checks.push('confirm-line accepts only the right yes');
  }
  if (/invoice|bill|payment|remind/.test(t)) {
    checks.push('a reminder sends only when unpaid');
    checks.push('paid invoices leave the queue');
  }
  if (/onboard|signup|client|welcome/.test(t)) {
    checks.push('each onboarding step can be completed');
    checks.push('a stalled step surfaces before the client asks');
  }
  if (/report|status|update|weekly|dashboard/.test(t)) {
    checks.push('the report generates on schedule');
    checks.push('the numbers match the source of record');
  }
  if (checks.length === 0) {
    checks.push('the core flow still runs end to end');
    checks.push('a failure surfaces before the client notices');
  }
  return checks;
}

function run(text, api) {
  const { showPage, esc } = api;
  const subject = subjectOf(text);
  const checks = suggestChecks(subject);
  showPage((el) => {
    const list = checks.map((c) => '<li>' + esc(c) + '</li>').join('');
    el.innerHTML = '<h2>Verify pack: ' + esc(subject) + '</h2>'
      + '<p><b>What Verse owns:</b> the tests, the checks, and the proof the client can summon. The client keeps the outcome.</p>'
      + '<h3>Checks Verse will own</h3><ul>' + list + '</ul>'
      + '<h3>How the client is told</h3><ul>'
      + '<li>A status ask: "system status for ' + esc(subject) + '"</li>'
      + '<li>A failure only when something needs a person (confirm line first)</li>'
      + '</ul>'
      + '<p class="sub">Nothing is painted green until a real check answers. Client does not run the suite.</p>'
      + '<div class="src">Source: A-to-Mind delivery practice · nothing sent</div>';
  });
  return 'verify-pack';
}

export default {
  name: 'verify-pack',
  examples: [
    'verify pack for client onboarding',
    'set up tests for the invoice reminders',
    'what will Verse verify for the support router',
    'propose a test pack for weekly status reports',
  ],
  nearMisses: [
    'systems monitor',
    'system status for the onboarding flow',
    'what is a test',
    'test the weather',
  ],
  match(lower, text) { return isVerifyPack(text || lower); },
  run,
};
