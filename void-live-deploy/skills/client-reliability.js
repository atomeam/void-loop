/**
 * client-reliability skill — packages the monitoring and reliability ownership Verse takes for a business system.
 * Lists the monitors Verse owns, the automatic status handoff, the client work that disappears, and the next step,
 * so "we own the heavy lifting" includes ongoing reliability without client effort. Rules-based, offline. Nothing is sent.
 * "client reliability for the onboarding automation", "reliability ownership pack for invoice reminders",
 * "package the monitoring Verse owns for the support router".
 */
export function isClientReliability(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:client\s+)?reliability(?:\s+ownership)?\s+(?:pack|for|of)\b/i.test(t)
    || /^(?:make|generate|create|build|package)\s+(?:a\s+)?(?:client\s+)?reliability(?:\s+ownership)?\s+(?:pack|for)\b/i.test(t)
    || /^(?:package|show)\s+(?:the\s+)?(?:monitoring|reliability)\s+(?:Verse\s+owns|for)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    owned: [
      'Uptime and error monitors on the automations Verse runs for ' + name,
      'Status cards the client can summon any time ("system status for ' + name + '")',
      'Automatic incident notes when a monitor trips, handed off without a client check',
      'Weekly reliability summary that arrives as a card, not an email the client must open'
    ],
    drops: [
      'No more client-side watching of dashboards or logs',
      'No more asking "is it still running" or chasing status updates',
      'No more building or maintaining the monitors themselves'
    ],
    next: 'Start with a handoff checklist or systems-monitor card for ' + name + '. The reliability pack stays here for the client.'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = packFor(text);
  showPage((el) => {
    const owned = pack.owned.map(i => '<li>' + esc(i) + '</li>').join('');
    const drops = pack.drops.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Reliability ownership: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the monitoring so the client does not.</p>'
      + '<h3>What Verse owns</h3><ul>' + owned + '</ul>'
      + '<h3>Client work that drops</h3><ul>' + drops + '</ul>'
      + '<p>' + esc(pack.next) + '</p>'
      + '<div class="src">Source: A-to-Mind reliability ownership · nothing sent</div>';
  });
  return 'client-reliability';
}

export const builtWith = ['systems-monitor', 'monitor-pack', 'handoff-checklist', 'client-status', 'delivery-dashboard'];
export default {
  name: 'client-reliability',
  examples: [
    'client reliability for the onboarding automation',
    'reliability ownership pack for invoice reminders',
    'package the monitoring Verse owns for the support router',
    'make a client reliability pack for weekly status reports'
  ],
  nearMisses: [
    'what is reliability',
    'system status',
    'handoff the system',
    'monitor the automation'
  ],
  match: (low, raw) => isClientReliability(raw || low),
  run,
  part: null
};
