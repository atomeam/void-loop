/**
 * client-monitor skill: turn a system name into a client-visible monitoring package Verse owns.
 * "client monitor for the invoice automation", "what will you monitor for the onboarding flow",
 * "monitor this for the client: support router".
 * The card lists the monitors Verse will watch (status, connected tools, schedule, docs) so the client does less checking.
 * Nothing is sent; empty surface stays empty until asked. Uses existing status patterns.
 */
export function isClientMonitor(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:client\s+monitor|monitor\s+(?:this|that|it)\s+for\s+(?:the\s+)?client|what\s+(?:will|do)\s+you\s+monitor\s+for)\b/i.test(t)
    || /^(?:make|generate|create)\s+(?:a\s+)?client\s+monitor\b/i.test(t);
}

export function systemOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim() : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

function suggestMonitors(name) {
  const t = name.toLowerCase();
  const m = ['The address or endpoint answers (system status)'];
  if (/email|inbox|message/.test(t)) m.push('Incoming messages parsed into tasks');
  if (/report|status|update/.test(t)) m.push('Status reports generated on schedule');
  if (/onboard|client|customer/.test(t)) m.push('Onboarding steps completed without manual chase');
  if (/invoice|payment|billing/.test(t)) m.push('Follow-ups and payments recorded');
  m.push('Connected tools respond');
  m.push('Automations fire on their schedule');
  m.push('Status line and docs stay current');
  return m;
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = systemOf(text);
  const monitors = suggestMonitors(name);
  showPage((el) => {
    el.innerHTML = '<h2>Client monitor: ' + esc(name) + '</h2>'
      + '<p>Verse owns the monitoring. The client keeps the outcome and asks for status when needed.</p>'
      + '<h3>What Verse watches</h3><ul>'
      + monitors.map((x) => '<li>' + esc(x) + '</li>').join('')
      + '</ul>'
      + '<p class="sub">Ask "system status for ' + esc(name) + '" for a live check. Nothing invented.</p>'
      + '<div class="src">Source: A-to-Mind delivery practice · nothing sent</div>';
  });
  return 'client-monitor';
}

export default {
  name: 'client-monitor',
  examples: [
    'client monitor for the invoice automation',
    'what will you monitor for the onboarding flow',
    'monitor this for the client: support ticket router',
    'make a client monitor for weekly status reports'
  ],
  nearMisses: [
    'what is a monitor',
    'system status for billing',
    'client handoff for the flow',
    'monitor the weather'
  ],
  match(lower, text) { return isClientMonitor(text || lower); },
  run,
  suite() {
    const ok = isClientMonitor('client monitor for the invoice automation')
      && isClientMonitor('what will you monitor for the onboarding flow')
      && isClientMonitor('monitor this for the client: support ticket router')
      && isClientMonitor('make a client monitor for weekly status reports')
      && !isClientMonitor('what is a monitor')
      && !isClientMonitor('system status for billing');
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
