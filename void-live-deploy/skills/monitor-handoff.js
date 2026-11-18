/**
 * monitor-handoff skill — package monitoring and status handoff for a system Verse owns,
 * so the client gets a clear board of what is watched, current state, and the next step,
 * reducing their work on ongoing delivery.
 * Rules-based, offline. Nothing is sent or claimed as live beyond the plan.
 * "monitor handoff for invoice automation", "handoff monitoring for client onboarding",
 * "monitoring package for support process", "status handoff for weekly reports".
 */
export function isMonitorHandoff(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:monitor\s+handoff|handoff\s+monitoring|monitoring\s+(?:package|handoff)|status\s+handoff)\b/i.test(t)
    || /^(?:make|generate|create|show)\s+(?:a\s+)?(?:monitor|monitoring)\s+(?:handoff|package|board)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

function pointsFor(subject) {
  const t = subject.toLowerCase();
  const points = [];
  if (/invoice|bill|payment|remind/.test(t)) {
    points.push({ watch: 'reminder send success', now: 'scheduled', next: 'confirm first live send' });
    points.push({ watch: 'paid mark latency', now: 'watching', next: 'set alert threshold' });
  }
  if (/onboard|signup|welcome|client/.test(t)) {
    points.push({ watch: 'welcome step completion', now: 'ready', next: 'first client walk-through' });
    points.push({ watch: 'stalled after 48h', now: 'alert set', next: 'handoff the alert rule' });
  }
  if (/support|ticket|help/.test(t)) {
    points.push({ watch: 'first response time', now: 'baseline', next: 'agree SLA handoff' });
  }
  if (points.length === 0) {
    points.push({ watch: 'core flow uptime', now: 'planned', next: 'wire the status card' });
    points.push({ watch: 'error rate', now: 'to set', next: 'define the threshold with client' });
  }
  return points;
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    owned: 'Verse designs, builds, connects, tests and monitors this; the client receives the handoff pack.',
    points: pointsFor(name),
    handoff: 'Share this card; the next step is the first live confirmation or the agreed alert.'
  };
}

function run(text, api) {
  const { showPage, esc } = api;
  const pack = packFor(text);
  const rows = pack.points.map((p) =>
    '<tr><td>' + esc(p.watch) + '</td><td>' + esc(p.now) + '</td><td>' + esc(p.next) + '</td></tr>'
  ).join('');
  showPage((el) => {
    el.innerHTML = '<h2>Monitor handoff: ' + esc(pack.subject) + '</h2>'
      + '<p>' + esc(pack.owned) + '</p>'
      + '<table><thead><tr><th>Watches</th><th>Now</th><th>Next</th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<p>' + esc(pack.handoff) + '</p>'
      + '<div class="src">Source: system plan rules · nothing claimed live until confirmed · as of 2026-11</div>';
  });
  return 'monitor-handoff';
}

export default {
  name: 'monitor-handoff',
  examples: [
    'monitor handoff for invoice automation',
    'handoff monitoring for client onboarding',
    'monitoring package for support process',
    'status handoff for weekly reports'
  ],
  nearMisses: [
    'systems monitor',
    'client status',
    'automation status'
  ],
  match(lower) { return isMonitorHandoff(lower); },
  run
};
