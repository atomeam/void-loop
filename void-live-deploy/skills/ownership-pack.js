/**
 * ownership-pack skill — map a client, process or system to what Verse owns versus what the client owns.
 * Reduces client work by making ownership explicit in every handoff: design/build/connect/test/monitor stay with Verse;
 * the outcome, final approval and any client-side data stay with the client.
 * "ownership pack for Acme", "what does Verse own for the onboarding flow", "ownership map for weekly reports".
 * Nothing is sent. The card stays on the stage for the client to keep.
 */
export function isOwnershipPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t) return false;
  return /^(?:ownership\s+(?:pack|package|map)|what\s+(?:does\s+)?verse\s+own(?:\s+for)?|ownership\s+for)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 2 ? s.slice(0, 160) : 'this client or process';
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  showPage((el) => {
    el.innerHTML = '<h2>Ownership pack: ' + esc(name) + '</h2>'
      + '<p>Verse owns the heavy lifting. The client owns the outcome.</p>'
      + '<h3>Verse owns</h3><ul>'
      + '<li>Capture and clarify the idea into a system plan</li>'
      + '<li>Design, build, connect, test and monitor the systems</li>'
      + '<li>Status cards, docs and running automations</li>'
      + '<li>Alerts and verification so the client does not watch dashboards</li>'
      + '</ul>'
      + '<h3>Client owns</h3><ul>'
      + '<li>The business outcome and any final approval</li>'
      + '<li>Client-side data, accounts and credentials</li>'
      + '<li>Decisions that only the client can make</li>'
      + '</ul>'
      + '<h3>Next delivery step</h3>'
      + '<p>Ask "system status for ' + esc(name) + '" or "system handoff for ' + esc(name) + '" to hand off a living card.</p>'
      + '<p class="sub">Nothing is sent. Ownership is named so the client does less.</p>'
      + '<div class="src">Source: A-to-Mind ownership pack · we own the heavy lifting</div>';
  });
  return 'ownership-pack';
}

export const builtWith = ['system-handoff', 'delivery-pack', 'business-clarify'];
export default {
  name: 'ownership-pack',
  examples: [
    'ownership pack for Acme',
    'what does Verse own for the onboarding flow',
    'ownership map for weekly reports',
    'ownership for the client portal',
  ],
  nearMisses: [
    'client handoff for Acme',
    'system status for onboarding',
    'delivery pack for my idea',
    'what is ownership',
    'handoff the system',
  ],
  match(lower, text) { return isOwnershipPack(text || lower); },
  run,
};
