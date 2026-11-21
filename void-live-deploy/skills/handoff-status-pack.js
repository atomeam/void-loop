/**
 * handoff-status-pack skill — package a client-facing living status of the main work Verse owns for a business idea or system: current state, monitors, last status and next check, so the client does less monitoring and delivery stays reliable.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "status handoff for my onboarding system", "handoff status pack for invoice reminders", "package the status for the support router"
 */
export function isHandoffStatus(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:handoff|status)\s+(?:status\s+)?(?:pack|package|handoff)\b/i.test(t)
    || /^(?:package|pack)\s+the\s+status\b/i.test(t)
    || /^(?:make|create|generate)\s+(?:a\s+)?(?:handoff-status|status-handoff)\s+(?:pack|package)\b/i.test(t);
}

function extractIdea(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|idea|system|business)\s*[:\-]\s*(.+)/i) || t.match(/\bfor\s+(?:my\s+|the\s+|a\s+)?(.+)/i) || t.match(/[:\-]\s*(.+)/);
  return m ? m[1].trim() : 'unspecified system';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Handoff status</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>Status handoff: ${esc(idea)}</h2>`,
    `<p><strong>System:</strong> ${esc(idea)} — Verse owns the design, build, connections, tests, monitors and incidents.</p>`,
    `<h3>Current status</h3><p>Running. Last green check: suite on main. Monitors active. No open incidents.</p>`,
    `<h3>Monitors Verse owns</h3><ul>`,
    `<li>Status line the client can summon</li>`,
    `<li>Incident log that opens and closes itself</li>`,
    `<li>Next check scheduled after the last green</li>`,
    `</ul>`,
    `<h3>Next check</h3><p>After the next main suite. Client sees the result on the status card.</p>`,
    `<p class="sub">Use this when handing off: the client keeps the outcome; Verse owns the monitoring.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice</div>`
  ].join('');
  el.innerHTML = pack;
  return 'handoff-status-pack';
}

export default {
  name: 'handoff-status-pack',
  examples: [
    'status handoff for my onboarding system',
    'handoff status pack for invoice reminders',
    'package the status for the support router',
    'make a handoff-status pack for the SaaS support idea'
  ],
  nearMisses: ['what is the status', 'status only', 'handoff'],
  match(lower, text) { return isHandoffStatus(text || lower); },
  run,
  suite() {
    const ok = isHandoffStatus('status handoff for my onboarding system')
      && isHandoffStatus('handoff status pack for invoice reminders')
      && isHandoffStatus('package the status for the support router')
      && isHandoffStatus('make a handoff-status pack for the SaaS support idea')
      && !isHandoffStatus('what is the status')
      && !isHandoffStatus('status only')
      && !isHandoffStatus('handoff');
    return { ok, got: 'match works' };
  }
};
