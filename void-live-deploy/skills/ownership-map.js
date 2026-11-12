/**
 * ownership-map skill — map a business process into clear ownership: what Verse owns (systems, automations, monitoring)
 * versus what the client owns (outcomes, approvals, final decisions), so handoff is unambiguous and client work is reduced.
 * Rules-based, offline. Card stays on the stage.
 * "ownership map for client onboarding", "what does Verse own vs the client for invoice reminders", "map ownership for support tickets"
 */
export function isOwnershipMap(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:ownership|own)\s+map\b/i.test(t)
    || /^(?:map|show|list)\s+(?:the\s+)?ownership\b/i.test(t)
    || /^what\s+(?:does|will)\s+verse\s+own\s+vs(?:\s+the)?\s+client\b/i.test(t)
    || /^who\s+owns\s+what\s+for\b/i.test(t);
}

function extractProcess(text) {
  const t = String(text || '');
  let m = t.match(/(?:ownership\s+map|map\s+ownership|who\s+owns\s+what)\s*(?:for|:)?\s*(.+)/i)
       || t.match(/vs\s+(?:the\s+)?client\s+for\s+(.+)/i)
       || t.match(/\bfor\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  let proc = m ? m[1].trim() : 'the described process';
  return proc.replace(/^for\s+/i, '').trim() || 'the described process';
}

function suggestOwnership(process) {
  const t = process.toLowerCase();
  const verse = [];
  const client = [];
  if (/email|inbox|message|customer|support/.test(t)) {
    verse.push('email intake, triage and routing automation');
    verse.push('monitoring of queue depth and response SLAs');
    client.push('final reply approval on the confirm line');
  }
  if (/invoice|bill|payment|remind/.test(t)) {
    verse.push('invoice generation, reminder scheduling and payment status tracking');
    verse.push('alert on overdue or failed payments');
    client.push('payment method and amount confirmation');
  }
  if (/onboard|signup|client|welcome/.test(t)) {
    verse.push('onboarding sequence, checklist advancement and setup automation');
    verse.push('status monitoring of new client progress');
    client.push('account details and go-live approval');
  }
  if (/report|status|update|weekly|dashboard/.test(t)) {
    verse.push('automated report generation and status card updates');
    verse.push('monitor data freshness and delivery');
    client.push('review and any manual adjustments');
  }
  if (verse.length === 0) {
    verse.push('core system design, build, connection, testing and ongoing monitoring');
    verse.push('running automations that reduce manual steps');
  }
  if (client.length === 0) {
    client.push('business outcomes, key decisions and final approvals');
  }
  return { verse, client };
}

function run(text, api) {
  const { showPage, esc } = api;
  const process = extractProcess(text);
  const own = suggestOwnership(process);
  const el = showPage((p) => { p.innerHTML = '<h2>Ownership map</h2><div class="sub">building…</div>'; });
  const html = [
    `<h2>Ownership map: ${esc(process)}</h2>`,
    `<p class="sub">A clear split of what Verse owns and what the client owns.</p>`,
    `<h3>What Verse owns</h3><ul>`,
    ...own.verse.map(v => `<li>${esc(v)}</li>`),
    `</ul>`,
    `<h3>What the client owns</h3><ul>`,
    ...own.client.map(c => `<li>${esc(c)}</li>`),
    `</ul>`,
    `<h3>Handoff</h3><ul>`,
    `<li>Status card the client can summon anytime</li>`,
    `<li>Docs of the systems and automations Verse runs</li>`,
    `<li>Confirm-line approvals already in place for any send or spend</li>`,
    `</ul>`,
    `<p>The client keeps outcomes and approvals.</p>`,
    `<div class="src">Source: A-to-Mind ownership practice</div>`
  ].join('');
  el.innerHTML = html; // void-review: ok (every interpolated value is passed through esc)
  return 'ownership-map';
}

export default {
  name: 'ownership-map',
  examples: [
    'ownership map for client onboarding',
    'map ownership for invoice reminders',
    'what does Verse own vs the client for support tickets',
    'who owns what for weekly reports',
    'ownership map: CRM sync',
  ],
  nearMisses: [
    'heavy lift map for onboarding',
    'system handoff for billing',
    'delivery pack for my idea',
    'what is ownership',
    'clarify this business idea',
  ],
  match(lower, text) { return isOwnershipMap(text || lower); },
  run,
};
