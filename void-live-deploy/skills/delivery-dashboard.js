/**
 * delivery-dashboard skill — client-visible single card aggregating systems owned, status,
 * monitors, progress, time-saved and next handoff for a business idea so the client sees
 * the full picture Verse owns and does less chasing across separate cards.
 * Rules-based, offline. Nothing sent. Reuses existing packs (systems-owned, status-digest,
 * progress-report, time-saved, full-handoff).
 * "delivery dashboard for the invoice automation", "show the dashboard for onboarding",
 * "client dashboard for weekly reports", "dashboard for the onboarding process".
 */
export function isDeliveryDashboard(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:delivery\s+)?dashboard\b/i.test(t)
    || /^(?:show|open|client)\s+(?:the\s+)?(?:delivery\s+)?dashboard\b/i.test(t)
    || /\bdashboard\s+(?:for|of)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function dashboardFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    owned: [
      'Capture & clarify (client-intake / idea-to-system)',
      'Core workflow design & build (system-slice)',
      'Existing tools connected first (reuse-pack)',
      'Verification tests Verse owns (verify-pack)',
      'Monitors and live status (monitor-pack / system-status)',
      'Ownership map Verse vs client (ownership-pack / systems-owned)',
      'Progress reporting and status digests (progress-report / status-digest)',
      'Full handoff package (full-handoff / delivery-pack)',
      'ROI and time-saved estimate (roi-pack / time-saved)'
    ],
    status: 'Packs exist; summon any for details. No live uptime claimed until a real check answers.',
    timeSaved: 'Hours the client no longer spends on dashboards, tests, status chasing or inventing systems',
    next: 'Summon "systems owned for ' + name + '" or "full handoff for ' + name + '" to expand any section'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const d = dashboardFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Delivery dashboard: ' + esc(d.subject) + '</h2>'
      + '<p><strong>Verse owns the heavy lifting.</strong> Client does less chasing.</p>'
      + '<h3>Systems Verse owns</h3><ul>' + d.owned.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Status</h3><p>' + esc(d.status) + '</p>'
      + '<h3>Time saved</h3><p>' + esc(d.timeSaved) + '</p>'
      + '<h3>Next</h3><p>' + esc(d.next) + '</p>'
      + '<p class="sub">Reuse existing tools and packs. Empty stage stays empty. Nothing sent.</p>'
      + '<div class="src">Source: A-to-Mind delivery-dashboard · verse does the hard work</div>';
  });
  return 'delivery-dashboard';
}

export default {
  name: 'delivery-dashboard',
  examples: [
    'delivery dashboard for the invoice automation',
    'show the dashboard for onboarding',
    'client dashboard for weekly reports'
  ],
  nearMisses: [
    'systems owned for invoice'
  ],
  match(lower) { return isDeliveryDashboard(lower); },
  run
};
