/**
 * system-sketch skill — capture and clarify a business idea into a system design
 * that A-to-Mind can own the heavy lifting for: design, build, connect, test, monitor.
 * Reduces client work by producing a clear handoff-ready sketch from a raw idea.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "sketch the system for: automate invoices", "clarify idea into system: client portal", "system design for my SaaS"
 */
export function isSystemSketch(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const re = /^(?:sketch|design|clarify|outline)\s+(?:the\s+)?(?:system|idea)(?:\s+(?:for|from|of|into))?(?:\s+(?:a\s+)?system)?(?:\s*[:\-]\s*.+)?$|^system\s+(?:sketch|design)(?:\s+(?:for|of))?(?:\s+.+$)?$|^turn\s+(?:this\s+)?idea\s+into\s+(?:a\s+)?system(?:\s*[:\-]\s*.+)?$/i;
  return re.test(t);
}

function extractIdea(text) {
  const m = String(text || '').match(/(?:for|from|of|into|:)\s*(.+)/i);
  return m ? m[1].trim() : 'unspecified business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>System sketch</h2><div class="sub">clarifying…</div>'; });
  const sketch = [
    `<h2>System sketch: ${esc(idea)}</h2>`,
    `<p><strong>Clarified goal:</strong> Own the heavy lifting so the client gets a running system for "${esc(idea)}" with less work.</p>`,
    `<h3>What we capture</h3><ul>`,
    `<li>Raw idea → structured requirements (inputs, outputs, success)</li>`,
    `<li>Constraints and existing tools to reuse first</li>`,
    `</ul>`,
    `<h3>Systems to design, build, connect, test, monitor</h3><ul>`,
    `<li>Design: workflow map and data flow</li>`,
    `<li>Build: core automation or service</li>`,
    `<li>Connect: existing tools from the catalog before new ones</li>`,
    `<li>Test: suite checks that prove the handoff</li>`,
    `<li>Monitor: status line and incident log the client sees</li>`,
    `</ul>`,
    `<h3>Handoff</h3><ul>`,
    `<li>One-line status + last green check</li>`,
    `<li>Docs: client owns outcomes, we own the system</li>`,
    `<li>Running automations with the confirm line</li>`,
    `</ul>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind system sketch</div>`
  ].join('');
  el.innerHTML = sketch;
  return 'system-sketch';
}

export default {
  name: 'system-sketch',
  examples: [
    'sketch the system for: automate client invoices',
    'system design for my SaaS idea',
    'clarify idea into system: onboarding portal',
    'turn this idea into a system: weekly status report'
  ],
  nearMisses: [
    'draw a sketch',
    'system status',
    'package this idea: automate invoices',
    'what is a system'
  ],
  match: (lower, text) => isSystemSketch(text),
  run
};
