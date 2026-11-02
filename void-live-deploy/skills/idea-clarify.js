/**
 * idea-clarify skill — turns a rough business idea into a clarified canvas with systems to design, build, connect, test, and monitor, plus handoff points.
 * Helps capture and clarify ideas so A-to-Mind can take over the heavy lifting.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /(?:clarify|structure|break down|outline|canvas|map).*(?:idea|business|venture|product|saas|service|platform)|(?:business|product|service) idea|heavy lifting|systems for|canvas for/i;

function extractIdea(text) {
  // Strip the trigger phrases and take the rest as the idea.
  return text.replace(/^(?:clarify|help me structure|break down|outline|make a canvas for|map)\s+(?:my\s+)?(?:business\s+)?idea(?:\s*:\s*|\s+about\s+)?/i, '').trim() || text;
}

function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const canvas = {
    core: idea,
    customer: "Who pays or benefits? (e.g. students, parents, schools)",
    problem: "What pain or job does this solve?",
    solution: "The offering in one sentence.",
    systems: [
      "Capture: intake form or chat that records the idea and constraints",
      "Design: mockups or architecture of the core loop (match, schedule, deliver)",
      "Build: MVP of the primary transaction (payment, matching, content)",
      "Connect: integrations (calendar, payments, auth, notifications)",
      "Test: acceptance checks for the happy path and edge cases",
      "Monitor: status dashboard, error alerts, usage metrics",
      "Handoff: client-ready docs, running automation summary, ownership transfer"
    ],
    next: "Pick the smallest system that reduces client work first (usually capture + handoff status)."
  };

  showPage((el) => {
    el.innerHTML = `
      <h2>${esc("Clarified idea")}</h2>
      <p><strong>Core:</strong> ${esc(canvas.core)}</p>
      <p><strong>Customer:</strong> ${esc(canvas.customer)}</p>
      <p><strong>Problem:</strong> ${esc(canvas.problem)}</p>
      <p><strong>Solution:</strong> ${esc(canvas.solution)}</p>
      <h3>Systems to own the heavy lifting</h3>
      <ul>${canvas.systems.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
      <p><strong>Next:</strong> ${esc(canvas.next)}</p>
      <div class="src">Source: structured from your words · A-to-Mind idea-to-system · as of 2026-11</div>
    `;
  });
  return "idea-clarify";
}

export default {
  name: "idea-clarify",
  examples: [
    "clarify my business idea: online tutoring platform for high school math",
    "help me structure this idea into systems we can build",
    "break down the idea of a local bakery delivery service",
    "canvas for a B2B SaaS that automates invoice chasing"
  ],
  nearMisses: [
    "what's the weather",
    "calculate 2+2",
    "tell me a joke"
  ],
  match(lower) { return WHEN.test(lower); },
  run
};
