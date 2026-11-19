/**
 * client-ownership-map skill — package a clear ownership map for a business idea
 * so Verse owns the heavy lifting (systems, automations, tests, monitors, docs)
 * and the client keeps only decisions and approvals. Reduces client work and
 * makes "verse does the hard work" concrete for delivery and selling.
 * "ownership map for client onboarding", "who owns what for the invoice bot",
 * "map the hard work for my SaaS idea".
 */
export function isClientOwnershipMap(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:ownership|owner)\s+(?:map|pack|chart)\b/i.test(t)
    || /^(?:who|what)\s+owns?\s+(?:what|this|it)\b/i.test(t)
    || /^(?:make|generate|show|package)\s+(?:an?\s+)?(?:ownership|owner)\s+(?:map|pack)\b/i.test(t)
    || /\bheavy\s+lifting\s+(?:map|for|of)\b/i.test(t);
}

export function subjectOf(text) {
  const m = String(text || '').match(/\b(?:for|of|on|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the business idea';
}

export function mapFor(subject) {
  const name = subjectOf(subject);
  return {
    subject: name,
    verseOwns: [
      'Capture and clarify the idea into system requirements',
      'Design, build and connect the systems and automations',
      'Test the flows and keep the suite green',
      'Monitor status, incidents and uptime',
      'Package status, docs and running automations for handoff',
      'Own the ongoing hard work so the client does less'
    ],
    clientKeeps: [
      'Business decisions and priorities',
      'Approvals on the confirm line when spend or send is involved',
      'The outcome and the customer relationship'
    ],
    next: 'Handoff the ownership map with the delivery pack so the client sees exactly what drops.'
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = subjectOf(text);
  const m = mapFor(idea);
  const el = showPage((p) => { p.innerHTML = '<h2>Ownership map</h2><div class="sub">building…</div>'; });
  const html = [
    `<h2>Ownership map: ${esc(m.subject)}</h2>`,
    `<p class="sub">Verse owns the hard work. The client keeps the decisions and the outcome.</p>`,
    `<h3>Verse owns</h3><ul>${m.verseOwns.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`,
    `<h3>Client keeps</h3><ul>${m.clientKeeps.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`,
    `<p><strong>Next:</strong> ${esc(m.next)}</p>`,
    `<div class="src">Source: A-to-Mind delivery practice — verse does the hard work</div>`
  ].join('');
  el.innerHTML = html;
  return 'client-ownership-map';
}

export default {
  name: 'client-ownership-map',
  examples: [
    'ownership map for client onboarding',
    'who owns what for the invoice automation',
    'map the hard work for my SaaS idea',
    'ownership pack for the support router'
  ],
  nearMisses: ['map of the world', 'who owns the company', 'ownership transfer'],
  match(lower, text) { return isClientOwnershipMap(text || lower); },
  run,
  suite() {
    const ok = isClientOwnershipMap('ownership map for client onboarding')
      && isClientOwnershipMap('who owns what for the invoice automation')
      && isClientOwnershipMap('map the hard work for my SaaS idea')
      && isClientOwnershipMap('ownership pack for the support router')
      && !isClientOwnershipMap('map of the world')
      && !isClientOwnershipMap('who owns the company')
      && !isClientOwnershipMap('ownership transfer');
    return { ok, got: 'match works' };
  }
};
