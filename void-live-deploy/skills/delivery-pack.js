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

function clarify(idea) {
  return {
    problem: `The client currently handles "${idea}" by hand, creating delays, missed steps, or inconsistent outcomes.`,
    outcome: `A system that captures the ask, runs the flow, and reports status so the client only reviews outcomes.`,
    users: 'Primary: the business owner or ops lead. Secondary: the end customer or team member who triggers the flow.',
    flows: ['Intake that turns a raw ask into structured requirements', 'Core workflow or automation that executes the work', 'Connection to existing tools (confirm line, status, approvals)', 'Test suite that proves the handoff is reliable', 'Monitor that surfaces green checks and incidents the client can see']
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const c = clarify(idea);
  const el = showPage((p) => { p.innerHTML = '<h2>Delivery pack</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>Delivery pack: ${esc(idea)}</h2>`,
    `<p><strong>Clarified idea</strong></p>`,
    `<p>${esc(c.problem)}</p>`,
    `<p><strong>Outcome we deliver:</strong> ${esc(c.outcome)}</p>`,
    `<p><strong>Who:</strong> ${esc(c.users)}</p>`,
    `<h3>Systems we own (using existing tools first)</h3><ul>`,
    ...c.flows.map(f => `<li>${esc(f)}</li>`),
    `<li>Approvals: Verse confirm line (void_approvals / void_ledger) before any send, book or spend</li>`,
    `<li>Running after you leave: approve-card for clock-based automations</li>`,
    `<li>Status the client sees: one-line current state + last green check + incident log</li>`,
    `</ul>`,
    `<h3>Handoff package (client keeps the outcome, we keep the heavy lifting)</h3><ul>`,
    `<li><strong>Status line:</strong> "${esc(idea)} — green, last check [time], next run [time]"</li>`,
    `<li><strong>Docs:</strong> how the flow starts, what the client owns (final yes, customer relationship), what we own (build, connect, test, monitor, recover)</li>`,
    `<li><strong>Running automations:</strong> list of confirm-line rules and approve-cards already wired</li>`,
    `<li><strong>Recovery:</strong> how to pause, abort, or re-run without the client rebuilding anything</li>`,
    `</ul>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice · existing tools checked before any new build</div>`
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
    'pack this business plan: weekly client status reports'
  ],
  nearMisses: ['what is a package', 'ship the package', 'package.json', 'handoff the keys'],
  match(lower, text) { return isDeliveryPack(text); },
  run,
  suite() {
    const ok = isDeliveryPack('package this idea: automate onboarding') &&
               isDeliveryPack('handoff pack for my SaaS') &&
               isDeliveryPack('pack this business plan: weekly reports') &&
               !isDeliveryPack('what is a package') &&
               !isDeliveryPack('ship the package');
    const idea = extractIdea('package this idea: automate onboarding');
    const clarified = idea === 'automate onboarding';
    return { ok: ok && clarified, got: ok && clarified ? 'match and extract work' : 'failed' };
  }
};
