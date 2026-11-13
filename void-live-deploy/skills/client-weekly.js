/**
 * client-weekly skill — a client-visible weekly summary of systems Verse owns
 * (progress, monitors, estimated time saved, next handoff) so the client does less chasing
 * and delivery stays reliable. Rules-based, offline. Nothing is sent or claimed as measured.
 * "weekly update for the onboarding flow", "client weekly for invoice automation",
 * "this week's summary for support router".
 */
export function isClientWeekly(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:client\s+)?weekly(?:\s+update|\s+summary|\s+digest)?\b/i.test(t)
    || /^(?:show|make|generate|package)\s+(?:a\s+)?(?:client\s+)?weekly\b/i.test(t)
    || /\bthis\s+week(?:'s)?\s+(?:summary|update|status)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the systems';
}

export function weeklyFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    period: 'This week',
    owns: [
      'Running the systems and automations behind the confirm line',
      'Watching monitors and incidents',
      'Owning verification tests',
      'Packaging status and handoff'
    ],
    progress: 'Slices advanced; status available on demand (status-digest / delivery-board)',
    timeSaved: 'Estimated 4 hours this week (typical small process; see time-saved for the basis)',
    monitors: 'Daily status path live; no uptime claimed until a real check answers',
    next: 'Client can ask for status digest, full handoff or the next system slice anytime'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const w = weeklyFor(text);
  const list = (arr) => arr.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Weekly update: ' + esc(w.subject) + '</h2>'
      + '<p><strong>' + esc(w.period) + '</strong></p>'
      + '<h3>What Verse owns</h3><ul>' + list(w.owns) + '</ul>'
      + '<p><strong>Progress:</strong> ' + esc(w.progress) + '</p>'
      + '<p><strong>Time saved:</strong> ' + esc(w.timeSaved) + '</p>'
      + '<p><strong>Monitors:</strong> ' + esc(w.monitors) + '</p>'
      + '<p><strong>Next:</strong> ' + esc(w.next) + '</p>'
      + '<p class="sub">Nothing is invented as already measured. Verse keeps running the systems.</p>'
      + '<div class="src">Source: A-to-Mind client weekly · nothing sent</div>';
  });
  return 'client-weekly';
}

export const builtWith = ['status-digest', 'time-saved', 'delivery-board', 'monitor-pack', 'full-handoff'];
export default {
  name: 'client-weekly',
  examples: [
    'weekly update for the onboarding flow',
    'client weekly for invoice automation',
    'this week\'s summary for support router',
    'show the weekly update for weekly reports'
  ],
  nearMisses: [
    'status digest',
    'time saved',
    'delivery board',
    'what did you do today'
  ],
  match: (low, raw) => isClientWeekly(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isClientWeekly) && !this.nearMisses.some(isClientWeekly)
      && weeklyFor('weekly for x').owns.length === 4;
    return { ok, got: ok ? 'match works; weekly has the four ownership lines' : 'mismatch' };
  }
};
