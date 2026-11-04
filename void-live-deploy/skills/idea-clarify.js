/**
 * idea-clarify skill — capture a rough business idea and clarify it into systems to design, build, connect, test, and monitor,
 * plus handoff points, so A-to-Mind can take over the heavy lifting.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "clarify this idea: lead capture for our SaaS", "idea clarify: automate invoice follow-ups", "capture and clarify the onboarding flow"
 */
export function isIdeaClarify(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:(?:clarify|capture and clarify|idea clarify|clarify idea)\s+(?:this\s+)?(?:idea|business|plan)|(?:capture|clarify)\s+(?:and\s+)?(?:clarify\s+)?(?:the\s+)?(?:idea|business|flow|onboarding|system))(?:\s*[:\-]\s*.+)?$/i.test(t);
}

function extractIdea(text) {
  const m = String(text || '').match(/(?:idea|business|plan|flow|for)\s*[:\-]\s*(.+)/i);
  return m ? m[1].trim() : 'unspecified business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Idea clarify</h2><div class="sub">clarifying…</div>'; });
  const clarified = [
    `<h2>Clarified: ${esc(idea)}</h2>`,
    `<p><strong>Captured idea:</strong> ${esc(idea)} — turn the rough ask into a reliable system that reduces client work.</p>`,
    `<h3>Systems to own</h3><ul>`,
    `<li>Capture: structured intake form or chat that records the idea with requirements</li>`,
    `<li>Clarify: requirements list, user stories, acceptance criteria</li>`,
    `<li>Design & build: core automation or workflow (reuse existing tools first)</li>`,
    `<li>Connect: link to current stack (see domains/void.existing-tools.md)</li>`,
    `<li>Test: suite checks that prove the system meets the clarified requirements</li>`,
    `<li>Monitor: status line, health checks, and incident log visible to the client</li>`,
    `</ul>`,
    `<h3>Handoff</h3><ul>`,
    `<li>Status doc: current state, last test green, what we own vs client owns</li>`,
    `<li>Running automations: approvals via the confirm line</li>`,
    `<li>Package: "we own the heavy lifting" — client keeps the outcome</li>`,
    `</ul>`,
    `<p class="sub">Clarified so delivery is reliable and client work drops.</p>`,
    `<div class="src">Source: A-to-Mind idea-to-system practice</div>`
  ].join('');
  el.innerHTML = clarified;
  return 'idea-clarify';
}

export default {
  name: 'idea-clarify',
  examples: [
    'clarify this idea: lead capture for our SaaS',
    'idea clarify: automate invoice follow-ups',
    'capture and clarify the onboarding flow',
    'clarify idea: status handoff for client projects'
  ],
  nearMisses: ['what is clarify', 'clarify the code', 'idea for a game'],
  match(lower, text) { return isIdeaClarify(text); },
  run,
  suite() {
    const ok = isIdeaClarify('clarify this idea: lead capture') &&
               isIdeaClarify('idea clarify: automate invoices') &&
               !isIdeaClarify('what is clarify');
    return { ok, got: 'match works' };
  }
};
