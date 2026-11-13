/**
 * sustain-pack skill — package the ongoing care, monitors, updates and incident path Verse owns for a system
 * so the client stays hands-off after go-live and never takes the heavy lifting back.
 * Rules-based, offline. Nothing is sent or claimed as already running.
 * "sustain pack for the invoice system", "ongoing care for the support automation", "keep owning the onboarding flow".
 */
export function isSustainPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:sustain|ongoing|keep\s+owning|long[\s-]?term)\s+(?:pack|care|ownership|support)?\b/i.test(t)
    || /^(?:make|generate|show|package)\s+(?:a\s+)?(?:sustain|ongoing)\s+(?:pack|care)\b/i.test(t)
    || /\b(?:sustain|ongoing)\s+(?:pack|care)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    owns: [
      'Live monitors and status checks (systems-monitor, monitor-pack) so nothing waits on the client',
      'Incident path and blameless briefs (incident skill) with next steps Verse runs',
      'Scheduled updates, tests and verification Verse owns so the system stays reliable',
      'Weekly or digest status the client can read without chasing (status-digest, client-weekly)',
      'Time-saved and ROI numbers that keep packaging "Verse owns the hard work"'
    ],
    clientDoes: 'Approves outcomes and the confirm line; stays out of the dashboards and the ongoing work',
    next: 'Ask for the systems-monitor or status-digest card; Verse keeps the systems running'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = packFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Sustain pack: ' + esc(p.subject) + '</h2>'
      + '<p>Verse keeps owning the systems after handoff so the client does no ongoing hard work.</p>'
      + '<h3>What Verse continues to own</h3><ul>' + p.owns.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>What the client keeps</h3><p>' + esc(p.clientDoes) + '</p>'
      + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
      + '<p class="sub">Nothing is sent or claimed as already live. The pack stays on the stage for sharing.</p>'
      + '<div class="src">Source: A-to-Mind sustain-pack · Verse keeps the hard work</div>';
  });
  return 'sustain-pack';
}

export const builtWith = ['monitor-pack', 'incident', 'status-digest', 'client-weekly', 'systems-monitor'];

export default {
  name: 'sustain-pack',
  examples: [
    'sustain pack for the invoice system',
    'ongoing care for the support automation',
    'keep owning the onboarding flow'
  ],
  nearMisses: [
    'kickoff pack',
    'full handoff',
    'delivery pack'
  ],
  match(lower) { return isSustainPack(lower); },
  run
};
