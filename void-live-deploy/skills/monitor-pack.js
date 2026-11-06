/**
 * monitor-pack skill — propose the monitors, alerts and status checks Verse will own
 * for a business process so the client does not have to watch it.
 * Reduces client work: the card lists what is watched, how the client is told, and
 * what stays off their plate. Nothing is invented as already green. Nothing is sent.
 * "monitor pack for client onboarding", "set up monitors for the invoice reminders",
 * "what will Verse watch for the support router".
 */
export function isMonitorPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:monitor|watch)\s+pack\b/i.test(t)
    || /^(?:set\s+up|propose|make|generate)\s+(?:a\s+)?(?:monitor|watch)\s+(?:pack|setup|plan)\b/i.test(t)
    || /^(?:what|which)\s+(?:will|does)\s+verse\s+watch\s+for\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim() : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the process';
}

function suggestMonitors(subject) {
  const t = subject.toLowerCase();
  const monitors = [];
  if (/email|inbox|message|customer|support/.test(t)) {
    monitors.push('incoming volume and unanswered age');
    monitors.push('confirm-line queue depth');
  }
  if (/invoice|bill|payment|remind/.test(t)) {
    monitors.push('reminders sent vs paid');
    monitors.push('overdue count that has not been acted on');
  }
  if (/onboard|signup|client|welcome/.test(t)) {
    monitors.push('onboarding steps completed vs stalled');
    monitors.push('welcome sequence delivery');
  }
  if (/report|status|update|weekly|dashboard/.test(t)) {
    monitors.push('report generated on schedule');
    monitors.push('last green check age');
  }
  if (monitors.length === 0) {
    monitors.push('the core flow still runs');
    monitors.push('any step that waited past its window');
  }
  return monitors;
}

function run(text, api) {
  const { showPage, esc } = api;
  const subject = subjectOf(text);
  const monitors = suggestMonitors(subject);
  showPage((el) => {
    const list = monitors.map((m) => '<li>' + esc(m) + '</li>').join('');
    el.innerHTML = '<h2>Monitor pack: ' + esc(subject) + '</h2>'
      + '<p><b>What Verse owns:</b> the watching, the alerts, and the status the client can summon. The client keeps the outcome.</p>'
      + '<h3>Monitors Verse will set up</h3><ul>' + list + '</ul>'
      + '<h3>How the client is told</h3><ul>'
      + '<li>A status ask: "system status for ' + esc(subject) + '"</li>'
      + '<li>An alert only when something needs a person (confirm line first)</li>'
      + '</ul>'
      + '<p class="sub">Nothing is painted green until a real check answers. Client does not watch dashboards.</p>'
      + '<div class="src">Source: A-to-Mind delivery practice · nothing sent</div>';
  });
  return 'monitor-pack';
}

export default {
  name: 'monitor-pack',
  examples: [
    'monitor pack for client onboarding',
    'set up monitors for the invoice reminders',
    'what will Verse watch for the support router',
    'propose a watch pack for weekly status reports',
  ],
  nearMisses: [
    'systems monitor',
    'system status for the onboarding flow',
    'what is a monitor',
    'monitor the weather',
  ],
  match(lower, text) { return isMonitorPack(text || lower); },
  run,
};
