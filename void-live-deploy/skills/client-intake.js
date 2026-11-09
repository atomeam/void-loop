/**
 * client-intake skill — capture a vague business idea and turn it into a clarified intake that Verse owns the heavy lifting for: requirements, systems, automations, tests, monitors and handoff.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "intake this idea: …", "clarify my business idea: …", "client intake for …"
 */
export function isClientIntake(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:intake|clarify)\s+(?:this|my|the)\s+(?:idea|business|process|ask)\b/i.test(t)
    || /^(?:client\s+)?intake\s+(?:for|of|on)\b/i.test(t)
    || /^(?:capture|clarify)\s+(?:and\s+)?(?:own|package)\b/i.test(t);
}

function extractIdea(text) {
  const t = String(text || '');
  const m = t.match(/(?:idea|business|process|ask)\s*[:\-]\s*(.+)/i) || t.match(/\bfor\s+(?:my\s+|the\s+|a\s+)?(.+)/i) || t.match(/[:\-]\s*(.+)/);
  return m ? m[1].trim() : 'unspecified business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Client intake</h2><div class="sub">clarifying…</div>'; });
  const pack = [
    `<h2>Client intake: ${esc(idea)}</h2>`,
    `<p><strong>Clarified:</strong> "${esc(idea)}" becomes a system Verse owns end-to-end so the client only approves outcomes.</p>`,
    `<h3>What we capture</h3><ul>`,
    `<li>Raw ask → structured requirements (inputs, outputs, exceptions)</li>`,
    `<li>Systems to design/build/connect (reuse existing tools first)</li>`,
    `<li>Automations that run after you leave, with the confirm line</li>`,
    `<li>Tests and monitors Verse owns</li>`,
    `<li>Handoff docs and status the client sees</li>`,
    `</ul>`,
    `<h3>Ownership</h3><p>Verse owns the heavy lifting (build, connect, test, monitor, maintain). Client owns the outcome and the yes/no.</p>`,
    `<p class="sub">We own the heavy lifting. Client keeps the result.</p>`,
    `<div class="src">Source: A-to-Mind idea-to-system delivery</div>`
  ].join('');
  el.innerHTML = pack;
  return 'client-intake';
}

export default {
  name: 'client-intake',
  examples: [
    'intake this idea: automate client onboarding',
    'clarify my business idea: support ticket router',
    'client intake for invoice reminders',
    'capture and own the lead qualification process'
  ],
  nearMisses: ['what is intake', 'intake form', 'clarify the weather'],
  match(lower, text) { return isClientIntake(text || lower); },
  run,
  suite() {
    const ok = isClientIntake('intake this idea: automate onboarding')
      && isClientIntake('clarify my business idea: support ticket router')
      && isClientIntake('client intake for invoice reminders')
      && isClientIntake('capture and own the lead qualification process')
      && !isClientIntake('what is intake')
      && !isClientIntake('intake form')
      && !isClientIntake('clarify the weather');
    return { ok, got: 'match works' };
  }
};
