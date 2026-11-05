/**
 * client-handoff skill — a shareable handoff card for one system Verse owns.
 * "client handoff for the onboarding automation". The card names what Verse owns and
 * what the client keeps. It does not invent a green status. Nothing is sent.
 */
export function isClientHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:client|business)\s+handoff\b/i.test(t)
    || /^(?:make|generate|create)\s+(?:a\s+)?client\s+handoff\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim() : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

function run(text, api) {
  const { showPage, esc } = api;
  const subject = subjectOf(text);
  showPage((el) => {
    el.innerHTML = '<h2>Client handoff: ' + esc(subject) + '</h2>'
      + '<p><b>Clarified:</b> Verse owns the running system for "' + esc(subject) + '". The client keeps the outcome.</p>'
      + '<h3>What Verse owns</h3><ul>'
      + '<li>Capture and clarify the ask into a system plan</li>'
      + '<li>Design, connect, test, and watch the system, using tools already here first</li>'
      + '<li>The confirm line before anything is sent or spent</li>'
      + '</ul>'
      + '<h3>What the client keeps</h3><ul>'
      + '<li>The outcome and the decision to change it</li>'
      + '<li>A status ask: "system status for ' + esc(subject) + '"</li>'
      + '</ul>'
      + '<p class="sub">No status is invented here. A live check is a separate ask.</p>'
      + '<div class="src">Source: A-to-Mind delivery practice · nothing sent</div>';
  });
  return 'client-handoff';
}

export default {
  name: 'client-handoff',
  examples: [
    'client handoff for the onboarding automation',
    'make a client handoff for the invoice flow',
    'business handoff for weekly status reports',
  ],
  nearMisses: ['handoff pack for my SaaS idea', 'what is a handoff', 'package.json', 'delivery package: invoice reminders'],
  match(lower, text) { return isClientHandoff(text || lower); },
  run,
};
