/**
 * idea-clarifier skill — take a raw business idea and clarify it into concrete requirements,
 * systems to design/build/connect/test/monitor, and a handoff outline so client work is reduced
 * and delivery is more reliable. Reuses the delivery-pack pattern.
 * "clarify this idea: automate client onboarding", "clarify idea: invoice reminders"
 */
export function isIdeaClarifier(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:clarify|clarify\s+this|make\s+clear|turn\s+into\s+systems)\s+(?:this\s+)?(?:idea|business\s+idea|plan)(?:\s*[:\-]\s*.+)?$/i.test(t);
}

function extractIdea(text) {
  const m = String(text || '').match(/(?:idea|plan)\s*[:\-]\s*(.+)/i);
  return m ? m[1].trim() : 'unspecified business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Idea clarifier</h2><div class="sub">clarifying…</div>'; });
  const clarified = [
    `<h2>Clarified: ${esc(idea)}</h2>`,
    `<p><strong>Raw idea:</strong> ${esc(idea)}</p>`,
    `<p><strong>Clarified requirements:</strong> Capture the ask reliably, design the core flow so the client does less, connect existing tools first, prove it with tests, and monitor so status is always handoff-ready.</p>`,
    `<h3>Systems to own (heavy lifting)</h3><ul>`,
    `<li>Capture & clarify: structured intake that turns the raw idea into checkable requirements</li>`,
    `<li>Design & build: the workflow or automation that delivers the outcome</li>`,
    `<li>Connect: reuse existing tools (void.existing-tools.md) before inventing</li>`,
    `<li>Test: one suite check that proves the handoff works</li>`,
    `<li>Monitor: status line the client sees without asking</li>`,
    `</ul>`,
    `<h3>Handoff outline</h3><ul>`,
    `<li>Status: one line + last green</li>`,
    `<li>Docs: client owns outcome, we own the system</li>`,
    `<li>Running automations: confirm-line ready</li>`,
    `</ul>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind idea-to-system delivery</div>`
  ].join('');
  el.innerHTML = clarified;
  return 'idea-clarifier';
}

export default {
  name: 'idea-clarifier',
  examples: [
    'clarify this idea: automate client onboarding',
    'clarify idea: invoice reminders that run themselves',
    'make clear this business idea: support ticket router',
    'turn into systems: lead capture for the SaaS'
  ],
  nearMisses: ['what is an idea', 'clarify the weather', 'idea certificate'],
  match(lower, text) { return isIdeaClarifier(text); },
  run,
  suite() {
    const ok = isIdeaClarifier('clarify this idea: automate onboarding') &&
               isIdeaClarifier('clarify idea: invoice reminders') &&
               !isIdeaClarifier('what is an idea');
    return { ok, got: 'match works' };
  }
};
