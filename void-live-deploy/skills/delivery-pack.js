/**
 * delivery-pack skill — capture a business idea and turn it into a structured handoff package
 * that reduces client work: clarified idea, systems to design/build/connect/test/monitor,
 * status/docs/automations to hand off, and the "we own the heavy lifting" package.
 * Reuses existing Verse tools (notebook, approval-gate, incident-log, growth ledger, automation-fix)
 * instead of inventing new ones.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "package this idea: automate client onboarding", "handoff pack for my SaaS idea", "delivery package: ..."
 */
export function isDeliveryPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /(?:package|pack|handoff|delivery)\s+(?:this\s+)?(?:idea|business|plan)|(?:create|make|generate)\s+(?:a\s+)?(?:handoff|delivery)\s+(?:pack|package|plan)/i.test(t);
}

function extractIdea(text) {
  const m = String(text || '').match(/(?:idea|business|plan|for|package)\s*[:\-]\s*(.+)/i) ||
            String(text || '').match(/(?:idea|business)\s+(.+)/i);
  return m ? m[1].trim() : 'unspecified business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Delivery pack</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>Delivery pack: ${esc(idea)}</h2>`,
    `<p><strong>Clarified idea:</strong> Capture "${esc(idea)}" in the notebook (linked notes + daily note), turn it into requirements, then own the design, build, connect, test and monitor so the client does less.</p>`,
    `<h3>Systems we own (reuse existing)</h3><ul>`,
    `<li>Capture & clarify: notebook skill + structured intake (domains/inputs/)</li>`,
    `<li>Design & build: core workflow using existing tools first (void.existing-tools.md)</li>`,
    `<li>Connect: approval-gate, automation-fix, and the confirm-line already live</li>`,
    `<li>Test: one suite check that proves the handoff (this skill's suite)</li>`,
    `<li>Monitor: incident-log + growth ledger proof the client can recompute</li>`,
    `</ul>`,
    `<h3>Handoff package for the client</h3><ul>`,
    `<li>Status: one-line current state from the growth ledger + last green check</li>`,
    `<li>Docs: how it runs, what the client owns (outcome) vs what we own (lifting)</li>`,
    `<li>Running automations: approvals already gated; no new secrets</li>`,
    `</ul>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice · existing tools only</div>`
  ].join('');
  el.innerHTML = pack;
  return 'delivery-pack';
}

export default {
  name: 'delivery-pack',
  examples: [
    'package this idea: automate client onboarding',
    'handoff pack for my SaaS idea',
    'delivery package: invoice reminders that run themselves',
    'make a delivery pack for the support ticket router',
    'create a handoff package for the booking system'
  ],
  nearMisses: ['what is a package', 'ship the package', 'package.json'],
  match(lower, text) { return isDeliveryPack(text); },
  run,
  suite() {
    const ok = isDeliveryPack('package this idea: automate onboarding') &&
               isDeliveryPack('handoff pack for my SaaS') &&
               isDeliveryPack('create a handoff package for booking') &&
               !isDeliveryPack('what is a package') &&
               extractIdea('package this idea: invoice reminders') === 'invoice reminders';
    return { ok, got: ok ? 'match and extract work' : 'suite failed' };
  }
};
