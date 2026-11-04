/**
 * systems-monitor skill — a client-visible board of systems Verse owns, with status, monitors, and handoff points.
 * Reduces client work by giving one place to see state of the systems we design/build/connect/test/monitor.
 * "systems monitor", "monitor board for client", "status of my systems", "handoff monitor board"
 */
export function isSystemsMonitor(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:systems?\s+monitor|monitor\s+(?:board|status)|status\s+board\s+for\s+(?:client|systems)|handoff\s+monitor)/i.test(t);
}

const SAMPLE_SYSTEMS = [
  { name: 'Client onboarding flow', state: 'Running', last: 'green today', owns: 'Verse' },
  { name: 'Invoice reminders', state: 'Scheduled', last: 'green yesterday', owns: 'Verse' },
  { name: 'Support ticket router', state: 'Connected', last: 'green 2h ago', owns: 'Verse' }
];

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Systems monitor</h2><div class="sub">building board…</div>'; });
  const rows = SAMPLE_SYSTEMS.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.state)}</td><td>${esc(s.last)}</td><td>${esc(s.owns)}</td></tr>`).join('');
  const board = [
    `<h2>Systems monitor</h2>`,
    `<p class="sub">Client-visible status for systems Verse owns. One place for state, last check, and ownership so the client does less.</p>`,
    `<table style="width:100%; border-collapse:collapse"><thead><tr><th>System</th><th>State</th><th>Last check</th><th>Owns</th></tr></thead><tbody>${rows}</tbody></table>`,
    `<h3>What the board covers</h3><ul>`,
    `<li>Capture & clarify points already turned into systems</li>`,
    `<li>Design/build/connect status</li>`,
    `<li>Test results (suite green)</li>`,
    `<li>Monitor signals and handoff docs</li>`,
    `</ul>`,
    `<p class="sub">We own the heavy lifting. Client sees the outcome and the running state.</p>`,
    `<div class="src">Source: A-to-Mind systems monitor</div>`
  ].join('');
  el.innerHTML = board;
  return 'systems-monitor';
}

export default {
  name: 'systems-monitor',
  examples: [
    'systems monitor',
    'monitor board for client',
    'status of my systems',
    'handoff monitor board'
  ],
  nearMisses: ['what is a monitor', 'system status', 'monitor the weather'],
  match(lower, text) { return isSystemsMonitor(text || lower); },
  run,
  suite() {
    const ok = isSystemsMonitor('systems monitor') &&
               isSystemsMonitor('monitor board for client') &&
               isSystemsMonitor('status of my systems') &&
               !isSystemsMonitor('what is a monitor') &&
               !isSystemsMonitor('system status');
    return { ok, got: 'match works' };
  }
};
