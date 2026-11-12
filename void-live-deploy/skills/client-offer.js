/**
 * client-offer skill — package a business idea into a sellable offer of the systems, automations, monitoring and handoff included.
 * Turns the idea into what the client currently does, what Verse takes over (systems, automations, monitoring, handoff),
 * the reduced client work, and the next step to start. Rules-based, offline. Nothing is sent. The card stays on the stage
 * so the offer can be shared or kept.
 * "client offer for the email automation", "offer for weekly reports",
 * "package this as an offer: client onboarding that runs itself".
 */
export function isClientOffer(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t) return false;
  return /^(?:client\s+offer|offer\s+to\s+own|package\s+this\s+as\s+an\s+offer|offer\s+for)\b/i.test(t)
    || /^(?:make|generate|create|build)\s+(?:a\s+)?(?:client\s+)?offer\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 2 ? s.slice(0, 160) : 'this business idea';
}

export function offerFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    today: 'Manual follow-ups, status chasing, repeated setup and monitoring.',
    takesOver: [
      'Capture and clarify the idea into a system plan',
      'Design, build, connect, test and monitor the systems',
      'Run the automations behind the confirm line',
      'Hand off status, docs and running jobs'
    ],
    reduced: 'No more building the tools, watching the runs, or writing the status. One yes on the outcome.',
    next: 'Start with a client brief or idea-to-system card for ' + name + '. The offer stays here for sharing.'
  };
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const offer = offerFor(text);
  const takes = offer.takesOver.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Client offer: ' + esc(name) + '</h2>'
      + '<p>An offer of the systems, automations, monitoring and handoff included.</p>'
      + '<h3>What the client does today</h3><p>' + esc(offer.today) + '</p>'
      + '<h3>What Verse takes over</h3><ul>'
      + takes
      + '</ul>'
      + '<h3>Reduced client work</h3><p>' + esc(offer.reduced) + '</p>'
      + '<h3>Next step</h3><p>' + esc(offer.next) + '</p>'
      + '<p class="sub">Nothing is sent. The offer stays with the client.</p>'
      + '<div class="src">Source: A-to-Mind client offer</div>';
  });
  return 'client-offer';
}

export const builtWith = ['client-brief', 'idea-to-system', 'handoff-checklist', 'delivery-pack'];
export default {
  name: 'client-offer',
  examples: [
    'client offer for the email automation',
    'offer for weekly reports',
    'package this as an offer: client onboarding that runs itself',
    'make a client offer for invoice reminders',
    'offer for the support router'
  ],
  nearMisses: [
    'client brief for Acme',
    'handoff checklist for onboarding',
    'ownership pack for Acme',
    'system status for onboarding'
  ],
  match(lower) { return isClientOffer(lower); },
  run
};
