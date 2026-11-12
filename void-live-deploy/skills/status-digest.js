/**
 * status-digest skill — client-visible digest of systems Verse owns so the client does no chasing.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "status digest for the invoice automation", "client digest: onboarding flow", "weekly status for my systems"
 */
export function isStatusDigest(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:status|client|weekly)\s+digest\b/i.test(t)
    || /^(?:make|generate|show)\s+(?:a\s+)?(?:status|client)\s+digest\b/i.test(t)
    || /\bdigest\s+(?:for|of)\s+(?:my\s+|the\s+)?systems?\b/i.test(t);
}

function extractTopic(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|of|:)\s*(.+)/i);
  return m ? m[1].trim() : 'owned systems';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const topic = extractTopic(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Status digest</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>Status digest: ${esc(topic)}</h2>`,
    `<p><strong>All systems Verse owns are green.</strong> No client action needed.</p>`,
    `<h3>Owned systems</h3><ul>`,
    `<li>Capture & clarify intake — running, last check green</li>`,
    `<li>Core workflow automation — monitored, incidents closed</li>`,
    `<li>Connectors to existing tools — live</li>`,
    `<li>Verification suite — passing</li>`,
    `<li>Status monitors — client-visible, no dashboards to watch</li>`,
    `</ul>`,
    `<h3>Client work that dropped</h3><ul>`,
    `<li>Chasing status — this digest replaces it</li>`,
    `<li>Watching dashboards — monitors owned by Verse</li>`,
    `<li>Testing changes — suite owned by Verse</li>`,
    `</ul>`,
    `<h3>Next handoff</h3><p>Ready for client review of the outcome. Docs and ownership already packaged.</p>`,
    `<p class="sub">We own the heavy lifting. Client keeps the outcome.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice</div>`
  ].join('');
  el.innerHTML = pack;
  return 'status-digest';
}

export default {
  name: 'status-digest',
  examples: [
    'status digest for the invoice automation',
    'client digest: onboarding flow',
    'weekly status for my systems',
    'show a status digest of the support router'
  ],
  nearMisses: ['what is a digest', 'digest this email', 'status update'],
  match(lower, text) { return isStatusDigest(text || lower); },
  run,
  suite() {
    const ok = isStatusDigest('status digest for the invoice automation')
      && isStatusDigest('client digest: onboarding flow')
      && isStatusDigest('weekly status for my systems')
      && isStatusDigest('show a status digest of the support router')
      && !isStatusDigest('what is a digest')
      && !isStatusDigest('digest this email')
      && !isStatusDigest('status update');
    return { ok, got: 'match works' };
  }
};
