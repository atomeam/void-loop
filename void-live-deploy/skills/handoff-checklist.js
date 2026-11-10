/**
 * handoff-checklist skill — a reliable handoff checklist for a system Verse owns.
 * Lists the status, docs, automations and monitoring points the client receives so
 * delivery is consistent and client work drops. Rules-based, offline. Nothing is sent.
 * "handoff checklist for the onboarding automation", "make a handoff checklist for invoice reminders",
 * "checklist to hand off the support router".
 */
export function isHandoffChecklist(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:handoff|hand\s*off)\s+checklist\b/i.test(t)
    || /^(?:make|generate|create|build)\s+(?:a\s+)?(?:handoff|hand\s*off)\s+checklist\b/i.test(t)
    || /^(?:checklist\s+(?:to|for)\s+hand(?:ing)?\s*off|hand\s*off\s+checklist\s+for)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function checklistFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    items: [
      'Status: a live "system status for ' + name + '" card the client can summon',
      'Docs: what runs, what the client owns, what Verse owns (from the heavy-lift map)',
      'Automations: only those already behind the confirm line; list their approve cards (e.g. approve-card)',
      'Monitoring: the monitors from the monitor pack, with how the client is told',
      'Handoff package: the delivery pack or client handoff card for this system',
      'Next: the first system slice already shipped and the remaining open steps'
    ]
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = checklistFor(text);
  showPage((el) => {
    const items = pack.items.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Handoff checklist: ' + esc(name) + '</h2>'
      + '<p class="sub">Verse owns the heavy lifting. This checklist makes the handoff reliable.</p>'
      + '<ul>' + items + '</ul>'
      + '<p class="sub">Nothing is invented as already done. Ask for the live status or the pack when ready.</p>'
      + '<div class="src">Source: A-to-Mind handoff checklist · nothing sent</div>';
  });
  return 'handoff-checklist';
}

export const builtWith = ['system-handoff', 'client-handoff', 'delivery-pack', 'monitor-pack', 'heavy-lift-map'];
export default {
  name: 'handoff-checklist',
  examples: [
    'handoff checklist for the onboarding automation',
    'make a handoff checklist for invoice reminders',
    'checklist to hand off the support router',
    'generate a handoff checklist for the weekly status reports'
  ],
  nearMisses: [
    'what is a checklist',
    'handoff the system',
    'client handoff for onboarding',
    'status for the system'
  ],
  match: (low, raw) => isHandoffChecklist(raw || low),
  run,
  part: null
};
