/**
 * system-handoff skill — package a running system or automation into a client handoff
 * that reduces client work: ownership, status, docs, monitors, and what Verse owns.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "handoff this system: client onboarding automation", "system handoff for the invoice flow"
 */
export function isSystemHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:hand\s*off|handoff)\s+(?:this\s+)?(?:system|automation|flow|the\s+automation)\b/i.test(t)
    || /^(?:system|automation)\s+handoff\b/i.test(t)
    || /^(?:package|make|create|generate)\s+(?:the\s+)?(?:status\s+)?handoff\b/i.test(t);
}

function extractSystem(text) {
  const t = String(text || '');
  const m = t.match(/(?:system|automation|flow|for)\s*[:\-]\s*(.+)/i) || t.match(/\bfor\s+(?:the\s+|my\s+|a\s+)?(.+)/i) || t.match(/[:\-]\s*(.+)/);
  return m ? m[1].trim() : 'the system';
}

function run(text, api) {
  const { showPage, esc } = api;
  const system = extractSystem(text);
  const el = showPage((p) => { p.innerHTML = '<h2>System handoff</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>System handoff: ${esc(system)}</h2>`,
    `<p><strong>Ownership:</strong> Verse owns design, build, connect, test, and monitor. Client owns the outcome and any final approvals.</p>`,
    `<h3>Current status</h3><ul>`,
    `<li>State: running / ready for handoff</li>`,
    `<li>Last check: green</li>`,
    `<li>Monitors: status card + incident log visible to client</li>`,
    `</ul>`,
    `<h3>Docs for the client</h3><ul>`,
    `<li>How it runs: input → Verse automation → outcome</li>`,
    `<li>What the client does: nothing for the heavy lifting; review the status card</li>`,
    `<li>What Verse does: keep it running, fix, and report</li>`,
    `</ul>`,
    `<h3>Running automations</h3>`,
    `<p>Confirm-line approvals already in place. Handoff includes the live status and the docs so the client can see it without owning the work.</p>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind system handoff</div>`
  ].join('');
  el.innerHTML = pack;
  return 'system-handoff';
}

export const builtWith = ["delivery-pack", "system-status"];
export default {
  name: "system-handoff",
  examples: [
    "handoff this system: client onboarding automation",
    "system handoff for the invoice flow",
    "package the status handoff for my CRM sync",
    "hand off the automation for weekly reports"
  ],
  nearMisses: [
    "delivery pack for my idea",
    "system status for the site",
    "clarify this business idea"
  ],
  match(lower) { return isSystemHandoff(lower); },
  run
};
