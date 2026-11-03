/**
 * business-idea skill — "clarify this business idea: <text>" or "turn this into a system plan: <text>"
 * Captures and clarifies a rough business idea into a structured card: the problem, the systems to design/build/connect/test/monitor,
 * a handoff checklist (status, docs, running automations), and a packaging line for "we own the heavy lifting".
 * Reduces client work; makes delivery more reliable. Uses what already exists (stage cards, no new tokens or services).
 * Kept on the stage with the card; nothing is sent or stored off-device.
 * Asked for by growth (2026-11-02): better at taking over heavy lifting for businesses.
 */
const tidy = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

const ASK1 = /^(?:please\s+)?(?:clarify|turn|make|draft)\s+(?:this\s+)?(?:business\s+)?(?:idea|request)\s*(?:into\s+(?:a\s+)?(?:system\s+plan|plan|clarification))?\s*[:\-]\s*(.+)$/i;
const ASK2 = /^(?:please\s+)?(?:business\s+idea|idea\s+to\s+system)\s*[:\-]\s*(.+)$/i;

/** what the ask wants: the idea text, or null. Pure. */
export function ideaOf(text) {
  const t = tidy(text);
  const m = ASK1.exec(t) || ASK2.exec(t);
  return m && m[1] ? m[1].trim().slice(0, 800) : null;
}

export function isBusinessIdea(text) {
  return !!ideaOf(text);
}

/** a short clarification from the raw idea (rules only, no model). Pure. */
export function clarify(idea) {
  const clean = idea.replace(/\s+/g, ' ').trim();
  const problem = clean.length > 40 ? clean.slice(0, 120) + (clean.length > 120 ? '…' : '') : clean;
  const systems = [
    'Intake form or card that captures the ask once',
    'Core system that does the heavy work (automation, data, or workflow)',
    'Monitor that shows status without the client asking',
    'Handoff package: docs, running automations, and a clear owner line'
  ];
  return { problem, systems, handoff: ['Status card the client can open anytime', 'One-page docs of what runs and why', 'Running automations they do not have to watch', 'Clear line: we own the heavy lifting; they approve the outcome'] };
}

function run(text, api) {
  const { showPage, esc } = api;
  const idea = ideaOf(text);
  if (!idea) return 'none';
  const c = clarify(idea);
  showPage((p) => {
    p.innerHTML = '<h2>Business idea, clarified</h2>'
      + '<p><strong>Idea:</strong> ' + esc(idea) + '</p>'
      + '<p><strong>Problem it solves:</strong> ' + esc(c.problem) + '</p>'
      + '<div><strong>Systems to design, build, connect, test, monitor:</strong><ul>'
      + c.systems.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul></div>'
      + '<div><strong>Handoff (status, docs, running automations):</strong><ul>'
      + c.handoff.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ul></div>'
      + '<p class="sub">We own the heavy lifting. The client keeps the outcome and the approve line.</p>'
      + '<div class="src">Rule-based clarification. Say “clarify this business idea: …” for another.</div>';
  });
  return 'business-idea';
}

export default {
  name: 'business-idea',
  examples: ['clarify this business idea: a shop that needs daily inventory checks without the owner walking the floor', 'turn this into a system plan: clients keep asking for status on their orders'],
  nearMisses: ['what is a business idea', 'clarify the weather', 'business news', 'idea certificate'],
  match(lower, text) { return isBusinessIdea(text); },
  run,
  suite() {
    const ok = isBusinessIdea('clarify this business idea: test') && !isBusinessIdea('what is a business idea') && clarify('short').systems.length === 4;
    return { ok, got: 'match and clarify work' };
  }
};
