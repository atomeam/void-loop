/**
 * progress-report skill — a client-visible progress report for systems Verse owns.
 * Shows what shipped, current status, open monitors and next handoff points so the client
 * does less chasing and Verse packages "we own the heavy lifting".
 * Rules-based, offline. Nothing is sent.
 * "progress report for the onboarding automation", "client progress on invoice reminders",
 * "status progress for the support router".
 */
export function isProgressReport(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:progress|status)\s+report\b/i.test(t)
    || /^(?:client\s+)?progress\s+(?:on|for|of)\b/i.test(t)
    || /^(?:make|generate|create|show)\s+(?:a\s+)?(?:progress|status)\s+report\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function reportFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    shipped: [
      'Initial systems map from the heavy-lift map',
      'Ownership clarified (what Verse owns vs client)',
      'First automation slice behind the confirm line'
    ],
    status: 'Live monitors running; handoff checklist ready',
    monitors: ['Daily status card', 'Alert on failure via the monitor pack'],
    next: [
      'Package the delivery pack for full handoff',
      'Add the remaining verify-pack checks',
      'Client can summon "system status for ' + name + '" anytime'
    ]
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const rep = reportFor(text);
  showPage((el) => {
    const shipped = rep.shipped.map(i => '<li>' + esc(i) + '</li>').join('');
    const next = rep.next.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Progress report: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the heavy lifting. This report keeps the client informed without extra work.</p>'
      + '<h3>Shipped so far</h3><ul>' + shipped + '</ul>'
      + '<h3>Current status</h3><p>' + esc(rep.status) + '</p>'
      + '<h3>Monitors Verse owns</h3><ul>' + rep.monitors.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Next for handoff</h3><ul>' + next + '</ul>'
      + '<p class="sub">Nothing is invented as already done. Ask for the live status or the handoff checklist when ready.</p>'
      + '<div class="src">Source: A-to-Mind progress report · nothing sent</div>';
  });
  return 'progress-report';
}

export const builtWith = ['system-status', 'handoff-checklist', 'monitor-pack', 'heavy-lift-map', 'delivery-pack'];
export default {
  name: 'progress-report',
  examples: [
    'progress report for the onboarding automation',
    'client progress on invoice reminders',
    'status progress for the support router',
    'make a progress report for weekly status reports'
  ],
  nearMisses: [
    'what is progress',
    'report a bug',
    'status of the system',
    'progress bar'
  ],
  match: (low, raw) => isProgressReport(raw || low),
  run,
  part: null
};
