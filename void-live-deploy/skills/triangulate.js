/**
 * triangulate skill - "triangulate: should I open source the void-loop"
 * Forces three distinct perspectives to simultaneously evaluate a single issue to find synthesis.
 * Built for the Deciding family.
 */
export function parseTriangulate(text) {
  const t = String(text || '').trim();
  const m = /^(?:triangulate|council|three perspectives on)\s*[:\-]?\s*(.+)$/i.exec(t);
  if (!m) return null;
  const topic = m[1].trim().slice(0, 150);
  return topic ? { topic } : null;
}

export function triangulateHtml(esc, topic) {
  return `
    <div style="display: flex; flex-direction: column; gap: 16px; padding: 8px;">
      <div style="text-align: center;">
        <h2 style="margin: 0 0 8px 0; color: var(--text-main);">Triangulating: ${esc(topic)}</h2>
        <div style="font-size: 13px; color: var(--muted); font-style: italic; opacity: 0.8;">
          "when 3 people can simultaneously look each other in the eyes... only then will we know world peace."
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-areas: 'top top' 'left right'; gap: 12px; margin-top: 8px;">
        <!-- Perspective 1: The Pragmatist -->
        <div style="grid-area: top; border: 1px solid var(--line); border-radius: 8px; padding: 12px; text-align: center; max-width: 80%; margin: 0 auto; width: 100%;">
          <strong style="color: #64B5F6;">The Pragmatist</strong>
          <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">Evaluating efficiency, speed, and immediate utility.</div>
          <textarea placeholder="Pragmatic view..." style="width: 100%; margin-top: 8px; background: transparent; border: none; color: var(--text-main); font-family: inherit; resize: none; text-align: center;" rows="2"></textarea>
        </div>

        <!-- Perspective 2: The Visionary -->
        <div style="grid-area: left; border: 1px solid var(--line); border-radius: 8px; padding: 12px; text-align: center;">
          <strong style="color: #BA68C8;">The Visionary</strong>
          <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">Evaluating future expansion and the grand design.</div>
          <textarea placeholder="Visionary view..." style="width: 100%; margin-top: 8px; background: transparent; border: none; color: var(--text-main); font-family: inherit; resize: none; text-align: center;" rows="2"></textarea>
        </div>

        <!-- Perspective 3: The Guardian -->
        <div style="grid-area: right; border: 1px solid var(--line); border-radius: 8px; padding: 12px; text-align: center;">
          <strong style="color: #E57373;">The Guardian</strong>
          <div style="font-size: 13px; color: var(--muted); margin-top: 4px;">Evaluating risks, sovereign constraints, and stability.</div>
          <textarea placeholder="Guardian view..." style="width: 100%; margin-top: 8px; background: transparent; border: none; color: var(--text-main); font-family: inherit; resize: none; text-align: center;" rows="2"></textarea>
        </div>
      </div>

      <!-- The Mutual Center (World Peace) -->
      <div style="margin-top: 12px; padding: 16px; border: 1px solid #FFD54F; border-radius: 8px; background: rgba(255, 213, 79, 0.05); text-align: center; box-shadow: 0 0 20px rgba(255, 213, 79, 0.1);">
        <strong style="color: #FFD54F; letter-spacing: 1px; text-transform: uppercase; font-size: 12px;">Synthesis</strong>
        <div style="font-size: 14px; color: var(--text-main); margin-top: 8px;">
          <textarea placeholder="The mutual agreement where all three lenses align..." style="width: 100%; background: transparent; border: none; color: var(--text-main); font-family: inherit; resize: none; text-align: center;" rows="3"></textarea>
        </div>
      </div>
    </div>
  `;
}

async function run(text, api) {
  const parsed = parseTriangulate(text);
  const { showPage, esc } = api;

  const el = showPage((p) => {
    p.innerHTML = `<div style="text-align: center; color: var(--muted);">Gathering the council for: ${esc(parsed?.topic || 'a decision')}...</div>`;
  });

  // Render the triangular matrix to the stage
  el.innerHTML = triangulateHtml(esc, parsed.topic);

  return 'triangulate';
}

export function suite() {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const p = parseTriangulate('triangulate: should I rewrite the router');
  const html = triangulateHtml(esc, 'rewrite the router');
  const ok = !!p && p.topic === 'should I rewrite the router' && html.includes('The Pragmatist') && html.includes('Synthesis');
  return { ok, got: ok ? '' : JSON.stringify(p) };
}

export default {
  name: 'triangulate',
  about: 'Forces three opposing perspectives to simultaneously look at a single decision to find consensus.',
  examples: ['triangulate: should I open source Verse', 'three perspectives on moving to Berlin'],
  nearMisses: ['log a decision', 'decision matrix for pasta vs pizza', 'flip a coin'],
  match(lower, text) { return !!parseTriangulate(text || lower); },
  run,
  parseTriangulate,
  triangulateHtml,
  suite,
};
