/**
 * proposal-pack skill — turn a business idea or process into a client proposal
 * that packages what Verse owns (design, build, connect, test, monitor, docs, handoff)
 * and what the client keeps (outcomes, decisions). Frames "we own the heavy lifting".
 * Built from the delivery practice already on main (delivery-pack, system-handoff,
 * heavy-lift-map). Nothing is sent; no status is invented.
 */
export function isProposalPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:proposal|client\s+proposal|sow|statement\s+of\s+work)\s+(?:pack|package|for)\b/i.test(t)
    || /^(?:make|generate|create|write)\s+(?:a\s+)?(?:client\s+)?proposal\b/i.test(t)
    || /^(?:proposal\s+pack|pack\s+a\s+proposal)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim() : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the idea';
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  showPage((el) => {
    el.innerHTML = '<h2>Proposal pack: ' + esc(name) + '</h2>'
      + '<p>Verse owns the heavy lifting. The client keeps the outcome and the decisions.</p>'
      + '<h3>What Verse owns</h3><ul>'
      + '<li>Capture and clarify the idea into a system plan</li>'
      + '<li>Design, build, connect, test and monitor the systems</li>'
      + '<li>Docs, status handoff and running automations on the confirm line</li>'
      + '<li>Monitors and verification so the client does not watch dashboards or run tests</li>'
      + '</ul>'
      + '<h3>What the client keeps</h3><ul>'
      + '<li>The business outcome and the final yes on scope</li>'
      + '<li>Feedback and priority calls</li>'
      + '<li>Access to status, docs and the handoff package</li>'
      + '</ul>'
      + '<h3>Next</h3><ul>'
      + '<li>Ask "delivery pack for ' + esc(name) + '" for the systems list</li>'
      + '<li>Ask "system handoff for ' + esc(name) + '" once it is running</li>'
      + '<li>Ask "monitor pack for ' + esc(name) + '" for the checks Verse will own</li>'
      + '</ul>'
      + '<p class="sub">No status invented. No message sent. A real check is a separate ask.</p>'
      + '<div class="src">Source: A-to-Mind proposal pack · nothing sent</div>';
  });
  return 'proposal-pack';
}

export const builtWith = ['delivery-pack', 'system-handoff', 'heavy-lift-map'];
export default {
  name: 'proposal-pack',
  examples: [
    'proposal pack for client onboarding automation',
    'make a client proposal for invoice reminders',
    'generate a proposal for the support ticket router',
    'proposal pack: weekly report automation',
    'write a proposal for my CRM sync process',
    'client proposal pack for the onboarding flow',
  ],
  nearMisses: [
    'delivery pack for my idea',
    'system handoff for billing',
    'what is a proposal',
    'client handoff for the automation',
    'clarify this business idea',
  ],
  match(lower, text) { return isProposalPack(text || lower); },
  run,
};
