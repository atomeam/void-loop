/**
 * connect-pack skill — given a business process, list the existing tools to reuse first
 * so Verse owns the connections and the client does less new building.
 * Checks void.existing-tools.md pattern: prefer platform tools, Verse confirm line, etc.
 * "connect pack for client onboarding", "what existing tools for invoice reminders",
 * "reuse tools for the support router"
 */
export function isConnectPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:connect|reuse|existing)\s+(?:pack|tools|map)\b/i.test(t)
    || /^what\s+(?:existing|platform)\s+tools\s+(?:for|to)\b/i.test(t)
    || /^prefer\s+existing\s+tools\s+for\b/i.test(t);
}

function extractProcess(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|of|map|to)\s*[:\-]?\s*(.+)/i) || t.match(/\bfor\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  return m ? m[1].trim() : 'the described process';
}

function suggestConnections(process) {
  const t = process.toLowerCase();
  const tools = [];
  if (/email|inbox|message|customer|support|ticket/.test(t)) {
    tools.push('Verse confirm line for any send or reply');
    tools.push('existing mail handoff (rides skill) for drafts');
  }
  if (/invoice|bill|payment|remind|schedule/.test(t)) {
    tools.push('scheduled tasks already in the platform');
    tools.push('Verse confirm line before any spend or send');
  }
  if (/onboard|signup|client|welcome|form/.test(t)) {
    tools.push('existing form and list tools on the stage');
    tools.push('notebook or notepad for the checklist');
  }
  if (/report|status|update|dashboard|monitor/.test(t)) {
    tools.push('system-status and monitor-pack cards');
    tools.push('growth ledger and incident log for history');
  }
  if (tools.length === 0) {
    tools.push('check domains/void.existing-tools.md before inventing');
    tools.push('Verse confirm line for any external action');
    tools.push('stage cards the client already knows');
  }
  return tools;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const process = extractProcess(text);
  const tools = suggestConnections(process);
  const el = showPage((p) => { p.innerHTML = '<h2>Connect pack</h2><div class="sub">building…</div>'; });
  const html = [
    `<h2>Connect pack: ${esc(process)}</h2>`,
    `<p class="sub">Use what already exists. Verse owns the connections so the client builds less.</p>`,
    `<h3>Existing tools to reuse first</h3><ul>`,
    ...tools.map(t => `<li>${esc(t)}</li>`),
    `</ul>`,
    `<h3>What Verse owns</h3><ul>`,
    `<li>The wiring between them (confirm-line approvals, status cards)</li>`,
    `<li>The tests that prove the connections stay green</li>`,
    `<li>The handoff docs that name what is reused vs newly built</li>`,
    `</ul>`,
    `<p><strong>We own the heavy lifting of integration.</strong> Client work stays on the outcome.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice · existing tools checked first</div>`
  ].join('');
  el.innerHTML = html;
  return 'connect-pack';
}

export default {
  name: 'connect-pack',
  examples: [
    'connect pack for client onboarding',
    'what existing tools for invoice reminders',
    'reuse tools for the support ticket router',
    'prefer existing tools for weekly status reports'
  ],
  nearMisses: ['connect the dots', 'pack a suitcase', 'existing inventory'],
  match(lower, text) { return isConnectPack(text || lower); },
  run,
  suite() {
    const ok = isConnectPack('connect pack for client onboarding')
      && isConnectPack('what existing tools for invoice reminders')
      && isConnectPack('reuse tools for the support ticket router')
      && isConnectPack('prefer existing tools for weekly status reports')
      && !isConnectPack('connect the dots')
      && !isConnectPack('pack a suitcase')
      && !isConnectPack('existing inventory');
    return { ok, got: 'match works' };
  }
};
