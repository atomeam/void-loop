/**
 * own-process skill — given a business process, propose the concrete running automations,
 * monitors, tests and handoff points Verse owns so the client does less and delivery is reliable.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "own the process: client onboarding", "automate and own this: invoice reminders", "we own the run for support tickets"
 */
export function isOwnProcess(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:own|automate and own|we own the run for|take over)\s+(?:the\s+)?(?:process|run|this)\b/i.test(t)
    || /^(?:own|own the)\s+(?:process|run)\s*[:-]/i.test(t);
}

function extractProcess(text) {
  const t = String(text || '');
  const m = t.match(/(?:process|run|this)\s*[:-]\s*(.+)/i) || t.match(/\bfor\s+(?:the\s+|my\s+)?(.+)/i) || t.match(/[:-]\s*(.+)/);
  return m ? m[1].trim() : 'unspecified business process';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const process = extractProcess(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Own the process</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>Own the process: ${esc(process)}</h2>`,
    `<p><strong>Process:</strong> ${esc(process)}</p>`,
    `<p>Verse owns the heavy lifting. Client keeps the outcome and the final yes.</p>`,
    `<h3>Running automations Verse owns</h3><ul>`,
    `<li>Intake automation: capture the trigger (form, email, webhook) and route it</li>`,
    `<li>Core workflow: the steps that run without the client watching</li>`,
    `<li>Connect existing tools first (see domains/void.existing-tools.md)</li>`,
    `<li>Approval gate: confirm-line yes before any send, book or spend</li>`,
    `</ul>`,
    `<h3>Monitors and tests</h3><ul>`,
    `<li>Status line the client can open anytime</li>`,
    `<li>Suite checks that prove the handoff works</li>`,
    `<li>Incident log that opens and closes itself</li>`,
    `</ul>`,
    `<h3>Handoff</h3><ul>`,
    `<li>One-line status + last green check</li>`,
    `<li>Docs: what we own vs what the client owns</li>`,
    `<li>Running automations list with the confirm-line already wired</li>`,
    `</ul>`,
    `<p class="sub">We own the run. Delivery stays reliable.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice</div>`
  ].join('');
  el.innerHTML = pack;
  return 'own-process';
}

export default {
  name: 'own-process',
  examples: [
    'own the process: client onboarding',
    'automate and own this: invoice reminders',
    'we own the run for support tickets',
    'take over the process: lead qualification'
  ],
  nearMisses: ['own the room', 'process this', 'own a share'],
  match(lower, text) { return isOwnProcess(text || lower); },
  run,
  suite() {
    const ok = isOwnProcess('own the process: client onboarding')
      && isOwnProcess('automate and own this: invoice reminders')
      && isOwnProcess('we own the run for support tickets')
      && isOwnProcess('take over the process: lead qualification')
      && !isOwnProcess('own the room')
      && !isOwnProcess('process this');
    return { ok, got: 'match works' };
  }
};
