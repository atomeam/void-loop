/**
 * automation-pack skill — propose the automations Verse will own for a business process
 * so the client does less building and monitoring. Reuses existing tools where possible.
 * Rules-based, offline. Nothing is sent. The card stays on the stage for the client to keep or share.
 * "automation pack for invoice reminders", "what automations will Verse own for onboarding",
 * "propose automations for the support router".
 */
export function isAutomationPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t) return false;
  return /^(?:automation|automations)\s+pack(?:\s+for)?\b/i.test(t)
    || /^(?:propose|suggest|make|generate)\s+(?:an?\s+)?(?:automations?|jobs?)\s+(?:pack|for|that)\b/i.test(t)
    || /^(?:what|which)\s+automations?\s+(?:will|does)\s+verse\s+own\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|about|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 2 ? s.slice(0, 160) : 'this process';
}

function suggestAutomations(subject) {
  const t = subject.toLowerCase();
  const autos = [];
  if (/email|inbox|support|customer/.test(t)) {
    autos.push('draft replies behind the confirm line');
    autos.push('triage incoming into the status card');
  }
  if (/invoice|bill|payment|remind/.test(t)) {
    autos.push('send reminders on schedule (confirm line first)');
    autos.push('mark paid when the client says so');
  }
  if (/onboard|signup|welcome|client/.test(t)) {
    autos.push('welcome sequence that waits for the client yes');
    autos.push('stalled-step alert the client does not watch');
  }
  if (/report|status|update|weekly/.test(t)) {
    autos.push('generate the progress-report on schedule');
    autos.push('hand the report to the client without chasing');
  }
  if (autos.length === 0) {
    autos.push('the core flow that runs without the client watching');
    autos.push('one status card the client can summon anytime');
  }
  return autos;
}

function run(text, api) {
  const { showPage, esc } = api;
  const name = subjectOf(text);
  const autos = suggestAutomations(name);
  showPage((el) => {
    const list = autos.map((a) => '<li>' + esc(a) + '</li>').join('');
    el.innerHTML = '<h2>Automation pack: ' + esc(name) + '</h2>'
      + '<p>Verse owns the heavy lifting. These automations run behind the confirm line so the client does less.</p>'
      + '<h3>Automations Verse will own</h3><ul>' + list + '</ul>'
      + '<h3>Client does less</h3>'
      + '<p>No building the jobs, no watching them run, no chasing status. One yes on the outcome.</p>'
      + '<h3>Next step</h3>'
      + '<p>Ask for the monitor-pack or system-slice for ' + esc(name) + ' to deepen ownership.</p>'
      + '<p class="sub">Nothing is sent. The pack stays with the client.</p>'
      + '<div class="src">Source: A-to-Mind automation pack · we own the heavy lifting</div>';
  });
  return 'automation-pack';
}

export const builtWith = ['monitor-pack', 'system-slice', 'ownership-pack', 'delivery-pack'];
export default {
  name: 'automation-pack',
  examples: [
    'automation pack for invoice reminders',
    'what automations will Verse own for onboarding',
    'propose automations for the support router',
    'make an automation pack for weekly reports',
    'automations pack for the client portal'
  ],
  nearMisses: [
    'monitor pack for Acme',
    'system slice for onboarding',
    'ownership pack for Acme',
    'what is an automation'
  ],
  match(lower, text) { return isAutomationPack(text || lower); },
  run,
};
