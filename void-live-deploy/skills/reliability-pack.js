/**
 * reliability-pack skill — package the reliability and SLA Verse will own for a system so the client does not set or chase uptime targets.
 * Lists monitors, alerts, status, verification and incident handoff Verse owns. Rules-based, offline. Nothing is sent.
 * "reliability pack for the invoice automation", "SLA Verse owns for onboarding", "uptime ownership for the support router".
 */
export function isReliabilityPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:reliability|sla|uptime)\s+(?:pack|package|ownership)?\b/i.test(t)
    || /^(?:make|generate|show|package)\s+(?:a\s+)?(?:reliability|sla)\s+pack\b/i.test(t)
    || /\b(?:reliability|sla)\s+(?:pack|for|of|owns)\b/i.test(t);
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
      'Uptime monitors and alerts Verse watches',
      'Status digest and delivery board the client can summon',
      'Verification tests Verse runs so the system stays proven',
      'Incident handoff: Verse names what broke, what is fixed, and the next step'
    ],
    clientDoes: 'Approves the reliability target; keeps the yes on the confirm line for any spend or send',
    next: 'Ask for the monitor-pack or status-digest next; Verse owns the reliability so the client does not chase uptime'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = packFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Reliability pack: ' + esc(p.subject) + '</h2>'
      + '<p>Verse owns the reliability and SLA so the client does not set or chase uptime targets.</p>'
      + '<h3>What Verse owns</h3><ul>' + p.owns.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>What the client keeps</h3><p>' + esc(p.clientDoes) + '</p>'
      + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
      + '<p class="sub">Nothing is sent or claimed as already measured. The pack stays on the stage for sharing.</p>'
      + '<div class="src">Source: A-to-Mind reliability-pack · we own the heavy lifting</div>';
  });
  return 'reliability-pack';
}

export const builtWith = ['monitor-pack', 'status-digest', 'verify-pack', 'full-handoff'];
export default {
  name: 'reliability-pack',
  examples: [
    'reliability pack for the invoice automation',
    'SLA Verse owns for onboarding',
    'uptime ownership for the support router',
    'reliability package for weekly reports'
  ],
  nearMisses: [
    'what is reliability',
    'status digest',
    'monitor pack',
    'time saved'
  ],
  match: (low, raw) => isReliabilityPack(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isReliabilityPack) && !this.nearMisses.some(isReliabilityPack)
      && packFor('reliability pack for x').owns.length === 4;
    return { ok, got: ok ? 'match works; four ownership lines' : 'mismatch' };
  }
};
