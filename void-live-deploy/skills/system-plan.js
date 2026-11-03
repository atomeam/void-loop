/**
 * system-plan skill — capture a business idea and turn it into a clarified system plan
 * that lists what to design/build/connect/test/monitor, reuses existing tools first,
 * and packages the handoff so we own the heavy lifting.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 * "system plan for: automate client onboarding", "idea to system: invoice reminders"
 */
export function isSystemPlan(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:(?:system|idea)\s+(?:plan|to\s+system)|(?:make|create|generate|turn)\s+(?:this\s+)?(?:into\s+)?(?:a\s+)?(?:system\s+plan|idea\s+to\s+system))(?:\s*[:\-]\s*.+)?$/i.test(t);
}

function extractIdea(text) {
  const m = String(text || '').match(/(?:for|idea|plan)\s*[:\-]\s*(.+)/i);
  return m ? m[1].trim() : 'unspecified business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>System plan</h2><div class="sub">building…</div>'; });
  const plan = [
    `<h2>System plan: ${esc(idea)}</h2>`,
    `<p><strong>Clarified idea:</strong> Capture the raw ask "${esc(idea)}" into requirements, then own the design, connections, tests, and monitoring so the client receives a running outcome.</p>`,
    `<h3>What we capture and clarify</h3><ul>`,
    `<li>Requirements: the steps the system must perform without client babysitting</li>`,
    `<li>Success: one clear outcome the client can check</li>`,
    `</ul>`,
    `<h3>Systems we design, build, connect, test, monitor</h3><ul>`,
    `<li>Design: the core flow (intake → action → confirm → record)</li>`,
    `<li>Connect existing tools first: confirm line for approvals, growth ledger for records, status card for monitoring (see domains/void.existing-tools.md)</li>`,
    `<li>Build only what is missing</li>`,
    `<li>Test: suite checks that prove the handoff works end to end</li>`,
    `<li>Monitor: status line the client sees, incident log that opens and closes itself</li>`,
    `</ul>`,
    `<h3>Handoff package</h3><ul>`,
    `<li>Status: current state + last green check</li>`,
    `<li>Docs: what runs, what the client owns vs what we own</li>`,
    `<li>Running automations: approvals already on the confirm line</li>`,
    `</ul>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind idea-to-system practice</div>`
  ].join('');
  el.innerHTML = plan;
  return 'system-plan';
}

export default {
  name: 'system-plan',
  examples: [
    'system plan for: automate client onboarding',
    'idea to system: invoice reminders that run themselves',
    'make a system plan for the support ticket router',
    'generate system plan: connect CRM to billing'
  ],
  nearMisses: ['what is a system', 'plan a party', 'system of equations'],
  match(lower, text) { return isSystemPlan(text); },
  run,
  suite() {
    const ok = isSystemPlan('system plan for: automate onboarding') &&
               isSystemPlan('idea to system: invoice reminders') &&
               !isSystemPlan('what is a system');
    return { ok, got: ok ? 'match works' : 'match failed' };
  }
};
