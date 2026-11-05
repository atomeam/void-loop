/**
 * client-handoff skill — generate a shareable client handoff package for a business system Verse owns.
 * Reduces client work: clarified idea, systems Verse owns (using existing tools first), status monitors,
 * docs outline, and the "we own the heavy lifting" statement. Client keeps the outcome.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "client handoff for the onboarding automation", "handoff pack for my client: weekly reports", "package handoff for the support flow"
 */
export function isClientHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:client|business)\s+handoff\b/i.test(t)
    || /^(?:make|generate|create|package)\s+(?:a\s+)?(?:client\s+)?handoff\b/i.test(t)
    || /^handoff\s+(?:pack|package|for)\b/i.test(t);
}

function extractSubject(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|of)\s+(?:the\s+|my\s+|a\s+)?(.+)/i) || t.match(/[:-]\s*(.+)/);
  return m ? m[1].trim() : 'the system';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const subject = extractSubject(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Client handoff</h2><div class="sub">building…</div>'; });
  const html = [
    `<h2>Client handoff: ${esc(subject)}</h2>`,
    `<p><strong>Clarified:</strong> Verse owns the heavy lifting for "${esc(subject)}" so the client does less.</p>`,
    `<h3>What Verse owns</h3><ul>`,
    `<li>Capture & clarify the ask into a system plan (business-clarify)</li>`,
    `<li>Design, build, connect, test, and monitor the systems (using existing tools first)</li>`,
    `<li>Status line and incident log the client can see (system-status)</li>`,
    `<li>Running automations with the confirm-line approvals already in place</li>`,
    `</ul>`,
    `<h3>Handoff package for the client</h3><ul>`,
    `<li>This card: current ownership and what to ask next</li>`,
    `<li>Status: ask "system status for ${esc(subject)}" for a live check</li>`,
    `<li>Docs: how it runs, what the client owns vs what Verse owns</li>`,
    `<li>Automations: already gated by the confirm line</li>`,
    `</ul>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice</div>`
  ].join('');
  el.innerHTML = html;
  return 'client-handoff';
}

const EXAMPLES = [
  'client handoff for the onboarding automation',
  'handoff pack for my client: weekly status reports',
  'make a client handoff for the invoice flow',
  'package handoff for the support ticket router',
  'generate handoff for the client portal'
];
const NEAR = [
  'what is a handoff',
  'client list',
  'handoff the baton',
  'package.json',
  'delivery pack'
];

export default {
  name: 'client-handoff',
  examples: EXAMPLES,
  nearMisses: NEAR,
  match(lower, text) { return isClientHandoff(text || lower); },
  run,
  suite() {
    const ok = EXAMPLES.every(isClientHandoff) && !NEAR.some(isClientHandoff);
    return { ok, got: ok ? 'match works' : 'match broke' };
  },
};
