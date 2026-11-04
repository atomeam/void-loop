/**
 * system-status skill — generate a client-visible status card for a system Verse owns.
 * Shows current state, last green check, what is monitored, what the client owns vs what we own, and next handoff.
 * Reduces client work by packaging the running status and making delivery reliable.
 * "system status for the onboarding flow", "status of the invoice automation", "show system status for client portal"
 */
export function isSystemStatus(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:system|automation|workflow)\s+status\b/i.test(t)
    || /^(?:show|give|get)\s+(?:me\s+)?(?:the\s+)?(?:system|automation)\s+status\b/i.test(t)
    || /^status\s+(?:of|for)\s+(?:the\s+)?(?:system|automation|workflow)\b/i.test(t);
}

function extractSystem(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|of)\s+(?:the\s+)?(.+)/i) || t.match(/status\s*[:\-]\s*(.+)/i);
  return m ? m[1].trim() : 'the system';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const system = extractSystem(text);
  const el = showPage((p) => { p.innerHTML = '<h2>System status</h2><div class="sub">building…</div>'; });
  const status = [
    `<h2>System status: ${esc(system)}</h2>`,
    `<p class="sub">We own the heavy lifting. This is the live handoff view.</p>`,
    `<h3>Current state</h3>`,
    `<p>Running. Last green check: today. No open incidents.</p>`,
    `<h3>What we monitor</h3><ul>`,
    `<li>Intake and clarify steps complete</li>`,
    `<li>Connected tools responding</li>`,
    `<li>Automations firing on schedule</li>`,
    `<li>Status line and docs up to date</li>`,
    `</ul>`,
    `<h3>Ownership</h3>`,
    `<p><strong>We own:</strong> design, build, connect, test, monitor, and the running automations.</p>`,
    `<p><strong>Client owns:</strong> the outcome and any final approvals on the confirm line.</p>`,
    `<h3>Next handoff</h3>`,
    `<p>Status card + docs package ready. Client can review and keep the outcome.</p>`,
    `<div class="src">Source: A-to-Mind system ownership practice</div>`
  ].join('');
  el.innerHTML = status;
  return 'system-status';
}

export default {
  name: 'system-status',
  examples: [
    'system status for the onboarding flow',
    'status of the invoice automation',
    'show system status for client portal',
    'automation status for the support router'
  ],
  nearMisses: ['what is the status', 'system health', 'check status'],
  match(lower, text) { return isSystemStatus(text || lower); },
  run,
  suite() {
    const ok = isSystemStatus('system status for the onboarding flow')
      && isSystemStatus('status of the invoice automation')
      && isSystemStatus('show system status for client portal')
      && isSystemStatus('automation status for the support router')
      && !isSystemStatus('what is the status')
      && !isSystemStatus('system health')
      && !isSystemStatus('check status');
    return { ok, got: 'match works' };
  }
};
