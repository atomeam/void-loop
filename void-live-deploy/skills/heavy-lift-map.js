/**
 * heavy-lift-map skill — turn a business process or idea into a concrete map of what Verse owns
 * so the client does less: systems to design/build/connect/test/monitor, automations that run themselves,
 * and the handoff package (status, docs, running jobs) that proves "we own the heavy lifting."
 * Rules-based, offline. Card stays on the stage for the client to keep or edit.
 * "map the heavy lifting for client onboarding", "what does Verse own for invoice reminders", "heavy lift map: support ticket router"
 */
export function isHeavyLiftMap(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:map|show|list)\s+(?:the\s+)?(?:heavy\s+)?lift(?:ing)?\s+(?:for|of|map)\b/i.test(t)
    || /^(?:heavy\s+)?lift(?:ing)?\s+map\b/i.test(t)
    || /^what\s+(?:does|will)\s+verse\s+own\s+for\b/i.test(t)
    || /^own\s+the\s+(?:heavy\s+)?lift(?:ing)?\s+for\b/i.test(t);
}

function extractProcess(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|of|map)\s*[:\-]?\s*(.+)/i) || t.match(/\bfor\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  return m ? m[1].trim() : 'the described process';
}

function suggestOwnership(process) {
  const t = process.toLowerCase();
  const systems = [];
  const autos = [];
  if (/email|inbox|message|customer|support/.test(t)) {
    systems.push('email intake and routing');
    autos.push('auto-triage and reply drafts that wait on the confirm line');
  }
  if (/invoice|bill|payment|remind/.test(t)) {
    systems.push('invoice generation and reminder pipeline');
    autos.push('scheduled reminders that stop on payment or cancel');
  }
  if (/onboard|signup|client|welcome/.test(t)) {
    systems.push('client onboarding flow');
    autos.push('welcome sequence and setup checklist that Verse advances');
  }
  if (/report|status|update|weekly|dashboard/.test(t)) {
    systems.push('status and reporting pipeline');
    autos.push('weekly status card the client can summon');
  }
  if (/ticket|issue|router|queue/.test(t)) {
    systems.push('ticket router and ownership tracker');
    autos.push('auto-assign and escalate with an approve card');
  }
  if (systems.length === 0) {
    systems.push('core flow design, data sources, running stages');
    autos.push('confirm-line automations that reduce manual steps');
  }
  return { systems, autos };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const process = extractProcess(text);
  const { systems, autos } = suggestOwnership(process);
  const el = showPage((p) => { p.innerHTML = '<h2>Heavy lifting map</h2><div class="sub">building…</div>'; });
  const html = [
    `<h2>Heavy lifting map: ${esc(process)}</h2>`,
    `<p class="sub">Verse owns the systems, the automations and the monitoring. The client keeps the outcome.</p>`,
    `<h3>Systems Verse designs, builds, connects, tests and monitors</h3><ul>`,
    ...systems.map(s => `<li>${esc(s)}</li>`),
    `</ul>`,
    `<h3>Automations that take over the heavy lifting</h3><ul>`,
    ...autos.map(a => `<li>${esc(a)}</li>`),
    `</ul>`,
    `<h3>Handoff package</h3><ul>`,
    `<li>Status: one-line current state + last green check the client can summon</li>`,
    `<li>Docs: what runs, what the client owns vs what Verse owns</li>`,
    `<li>Running jobs: the confirm-line approvals already in place; nothing sends or spends without a yes</li>`,
    `</ul>`,
    `<p><strong>We own the heavy lifting.</strong> Client work drops to the decisions that matter.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice · existing tools checked first</div>`
  ].join('');
  el.innerHTML = html;
  return 'heavy-lift-map';
}

export default {
  name: 'heavy-lift-map',
  examples: [
    'map the heavy lifting for client onboarding',
    'heavy lift map: invoice reminders that run themselves',
    'what does Verse own for the support ticket router',
    'own the heavy lifting for weekly status reports'
  ],
  nearMisses: ['what is heavy lifting', 'lift the table', 'map of the world'],
  match(lower, text) { return isHeavyLiftMap(text || lower); },
  run,
  suite() {
    const ok = isHeavyLiftMap('map the heavy lifting for client onboarding')
      && isHeavyLiftMap('heavy lift map: invoice reminders')
      && isHeavyLiftMap('what does Verse own for the support ticket router')
      && isHeavyLiftMap('own the heavy lifting for weekly status reports')
      && !isHeavyLiftMap('what is heavy lifting')
      && !isHeavyLiftMap('lift the table')
      && !isHeavyLiftMap('map of the world');
    return { ok, got: 'match works' };
  }
};
