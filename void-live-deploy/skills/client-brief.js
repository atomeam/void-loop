/**
 * client-brief skill — short client-facing brief of the systems Verse owns for a business idea
 * (clarify, status, ownership, next handoff) so the client does less asking for updates.
 * Rules-based, offline. Nothing is sent. The card stays on the stage for the client to keep or share.
 * "client brief for Acme onboarding", "brief the client on the systems Verse owns", "client brief for invoice reminders".
 */
export function isClientBrief(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t) return false;
  return /^(?:client\s+brief|brief\s+the\s+client|client\s+summary)\b/i.test(t)
    || /^(?:brief\s+for)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 2 ? s.slice(0, 160) : 'this business idea';
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  showPage((el) => {
    el.innerHTML = '<h2>Client brief: ' + esc(name) + '</h2>'
      + '<p>Verse owns the heavy lifting. This brief keeps the client from chasing status.</p>'
      + '<h3>What is clarified</h3><p>The business idea is turned into systems Verse designs, builds, connects, tests and monitors.</p>'
      + '<h3>Current ownership</h3><ul>'
      + '<li>Verse owns design, build, connect, test, monitor and handoff</li>'
      + '<li>Client owns the final yes on outcomes and any spend</li>'
      + '</ul>'
      + '<h3>Status</h3><p>Systems are live or in the next slice. Monitors and status cards are owned by Verse.</p>'
      + '<h3>Next handoff</h3><p>Ask for the progress-report or docs-pack when the next slice ships. Client does less reading raw status.</p>'
      + '<p class="sub">Nothing is sent. The brief stays with the client.</p>'
      + '<div class="src">Source: A-to-Mind client brief · we own the heavy lifting</div>';
  });
  return 'client-brief';
}

export const builtWith = ['client-intake', 'idea-to-system', 'ownership-pack', 'system-status', 'progress-report'];
export default {
  name: 'client-brief',
  examples: [
    'client brief for Acme onboarding',
    'brief the client on the systems Verse owns',
    'client brief for invoice reminders',
    'client summary for the support process',
    'brief for the weekly report automation',
  ],
  nearMisses: [
    'ownership pack for Acme',
    'system status for onboarding',
    'docs pack for Acme',
    'progress report for the idea',
    'what is the status',
  ],
  match(lower, text) { return isClientBrief(text || lower); },
  run,
};
