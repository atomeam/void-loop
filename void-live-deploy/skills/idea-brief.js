/**
 * idea-brief skill — capture and clarify a business idea into a system brief for delivery.
 * Turns a rough idea into a structured handoff card: summary, problem, users, systems, next steps.
 * Reduces client work by packaging the heavy lifting of clarification and design outline.
 * "clarify this business idea: ...", "turn this idea into a system brief", "package this for the client".
 */
const WHEN = /^(?:please\s+)?(?:clarify\s+(?:this\s+)?(?:business\s+)?idea|turn\s+(?:this\s+)?idea\s+into\s+(?:a\s+)?system\s+brief|package\s+(?:this\s+)?for\s+(?:the\s+)?client)(?:\s*[:\-]\s*(.+))?$/i;

function extractIdea(text) {
  const m = String(text || '').match(WHEN);
  if (m && m[1]) return m[1].trim();
  const cleaned = String(text || '').replace(WHEN, '').trim();
  return cleaned || 'Describe the idea in a few sentences.';
}

function structureBrief(idea) {
  const short = idea.length > 180 ? idea.slice(0, 177) + '…' : idea;
  return {
    summary: short,
    problem: 'What problem does this solve for the customer?',
    users: 'Who uses it day to day?',
    systems: 'Key systems to design, build, connect, test, and monitor (store, inventory, orders, notifications, etc.).',
    next: 'Next delivery step: clarify requirements, sketch the flow, or hand off a running automation.',
    handoff: 'Status, docs, and running pieces ready for the client. We own the heavy lifting.'
  };
}

function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const b = structureBrief(idea);
  showPage((el) => {
    el.innerHTML = `
      <h2>Idea brief</h2>
      <div class="sub">Captured and clarified for system design and client handoff</div>
      <p><strong>Idea:</strong> ${esc(b.summary)}</p>
      <p><strong>Problem:</strong> ${esc(b.problem)}</p>
      <p><strong>Users:</strong> ${esc(b.users)}</p>
      <p><strong>Systems:</strong> ${esc(b.systems)}</p>
      <p><strong>Next:</strong> ${esc(b.next)}</p>
      <p><strong>Handoff:</strong> ${esc(b.handoff)}</p>
      <div class="src">Source: structured from your words · as of 2026-11</div>
      <p class="sub">Edit any line. Say “package this for the client” again with more detail to refine.</p>
    `;
  });
  return 'idea-brief';
}

export default {
  name: 'idea-brief',
  examples: [
    'clarify this business idea',
    'turn this idea into a system brief',
    'package this for the client'
  ],
  nearMisses: [
    'what is a business idea',
    'random idea'
  ],
  match(lower, text) { return WHEN.test(String(text || lower || '').trim()); },
  run,
  suite() {
    const ok = WHEN.test('clarify this business idea') && WHEN.test('package this for the client') && !WHEN.test('what is a business idea');
    return { ok, got: 'match works on examples' };
  }
};
