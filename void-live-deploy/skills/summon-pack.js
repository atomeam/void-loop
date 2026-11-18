/**
 * summon-pack skill — package the exact asks a client types to summon live status, ownership, progress, time saved and the next handoff for a system Verse owns.
 * The client never has to remember dashboards or chase. Verse owns the heavy lifting; this card makes the summons reliable.
 * Rules-based, offline. Nothing is sent.
 * "summon pack for the invoice automation", "client asks for onboarding status", "how does the client summon the support router status".
 */
export function isSummonPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:summon|client\s+asks?)\s+(?:pack|package|for)\b/i.test(t)
    || /^(?:make|generate|show|package)\s+(?:a\s+|the\s+)?(?:summon|client\s+asks?)\s+(?:pack|for)\b/i.test(t)
    || /\bhow\s+(?:does|can)\s+(?:the\s+)?client\s+summon\b/i.test(t)
    || /^(?:summon\s+pack)\s+(?:for|of|on)\b/i.test(t);
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
    asks: [
      'delivery board for ' + name,
      'status digest for ' + name,
      'time saved for ' + name,
      'ownership pack for ' + name,
      'progress report for ' + name
    ],
    why: 'These asks bring the live readings Verse already owns (guards, incidents, hours saved) onto the stage. The client types them; nothing is sent or logged in by the client.',
    next: 'Share this card. The client keeps the asks; Verse keeps the systems, monitors and handoffs.'
  };
}

async function run(text, api) {
  const { showPage } = api;
  const esc = typeof api.esc === 'function' ? api.esc : (s) => String(s == null ? '' : s);
  const p = packFor(text);
  showPage((el) => {
    el.innerHTML = '<h2>Summon pack: ' + esc(p.subject) + '</h2>'
      + '<p>Verse owns the systems. The client summons status, ownership and progress with these asks. No dashboards, no chasing.</p>'
      + '<h3>Asks the client can type</h3><ul>' + p.asks.map(i => '<li><code>' + esc(i) + '</code></li>').join('') + '</ul>'
      + '<h3>Why this works</h3><p>' + esc(p.why) + '</p>'
      + '<h3>Next</h3><p>' + esc(p.next) + '</p>'
      + '<p class="sub">Nothing is sent. The pack stays on the stage for sharing. A reading that did not answer is named by the skill it summons.</p>'
      + '<div class="src">Source: A-to-Mind summon-pack · Verse owns the hard work</div>';
  });
  return 'summon-pack';
}

export const builtWith = ['delivery-board', 'status-digest', 'time-saved', 'ownership', 'progress-report'];
export default {
  name: 'summon-pack',
  examples: [
    'summon pack for the invoice automation',
    'client asks for onboarding status',
    'how does the client summon the support router status',
    'package the client asks for weekly reports'
  ],
  nearMisses: [
    'what is a summon',
    'delivery board',
    'status digest',
    'summon a figure'
  ],
  match: (low, raw) => isSummonPack(raw || low),
  run,
  suite() {
    const ok = this.examples.every(isSummonPack) && !this.nearMisses.some(isSummonPack)
      && packFor('summon pack for x').asks.length === 5;
    return { ok, got: ok ? 'match works; five client asks' : 'mismatch' };
  }
};
