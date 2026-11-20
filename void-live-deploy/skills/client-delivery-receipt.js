/**
 * client-delivery-receipt skill — a client-facing receipt of the full delivery package
 * for a business idea: systems Verse owns, docs, running automations (confirm-line gated),
 * monitors and last status. Reduces client chasing; makes "verse does the hard work" concrete.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "delivery receipt for my idea: automate invoice reminders",
 * "show the receipt for client onboarding",
 * "what did Verse hand off for the support router"
 */
export function isClientDeliveryReceipt(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:delivery|handoff|ownership)\s+receipt\b/i.test(t)
    || /^(?:show|give|generate|make)\s+(?:me\s+)?(?:the\s+|a\s+)?(?:delivery|handoff)?\s*receipt\b/i.test(t)
    || /^(?:what|which)\s+(?:did|has|does)\s+Verse\s+(?:hand\s+off|own|deliver)\s+for\b/i.test(t);
}

function extractIdea(text) {
  const t = String(text || '');
  const m = t.match(/(?:idea|for|:\s*)[:\-]?\s*(.+)/i) || t.match(/\b(?:for|of)\s+(.+)/i);
  return m ? m[1].trim().replace(/^(my|the|a)\s+/i, '') : 'the business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Delivery receipt</h2><div class="sub">building…</div>'; });
  const html = [
    `<h2>Delivery receipt: ${esc(idea)}</h2>`,
    `<p><strong>Idea captured:</strong> "${esc(idea)}" — Verse owns the systems so the client keeps the outcome.</p>`,
    `<h3>Systems Verse owns</h3><ul>`,
    `<li>Capture & clarify — intake to requirements</li>`,
    `<li>Design & build — core automation or workflow</li>`,
    `<li>Connect — existing tools first</li>`,
    `<li>Test — suite checks before handoff</li>`,
    `<li>Monitor — status and next-check the client can read</li>`,
    `</ul>`,
    `<h3>Handoff included</h3><ul>`,
    `<li>Docs: how it runs, client owns vs Verse owns</li>`,
    `<li>Running automations: confirm-line approvals in place</li>`,
    `<li>Status: last green check + next check date</li>`,
    `<li>Monitors: what is watched and how the client is told</li>`,
    `</ul>`,
    `<p class="sub">The receipt lists what Verse took over. Client work that drops: status chasing, integration glue, monitoring duty.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice · as of 2026-11</div>`
  ].join('');
  el.innerHTML = html;
  return 'client-delivery-receipt';
}

export default {
  name: 'client-delivery-receipt',
  examples: [
    'delivery receipt for my idea: automate invoice reminders',
    'show the receipt for client onboarding',
    'what did Verse hand off for the support router',
    'make a delivery receipt for the SaaS billing flow'
  ],
  nearMisses: ['receipt for lunch', 'delivery time', 'what is a receipt'],
  match(lower, text) { return isClientDeliveryReceipt(text || lower); },
  run,
  suite() {
    const ok = isClientDeliveryReceipt('delivery receipt for my idea: automate invoice reminders')
      && isClientDeliveryReceipt('show the receipt for client onboarding')
      && !isClientDeliveryReceipt('receipt for lunch');
    return { ok };
  }
};
