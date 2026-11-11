/**
 * docs-pack skill — package client-facing documentation for a system, process or business idea Verse owns.
 * Makes handoff reliable: status summary, ownership, monitors, next steps and "we own the heavy lifting" in one card.
 * "docs pack for Acme onboarding", "client docs for the invoice reminders", "document the system Verse owns".
 * Nothing is sent. The card stays on the stage for the client to keep or share.
 */
export function isDocsPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t) return false;
  return /^(?:docs\s+(?:pack|package)|client\s+docs|document\s+(?:the\s+)?(?:system|process)|handoff\s+docs)\b/i.test(t)
    || /^(?:package\s+the\s+docs|docs\s+for)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 2 ? s.slice(0, 160) : 'this system or idea';
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  showPage((el) => {
    el.innerHTML = '<h2>Docs pack: ' + esc(name) + '</h2>'
      + '<p>Verse owns the heavy lifting. This packages the docs so the client does less chasing.</p>'
      + '<h3>What is documented</h3><ul>'
      + '<li>What the system does and who owns each piece</li>'
      + '<li>Current status and the monitors Verse watches</li>'
      + '<li>How to summon the status card or running automation</li>'
      + '<li>Next handoff step and what the client still decides</li>'
      + '</ul>'
      + '<h3>Client does less</h3>'
      + '<p>No reading raw code, no watching dashboards, no chasing status. The card is the docs.</p>'
      + '<h3>Next step</h3>'
      + '<p>Ask "system status for ' + esc(name) + '" or "ownership pack for ' + esc(name) + '" to deepen the handoff.</p>'
      + '<p class="sub">Nothing is sent. Docs stay with the client.</p>'
      + '<div class="src">Source: A-to-Mind docs pack · we own the heavy lifting</div>';
  });
  return 'docs-pack';
}

export const builtWith = ['ownership-pack', 'system-status', 'system-handoff', 'progress-report'];
export default {
  name: 'docs-pack',
  examples: [
    'docs pack for Acme onboarding',
    'client docs for the invoice reminders',
    'document the system Verse owns for support',
    'docs for the weekly report automation',
    'handoff docs for the client portal',
  ],
  nearMisses: [
    'ownership pack for Acme',
    'system status for onboarding',
    'delivery pack for my idea',
    'what are the docs',
    'write the documentation',
  ],
  match(lower, text) { return isDocsPack(text || lower); },
  run,
};
