/**
 * full-lift-plan skill — capture a business idea and turn it into the complete ownership plan
 * Verse uses to take over the heavy lifting: clarified systems, connections, tests, monitors,
 * handoff docs and the client work that drops.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "full lift plan for my idea: automate invoice reminders",
 * "ownership plan for client onboarding system",
 * "what systems does Verse own for this business idea"
 */
export function isFullLiftPlan(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:full\s+lift|ownership|systems?\s+ownership)\s+plan\b/i.test(t)
    || /^(?:what|which)\s+systems?\s+(?:does|will)\s+Verse\s+own\b/i.test(t)
    || /^(?:package|make|generate)\s+(?:a\s+)?(?:full\s+)?(?:lift|ownership)\s+plan\b/i.test(t);
}

function extractIdea(text) {
  const t = String(text || '');
  const m = t.match(/(?:idea|system|for|:\s*)[:\-]?\s*(.+)/i) || t.match(/\b(?:for|of)\s+(.+)/i);
  return m ? m[1].trim().replace(/^(my|the|a)\s+/i, '') : 'the business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Full lift plan</h2><div class="sub">building…</div>'; });
  const html = [
    `<h2>Full lift plan: ${esc(idea)}</h2>`,
    `<p><strong>Clarified idea:</strong> Turn "${esc(idea)}" into owned systems so the client stops doing the heavy work.</p>`,
    `<h3>Systems Verse owns</h3><ul>`,
    `<li>Capture & clarify — structured intake turns the raw ask into requirements and acceptance criteria</li>`,
    `<li>Design & build — core workflow or automation built and versioned</li>`,
    `<li>Connect — links to existing tools first (see domains/void.existing-tools.md); no new invent unless required</li>`,
    `<li>Test — suite checks and live probes that prove the system works before handoff</li>`,
    `<li>Monitor — status line, incident notes and next-check date the client can read without chasing</li>`,
    `</ul>`,
    `<h3>Client work that drops</h3><ul>`,
    `<li>No manual status chasing — one receipt shows what is running and what was last green</li>`,
    `<li>No integration glue — Verse owns the connections and the confirm-line approvals</li>`,
    `<li>No monitoring duty — Verse watches and reports; client only acts on real exceptions</li>`,
    `</ul>`,
    `<h3>Handoff package</h3><ul>`,
    `<li>Status: one-line current state + last green check</li>`,
    `<li>Docs: how it runs, what the client owns vs what Verse owns</li>`,
    `<li>Running automations: the confirm-line approvals already in place</li>`,
    `<li>Next step: client types the summon asks or receives the monitor receipt</li>`,
    `</ul>`,
    `<p class="sub">The plan lists the systems Verse owns, the client work that disappears, and the handoff that keeps delivery reliable.</p>`,
    `<div class="src">Source: A-to-Mind full-lift practice · as of 2026-11</div>`
  ].join('');
  el.innerHTML = html;
  return 'full-lift-plan';
}

export default {
  name: 'full-lift-plan',
  examples: [
    'full lift plan for my idea: automate invoice reminders',
    'ownership plan for client onboarding system',
    'what systems does Verse own for this business idea',
    'make a full lift plan for support ticket routing'
  ],
  nearMisses: ['lift weights', 'plan my day', 'what is a plan'],
  match(lower, text) { return isFullLiftPlan(text || lower); },
  run,
  suite() {
    const ok = isFullLiftPlan('full lift plan for my idea: automate invoice reminders')
      && isFullLiftPlan('ownership plan for client onboarding system')
      && !isFullLiftPlan('lift weights');
    return { ok };
  }
};
