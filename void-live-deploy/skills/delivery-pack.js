/**
 * delivery-pack skill — capture a business idea and turn it into a structured handoff package
 * that reduces client work: clarified idea, systems to design/build/connect/test/monitor,
 * status/docs/automations to hand off, and the "we own the heavy lifting" package.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "package this idea: automate client onboarding", "handoff pack for my SaaS idea", "delivery package: ..."
 */
export function isDeliveryPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:(?:package|pack|handoff|delivery)\s+(?:this\s+)?(?:idea|business|plan)|(?:create|make|generate)\s+(?:a\s+)?(?:handoff|delivery)\s+(?:pack|package|plan))(?:\s*[:\-]\s*.+)?$/i.test(t);
}

function extractIdea(text) {
  const m = String(text || '').match(/(?:idea|business|plan|for)\s*[:\-]\s*(.+)/i);
  return m ? m[1].trim() : 'unspecified business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Delivery pack</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>Delivery pack: ${esc(idea)}</h2>`,
    `<p><strong>Clarified idea:</strong> Turn "${esc(idea)}" into a system that captures the ask, designs the flow, connects the tools, tests it, and monitors it so the client does less.</p>`,
    `<h3>Systems to own</h3><ul>`,
    `<li>Capture & clarify: structured intake that turns the raw idea into requirements (reuse existing intake)</li>`,
    `<li>Design & build: core workflow or automation</li>`,
    `<li>Connect: existing tools first (see void.existing-tools.md — Workers AI, confirm line, etc.)</li>`,
    `<li>Test: suite checks that prove the handoff works</li>`,
    `<li>Monitor: status line and incident log the client can see</li>`,
    `</ul>`,
    `<h3>Handoff package</h3><ul>`,
    `<li>Status: one-line current state + last green check</li>`,
    `<li>Docs: how it runs, what the client owns vs what we own</li>`,
    `<li>Running automations: the confirm-line approvals already in place</li>`,
    `</ul>`,
    `<h3>Next actions we take</h3><ul>`,
    `<li>Capture the idea into the growth ledger</li>`,
    `<li>Design the minimal system using existing tools</li>`,
    `<li>Hand off the status and docs; we own the running parts</li>`,
    `</ul>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice</div>`
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
    'make a delivery pack for the support ticket router'
  ],
  nearMisses: ['what is a package', 'ship the package', 'package.json'],
  match(lower, text) { return isDeliveryPack(text); },
  run,
  suite() {
    const ok = isDeliveryPack('package this idea: automate onboarding') &&
               isDeliveryPack('handoff pack for my SaaS') &&
               !isDeliveryPack('what is a package');
    return { ok, got: 'match works' };
  }
};
