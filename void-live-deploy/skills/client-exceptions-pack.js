/**
 * client-exceptions-pack skill — package a client-facing card that lists the few exceptions or decisions
 * the client still makes against the systems Verse owns completely, so the client does less and
 * "Verse owns the hard work" is clear for selling and delivery.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "exceptions pack for my idea: automate invoice reminders",
 * "what does the client still decide for this business system",
 * "package the client exceptions for onboarding"
 */
export function isClientExceptionsPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:client\s+)?exceptions?\s+pack\b/i.test(t)
    || /^(?:what|which)\s+(?:does|will)\s+the\s+client\s+still\s+(?:decide|handle|do)\b/i.test(t)
    || /^(?:package|make|generate)\s+(?:a\s+)?(?:client\s+)?exceptions?\s+pack\b/i.test(t);
}

function extractIdea(text) {
  const t = String(text || '');
  const m = t.match(/(?:idea|system|for|:\s*)[:\-]?\s*(.+)/i) || t.match(/\b(?:for|of)\s+(.+)/i);
  return m ? m[1].trim().replace(/^(my|the|a)\s+/i, '') : 'the business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Client exceptions pack</h2><div class="sub">building…</div>'; });
  const html = [
    `<h2>Client exceptions pack: ${esc(idea)}</h2>`,
    `<p><strong>Clarified idea:</strong> For "${esc(idea)}", Verse owns the systems so the client only handles real exceptions.</p>`,
    `<h3>What Verse owns completely</h3><ul>`,
    `<li>Capture, design, build, connect, test and monitor the systems</li>`,
    `<li>Running automations and status handoffs</li>`,
    `<li>Incident notes and next-check dates</li>`,
    `</ul>`,
    `<h3>Exceptions the client still handles</h3><ul>`,
    `<li>Confirm-line yes for any send, spend or irreversible action</li>`,
    `<li>Outcome review when a monitor flags a real exception</li>`,
    `<li>Business decision only Verse cannot make (e.g. pricing change, new market)</li>`,
    `</ul>`,
    `<h3>Client work that drops</h3><ul>`,
    `<li>No daily status chasing — the exceptions pack is the one place to look</li>`,
    `<li>No integration or monitoring duty — Verse watches and reports</li>`,
    `<li>Only acts on the short list above</li>`,
    `</ul>`,
    `<p>This pack is ready for the handoff. Ask "delivery pack" or "full lift plan" to expand.</p>`
  ].join('');
  el.innerHTML = html;
  return { kind: 'page', html };
}

export const skill = {
  name: 'client-exceptions-pack',
  examples: [
    'exceptions pack for my idea: automate invoice reminders',
    'what does the client still decide for this business system',
    'package the client exceptions for onboarding'
  ],
  nearMisses: [
    'full lift plan',
    'delivery pack',
    'status of the system'
  ],
  match: isClientExceptionsPack,
  run
};
