/**
 * roi-pack skill — package the return on investment for a business idea or system Verse owns.
 * Shows hours saved, estimated cost avoided and next handoff so selling and delivery stay consistent and the client sees we own the heavy lifting.
 * Rules-based estimate from typical load. Nothing is sent or claimed as measured.
 * "roi pack for the invoice automation", "return on investment for onboarding flow", "value of Verse owning support router".
 */
export function isRoiPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:roi|return\s+on\s+investment|value)\s+(?:pack|package|of|for)\b/i.test(t)
    || /^(?:make|generate|show|package)\s+(?:a\s+|the\s+)?(?:roi|return)\b/i.test(t)
    || /\broi\s+(?:for|of|on)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the system';
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    hoursPerWeek: 4,
    costAvoided: '$400',
    basis: 'Typical small process: 4h/week at $100/h equivalent now owned by Verse',
    owns: ['Status and monitors', 'Verification tests', 'Handoff docs', 'Running automations'],
    next: 'Client can summon status digest or time saved anytime; Verse keeps owning the heavy lifting'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = packFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>ROI pack: ' + esc(p.subject) + '</h2>'
      + '<p><strong>~' + p.hoursPerWeek + ' hours/week (~' + p.costAvoided + ' avoided)</strong></p>'
      + '<p>' + esc(p.basis) + '</p>'
      + '<h3>What Verse owns</h3><ul>' + p.owns.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>'
      + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
      + '<p class="sub">Estimate only. Real value depends on the process. Nothing is invented as already done.</p>'
      + '<div class="src">Source: A-to-Mind roi-pack · nothing measured live, nothing sent</div>';
  });
  return 'roi-pack';
}

export const builtWith = ['time-saved', 'status-digest', 'full-handoff'];
export default {
  name: 'roi-pack',
  examples: [
    'roi pack for the invoice automation',
    'return on investment for onboarding flow',
    'value of Verse owning the support router',
    'show the roi package for weekly reports'
  ],
  nearMisses: [
    'what is roi',
    'return this',
    'status digest',
    'time saved'
  ],
  match: (low, raw) => isRoiPack(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isRoiPack) && !this.nearMisses.some(isRoiPack)
      && packFor('roi pack for x').hoursPerWeek === 4 && packFor('roi pack for x').costAvoided === '$400';
    return { ok, got: ok ? 'match works; estimate is fixed typical' : 'mismatch' };
  }
};
