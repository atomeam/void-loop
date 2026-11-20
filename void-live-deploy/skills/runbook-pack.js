/**
 * runbook-pack skill — generate client-facing runbooks and SOPs for the systems Verse owns
 * so the client never has to write or maintain operational procedures, and handoff includes
 * ready-to-use docs that reduce client work and make delivery reliable.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "runbook pack for client onboarding", "SOP package: invoice reminders", "make runbooks for the support router"
 */
export function isRunbookPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:runbook|sop)\\s+(?:pack|package)\\b/i.test(t)
    || /^(?:make|generate|create)\\s+(?:a\\s+)?(?:runbook|sop)\\s+(?:pack|package|for)\\b/i.test(t)
    || /\\brunbooks?\\s+for\\b/i.test(t);
}

function extractIdea(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|pack|package)\\s*[:\\-]\\s*(.+)/i) || t.match(/\\bfor\\s+(?:my\\s+|the\\s+|a\\s+)?(.+)/i) || t.match(/[:\\-]\\s*(.+)/);
  return m ? m[1].trim() : 'the systems Verse owns';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Runbook pack</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>Runbook pack: ${esc(idea)}</h2>`,
    `<p><strong>Purpose:</strong> Verse owns the heavy lifting. These runbooks are the procedures the client does not write or keep. Each system has a short SOP: what it does, how it runs, who owns it, and what to do if it needs attention.</p>`,
    `<h3>Standard operating procedures</h3><ul>`,
    `<li><strong>Intake & clarify:</strong> Capture the raw ask, extract requirements, confirm ownership split. Client reviews once; Verse maintains.</li>`,
    `<li><strong>Design & connect:</strong> Reuse existing tools first (see void.existing-tools.md). Document the connections and the confirm-line approvals.</li>`,
    `<li><strong>Test & verify:</strong> Suite checks prove the handoff. Status line shows last green.</li>`,
    `<li><strong>Monitor & handoff:</strong> Live status, incident path, and the docs that travel with the system. Client sees the outcome; Verse owns the watch.</li>`,
    `</ul>`,
    `<h3>What the client keeps</h3>`,
    `<p>The outcome and the final yes. Verse keeps the procedures, the monitors, and the running automations.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice — we own the heavy lifting</div>`
  ].join('');
  el.innerHTML = pack;
  return 'runbook-pack';
}

export default {
  name: 'runbook-pack',
  examples: [
    'runbook pack for client onboarding',
    'SOP package: invoice reminders that run themselves',
    'make runbooks for the support ticket router',
    'generate a runbook pack for my SaaS idea'
  ],
  nearMisses: ['what is a runbook', 'book a run', 'sop means'],
  match(lower, text) { return isRunbookPack(text || lower); },
  run,
  suite() {
    const ok = isRunbookPack('runbook pack for client onboarding')
      && isRunbookPack('SOP package: invoice reminders that run themselves')
      && isRunbookPack('make runbooks for the support ticket router')
      && isRunbookPack('generate a runbook pack for my SaaS idea')
      && !isRunbookPack('what is a runbook')
      && !isRunbookPack('book a run')
      && !isRunbookPack('sop means');
    return { ok, got: 'match works' };
  }
};
