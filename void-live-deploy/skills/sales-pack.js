/**
 * sales-pack skill — package a business idea into a sellable offer that Verse owns the heavy lifting.
 * Lists the systems Verse runs, estimated time the client no longer spends, a simple value note,
 * the offer points, and the next handoff step. Rules-based, offline. Nothing is sent or priced as live.
 * "sales pack for client onboarding", "package the offer for invoice automation",
 * "sell the hard work for the support process", "make a sales pack for weekly reports".
 */
export function isSalesPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:sales\s+pack|package\s+the\s+offer|sell\s+the\s+heavy\s+lifting)\b/i.test(t)
    || /^(?:make|generate|create|show)\s+(?:a\s+)?sales\s+pack\s+for\b/i.test(t)
    || /^sales\s+pack\s+for\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function packFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    systems: [
      'Intake and clarify the idea so the client describes less',
      'Design and build the next smallest useful system slice',
      'Connect existing tools Verse already owns where they fit',
      'Test the critical path and monitor it so the client does not watch dashboards'
    ],
    timeSaved: 'Hours the client no longer spends on setup, chasing status, testing and firefighting (estimate from the time-saved card)',
    value: 'Verse owns the systems, monitors and verification. The client keeps the decisions and the relationship.',
    offer: [
      'Verse does the hard work: design, build, connect, test and monitor',
      'Client work drops to the minimum: clarify once, approve the handoff',
      'Status, docs and running automations arrive as a finished package',
      'Reliable delivery because Verse watches what it owns'
    ],
    next: 'Ask for the full handoff or the client lift summary once the slice is ready to sell.'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = packFor(text);
  const list = (arr) => arr.map(i => '<li>' + esc(i) + '</li>').join('');
  showPage((el) => {
    el.innerHTML = '<h2>Sales pack: ' + esc(p.subject) + '</h2>'
      + '<p><strong>Verse does the hard work.</strong></p>'
      + '<h3>Systems Verse runs</h3><ul>' + list(p.systems) + '</ul>'
      + '<h3>Time the client no longer spends</h3><p>' + esc(p.timeSaved) + '</p>'
      + '<h3>Value</h3><p>' + esc(p.value) + '</p>'
      + '<h3>The offer</h3><ul>' + list(p.offer) + '</ul>'
      + '<p><strong>Next:</strong> ' + esc(p.next) + '</p>'
      + '<p class="sub">Nothing is claimed as already sold or priced. This packages the delivery so the client sees the work that drops.</p>'
      + '<div class="src">Source: A-to-Mind sales pack · nothing sent</div>';
  });
  return 'sales-pack';
}

export default {
  name: 'sales-pack',
  examples: [
    'sales pack for client onboarding',
    'package the offer for invoice automation',
    'sell the hard work for the support process',
    'make a sales pack for weekly reports'
  ],
  nearMisses: [
    'what is the offer',
    'client offer',
    'roi pack',
    'time saved'
  ],
  match: (low, raw) => isSalesPack(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isSalesPack) && !this.nearMisses.some(isSalesPack)
      && packFor('sales pack for x').systems.length === 4
      && packFor('sales pack for x').offer.length === 4;
    return { ok, got: ok ? 'match works; pack has systems and offer points' : 'mismatch' };
  }
};
