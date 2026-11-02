/**
 * business-brief skill — capture and clarify a business idea into a handoff-ready system brief.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "business brief for a coffee subscription box", "clarify this idea: AI inventory for small shops",
 * "turn my idea into a system brief".
 */
export function isBusinessBrief(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  return /^(?:(?:make|give|write|create|generate|turn(?:\s+this)?\s+into)\s+(?:a\s+)?)?(?:business\s+)?brief(?:\s+for|\s+on)?\s+.+|clarify(?:\s+this)?\s+(?:business\s+)?idea(?:\s*:\s*.+)?|system\s+brief(?:\s+for)?\s+.+$/i.test(t);
}

function extractIdea(text) {
  const t = String(text || '').trim();
  const m = t.match(/(?:brief(?:\s+for|\s+on)?|idea(?:\s*:)?|system\s+brief(?:\s+for)?)\s+(.+)/i);
  return (m && m[1] ? m[1].trim() : t.replace(/^(?:make|give|write|create|generate|turn(?:\s+this)?\s+into)\s+(?:a\s+)?(?:business\s+)?brief\s*/i, '').trim()) || 'a new business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => {
    p.innerHTML = `<h2>Business brief</h2><div class="sub">structuring “${esc(idea)}”…</div>`;
  });
  // Structured brief that reduces client work: problem, systems Verse can own, next steps, handoff notes.
  const brief = {
    idea: idea,
    problem: `The core friction this idea removes for the business and its customers.`,
    systems: [
      'Capture and clarify the idea into this brief (done).',
      'Design the minimal systems: data, automation, and monitoring points.',
      'Build and connect the heavy-lifting parts (inventory, orders, notifications, reports).',
      'Test the end-to-end flow and monitor live status.',
      'Hand off status, docs, and running automations to the client.'
    ],
    next: 'Say “build the systems for this brief” or “handoff package” to continue.',
    handoff: 'This brief is the starting document. Verse owns the build, connection, testing, and monitoring so the client focuses on the business, not the plumbing.'
  };
  if (!api._pageStill(el)) return 'none';
  el.innerHTML = `
    <h2>Business brief</h2>
    <p><strong>Idea:</strong> ${esc(brief.idea)}</p>
    <p><strong>Problem it solves:</strong> ${esc(brief.problem)}</p>
    <div class="sub"><strong>Systems Verse can take over (heavy lifting):</strong></div>
    <ul>${brief.systems.map(s => `<li>${esc(s)}</li>`).join('')}</ul>
    <p><strong>Next:</strong> ${esc(brief.next)}</p>
    <p class="sub">${esc(brief.handoff)}</p>
    <div class="src">Generated on the stage — empty surface stays empty until you ask.</div>
  `;
  return 'business-brief';
}

export default {
  name: 'business-brief',
  examples: [
    'business brief for a coffee subscription box',
    'clarify this idea: AI inventory for small shops',
    'turn my idea into a system brief',
    'system brief for automated client reporting'
  ],
  nearMisses: ['what is a brief', 'business plan template', 'legal brief'],
  match(lower, text) { return isBusinessBrief(text); },
  run,
  suite() {
    const ok = isBusinessBrief('business brief for a coffee subscription box')
      && isBusinessBrief('clarify this idea: AI inventory for small shops')
      && !isBusinessBrief('what is a brief');
    return { ok, got: ok ? 'match works for capture and clarify' : 'match failed' };
  }
};
