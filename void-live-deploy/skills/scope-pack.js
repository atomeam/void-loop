/**
 * scope-pack skill — clarify the scope of what Verse owns versus what the client owns for a business idea or process.
 * So handoffs reduce client work and selling “we own the heavy lifting” stays clear.
 * Rules-based, offline. Nothing is sent.
 * "scope pack for the invoice automation", "what Verse owns for onboarding", "client scope for the support router".
 */
export function isScopePack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:scope|ownership)\s+pack\b/i.test(t)
    || /^(?:make|generate|show|package)\s+(?:a\s+|the\s+)?(?:scope|ownership)\s+pack\b/i.test(t)
    || /\bscope\s+(?:for|of|on)\b/i.test(t)
    || /^(?:what\s+Verse\s+owns|client\s+scope)\s+(?:for|of)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the process';
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    verseOwns: [
      'Design, build and connect the systems',
      'Run the automations behind the confirm line',
      'Own the monitors, alerts and verification',
      'Package status, docs and handoff'
    ],
    clientOwns: [
      'The business outcome and priority decisions',
      'Feedback on what is working',
      'Access to the status and handoff package'
    ],
    drops: 'No more building tools, watching runs or writing status updates',
    next: 'Ask for the system plan or full handoff for ' + name
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = packFor(text);
  const verse = p.verseOwns.map(i => '<li>' + esc(i) + '</li>').join('');
  const client = p.clientOwns.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Scope pack: ' + esc(p.subject) + '</h2>'
      + '<p class="sub">Clear ownership so the client does less and Verse owns the heavy lifting.</p>'
      + '<h3>What Verse owns</h3><ul>' + verse + '</ul>'
      + '<h3>What the client owns</h3><ul>' + client + '</ul>'
      + '<h3>Client work that drops</h3><p>' + esc(p.drops) + '</p>'
      + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
      + '<p class="sub">Nothing is invented as already done. Ask for the system plan next.</p>'
      + '<div class="src">Source: A-to-Mind scope-pack · nothing sent</div>';
  });
  return 'scope-pack';
}

export const builtWith = ['ownership-pack', 'system-plan', 'full-handoff', 'client-offer'];
export default {
  name: 'scope-pack',
  examples: [
    'scope pack for the invoice automation',
    'what Verse owns for onboarding flow',
    'client scope for the support router',
    'make a scope pack for weekly reports',
    'ownership pack for the email automation'
  ],
  nearMisses: [
    'what is scope',
    'ownership',
    'system plan',
    'full handoff',
    'client offer'
  ],
  match: (low, raw) => isScopePack(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isScopePack) && !this.nearMisses.some(isScopePack)
      && packFor('scope pack for x').verseOwns.length === 4 && packFor('scope pack for x').clientOwns.length === 3;
    return { ok, got: ok ? 'match works; scope lists ownership clearly' : 'mismatch' };
  }
};
