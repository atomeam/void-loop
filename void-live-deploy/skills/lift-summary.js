/**
 * lift-summary skill — a short summary of the systems, automations, monitoring and handoff
 * included for a business idea. Lists the systems included, the client work that drops, and the next
 * handoff step so selling and delivery stay consistent and reliable.
 * "lift summary for client onboarding", "lift summary for invoice reminders",
 * "package a lift summary for the support flow".
 * Rules-based, offline. Nothing is sent. Reuses the delivery practice already on main.
 */
export function isLiftSummary(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:lift\s+summary|heavy\s*lift(?:ing)?\s+summary|we\s+own(?:\s+the)?\s+heavy\s*lift(?:ing)?)\b/i.test(t)
    || /^(?:make|generate|create|package)\s+(?:a\s+)?(?:lift\s+summary|heavy\s*lift(?:ing)?\s+(?:summary|pack))\b/i.test(t)
    || /^(?:package|show)\s+(?:the\s+)?(?:heavy\s*lift(?:ing)?|we\s+own(?:\s+it)?)\s+for\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the idea';
}

export function summaryFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    owns: [
      'Capture and clarify the idea into a system plan',
      'Design, build and connect the systems (existing tools first)',
      'Test, monitor and keep the automations running',
      'Docs, status and the handoff package'
    ],
    clientDoesLess: [
      'No longer builds or watches the first automations',
      'No dashboard watching or manual status chasing',
      'Keeps only the outcome and the final yes'
    ],
    next: 'Ask for the handoff checklist or delivery pack when the first slice ships'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const pack = summaryFor(text);
  showPage((el) => {
    const owns = pack.owns.map(i => '<li>' + esc(i) + '</li>').join('');
    const less = pack.clientDoesLess.map(i => '<li>' + esc(i) + '</li>').join('');
    el.innerHTML = '<h2>Lift summary: ' + esc(name) + '</h2>'
      + '<p class="sub">A short package for the client. Verse takes the systems; the client keeps the outcome.</p>'
      + '<h3>What Verse owns</h3><ul>' + owns + '</ul>'
      + '<h3>Client work that drops</h3><ul>' + less + '</ul>'
      + '<h3>Next</h3><p>' + esc(pack.next) + '</p>'
      + '<div class="src">Source: A-to-Mind lift summary · nothing sent</div>';
  });
  return 'lift-summary';
}

export const builtWith = ['proposal-pack', 'delivery-pack', 'handoff-checklist', 'heavy-lift-map'];
export default {
  name: 'lift-summary',
  examples: [
    'lift summary for client onboarding',
    'lift summary for invoice reminders',
    'package a lift summary for the support flow',
    'make a lift summary for weekly status reports'
  ],
  nearMisses: [
    'what is a lift',
    'summary of the system',
    'proposal pack for onboarding'
  ],
  match: (low, raw) => isLiftSummary(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isLiftSummary) && !this.nearMisses.some(isLiftSummary);
    return { ok, got: ok ? 'match works' : 'match broke' };
  }
};
