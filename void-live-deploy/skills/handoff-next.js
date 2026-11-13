/**
 * handoff-next skill — package the next concrete handoff step for a system or business idea
 * so the client knows exactly what Verse will deliver next and does less chasing or waiting.
 * Rules-based, offline. Nothing is sent or claimed as already live.
 * "next handoff for the onboarding flow", "handoff next for invoice automation",
 * "what is the next handoff for support router".
 */
export function isHandoffNext(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:next|the\s+next)\s+handoff\b/i.test(t)
    || /^handoff\s+next\b/i.test(t)
    || /^(?:show|make|package|what\s+is)\s+(?:the\s+)?next\s+handoff\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function nextFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    nextStep: 'A live status card the client can summon, plus the ownership note that Verse owns the monitors and the first automation behind the confirm line',
    delivers: [
      'Status the client does not have to chase',
      'Clear ownership so client work drops',
      'One small automation the client does not build',
      'The path to summon it again'
    ],
    clientDoes: 'Decide only if the slice is the right next one; everything else Verse owns',
    summon: 'Ask "system status for ' + name + '" or "status digest for ' + name + '"'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const n = nextFor(text);
  const list = (arr) => arr.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Next handoff: ' + esc(n.subject) + '</h2>'
      + '<p><strong>Next step Verse delivers:</strong> ' + esc(n.nextStep) + '</p>'
      + '<h3>What the client gets</h3><ul>' + list(n.delivers) + '</ul>'
      + '<p><strong>Client does:</strong> ' + esc(n.clientDoes) + '</p>'
      + '<p><strong>How to summon later:</strong> ' + esc(n.summon) + '</p>'
      + '<p class="sub">Nothing is sent. The card stays on the stage. No uptime is claimed until a real check answers.</p>'
      + '<div class="src">Source: A-to-Mind handoff-next</div>';
  });
  return 'handoff-next';
}

export const builtWith = ['system-status', 'status-digest', 'system-slice', 'full-handoff'];
export default {
  name: 'handoff-next',
  examples: [
    'next handoff for the onboarding flow',
    'handoff next for invoice automation',
    'what is the next handoff for the support router',
    'package the next handoff for weekly reports',
    'next handoff for client portal'
  ],
  nearMisses: [
    'system status for onboarding',
    'full handoff for the idea',
    'what is a handoff',
    'next system slice for onboarding',
    'delivery board'
  ],
  match(lower, text) { return isHandoffNext(text || lower); },
  run
};
