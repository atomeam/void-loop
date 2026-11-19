/**
 * monitor-receipt skill — package a client-facing receipt of the monitors and automations
 * Verse owns for a business idea. Lists what is watched, a status style (last known / next check),
 * incident handoff notes, and the next step so the client does less monitoring work.
 * Rules-based, offline. Nothing sent. Reuses existing status and monitor packs.
 * "monitor receipt for the onboarding automation", "client monitor for invoice flow",
 * "receipt of monitors for weekly reports", "automation monitor receipt: ...".
 */
export function isMonitorReceipt(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /(?:monitor|automation)\s+receipt\b/i.test(t)
    || /^(?:client\s+)?monitor\s+(?:receipt|handoff)\b/i.test(t)
    || /\breceipt\s+of\s+(?:monitors|automations)\b/i.test(t)
    || /^(?:show|give)\s+(?:me\s+)?(?:the\s+)?(?:monitor|automation)\s+receipt\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function receiptFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    monitors: [
      'Uptime and response of the core flow (status line the client can open)',
      'Automation runs: last success, next scheduled, failure count',
      'Incident log: open items close themselves when fixed',
      'Confirm-line approvals already in place for any send or spend'
    ],
    statusStyle: 'Last known from /api/status or the guard board; never invents "up" when the answer is missing. Client sees the same receipt without chasing logs.',
    incidentHandoff: 'Open incidents list what broke, how long, and who owns the fix (Verse). Client is notified only on the handoff card.',
    next: 'Summon "systems monitor" or "delivery dashboard for ' + name + '" for the live board. Verse owns the checks.'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const r = receiptFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Monitor receipt: ' + esc(r.subject) + '</h2>'
      + '<p><strong>Verse owns the monitoring.</strong> The client sees the receipt and does less checking.</p>'
      + '<h3>What is watched</h3><ul>' + r.monitors.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Status style</h3><p>' + esc(r.statusStyle) + '</p>'
      + '<h3>Incident handoff</h3><p>' + esc(r.incidentHandoff) + '</p>'
      + '<h3>Next</h3><p>' + esc(r.next) + '</p>'
      + '<p class="sub">Reuse existing tools and packs. Empty stage stays empty. Nothing sent.</p>'
      + '<div class="src">Source: A-to-Mind monitor-receipt · verse owns the hard work</div>';
  });
  return 'monitor-receipt';
}

export default {
  name: 'monitor-receipt',
  examples: [
    'monitor receipt for the onboarding automation',
    'client monitor receipt for invoice flow',
    'receipt of monitors for weekly reports',
    'automation monitor receipt: client support router'
  ],
  nearMisses: [
    'what is a receipt',
    'monitor the weather',
    'system status',
    'delivery pack for onboarding'
  ],
  match: (lower, text) => isMonitorReceipt(text),
  run
};
