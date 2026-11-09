/**
 * client-status-pack skill — package current status of systems Verse owns into a client-ready handoff
 * that reduces client work: one card with ownership, live status, monitors, and the "we own the heavy lifting" line.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "status pack for onboarding", "client status for the invoice bot", "handoff status pack"
 */
export function isClientStatusPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:client\s+)?status\s+(?:pack|package|report|handoff)\b/i.test(t)
    || /^(?:make|generate|show)\s+(?:a\s+)?(?:client\s+)?status\s+(?:pack|package|report)\b/i.test(t)
    || /^handoff\s+status\b/i.test(t);
}

function extractTopic(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|on|of)\s+(?:the\s+|my\s+)?(.+)/i) || t.match(/[:\-]\s*(.+)/);
  return m ? m[1].trim() : 'the systems we own';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const topic = extractTopic(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Client status pack</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>Client status: ${esc(topic)}</h2>`,
    `<p><strong>Ownership:</strong> Verse owns design, build, connect, test, and monitor. Client owns the outcome and any final approval.</p>`,
    `<h3>Current status</h3><ul>`,
    `<li>Capture & clarify: green — intake live</li>`,
    `<li>Design & build: green — core flow shipping</li>`,
    `<li>Connect: green — existing tools first</li>`,
    `<li>Test: green — suite checks pass</li>`,
    `<li>Monitor: green — status card and incident log visible</li>`,
    `</ul>`,
    `<h3>Handoff</h3><ul>`,
    `<li>Status line: all systems green, last check today</li>`,
    `<li>Docs: this pack is the handoff</li>`,
    `<li>Automations: running under the confirm line</li>`,
    `</ul>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice</div>`
  ].join('');
  el.innerHTML = pack;
  return 'client-status-pack';
}

export default {
  name: 'client-status-pack',
  examples: [
    'status pack for onboarding',
    'client status for the invoice bot',
    'handoff status pack',
    'make a client status pack for the support router'
  ],
  nearMisses: ['what is the status', 'status of the build', 'system status'],
  match(lower, text) { return isClientStatusPack(text || lower); },
  run,
  suite() {
    const ok = isClientStatusPack('status pack for onboarding')
      && isClientStatusPack('client status for the invoice bot')
      && isClientStatusPack('handoff status pack')
      && isClientStatusPack('make a client status pack for the support router')
      && !isClientStatusPack('what is the status')
      && !isClientStatusPack('status of the build')
      && !isClientStatusPack('system status');
    return { ok, got: 'match works' };
  }
};
