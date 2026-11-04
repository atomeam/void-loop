/**
 * delivery-pack skill — capture a business idea and turn it into a structured handoff package
 * that reduces client work: clarified idea, systems to design/build/connect/test/monitor,
 * status/docs/automations to hand off, and the "we own the heavy lifting" package.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "package this idea: automate client onboarding", "handoff pack for my SaaS idea", "delivery package: ..."
 */
export function isDeliveryPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  // the asks the card claims: "package this idea: …", "handoff pack for …", "delivery package: …", "make a delivery pack for …"
  return /^(?:package|pack)\s+this\s+(?:idea|business|plan)\b/i.test(t)
    || /^(?:handoff|delivery)\s+(?:pack|package)\b/i.test(t)
    || /^(?:create|make|generate)\s+(?:a\s+)?(?:handoff|delivery)\s+(?:pack|package|plan)\b/i.test(t);
}

function extractIdea(text) {
  const t = String(text || '');
  const m = t.match(/(?:idea|business|plan)\s*[:\-]\s*(.+)/i) || t.match(/\bfor\s+(?:my\s+|the\s+|a\s+)?(.+)/i) || t.match(/[:\-]\s*(.+)/);
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
    `<li>Capture & clarify: structured intake that turns the raw idea into requirements</li>`,
    `<li>Design & build: core workflow or automation</li>`,
    `<li>Connect: existing tools first (see void.existing-tools.md)</li>`,
    `<li>Test: suite checks that prove the handoff works</li>`,
    `<li>Monitor: status line and incident log the client can see</li>`,
    `</ul>`,
    `<h3>Handoff package</h3><ul>`,
    `<li>Status: one-line current state + last green check</li>`,
    `<li>Docs: how it runs, what the client owns vs what we own</li>`,
    `<li>Running automations: the confirm-line approvals already in place</li>`,
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
  match(lower, text) { return isDeliveryPack(text || lower); },
  run,
  suite() {
    const ok = isDeliveryPack('package this idea: automate onboarding')
      && isDeliveryPack('handoff pack for my SaaS idea')
      && isDeliveryPack('delivery package: invoice reminders that run themselves')
      && isDeliveryPack('make a delivery pack for the support ticket router')
      && !isDeliveryPack('what is a package')
      && !isDeliveryPack('ship the package')
      && !isDeliveryPack('package.json');
    return { ok, got: 'match works' };
  }
};
