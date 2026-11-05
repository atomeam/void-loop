/**
 * we-own skill — package "we own the heavy lifting" for a business idea or system.
 * Clarifies ownership so the client keeps the outcome and does less work:
 * what the client owns (decisions, approvals, outcome), what A-to-Mind owns
 * (capture, design, build, connect, test, monitor, maintain), handoff points.
 * "we own the heavy lifting for: late invoice follow-ups",
 * "ownership handoff: client onboarding automation",
 * "package ownership: status monitoring for the portal"
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export function isWeOwn(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:we\s+own(?:\s+the)?\s+(?:heavy\s+)?lifting|ownership\s+(?:handoff|package|card)|package\s+ownership)\b/i.test(t)
    || /^(?:make|generate|create|show)\s+(?:a\s+)?(?:we-own|ownership)\s+(?:card|handoff|package)\b/i.test(t);
}

export function extractSubject(text) {
  const t = String(text || '');
  // "for: idea" or "for idea" or ": idea" after the lead
  let m = t.match(/\b(?:for|of)\s*[:\-]?\s*(.+)$/i);
  if (m) return m[1].trim().replace(/[?!.]+$/, '');
  // after colon following the lead phrase
  m = t.match(/^(?:we\s+own(?:\s+the)?\s+(?:heavy\s+)?lifting|ownership\s+(?:handoff|package|card)|package\s+ownership)\s*[:\-]\s*(.+)$/i);
  if (m) return m[1].trim().replace(/[?!.]+$/, '');
  m = t.match(/\b(?:handoff|package|card)\s+(?:for\s+)?(.+)$/i);
  return m ? m[1].trim().replace(/[?!.]+$/, '') : 'this system';
}

/** Pure ownership split for a subject. Same input always same output. */
export function ownershipOf(subject) {
  const s = String(subject || 'this system').trim();
  return {
    subject: s,
    clientOwns: [
      'The outcome and success criteria',
      'Decisions that change scope or risk',
      'Approvals on the confirm line before any send, book or spend',
      'What “done” looks like for their business'
    ],
    weOwn: [
      'Capture and clarify the idea into requirements',
      'Design, build and connect the systems (existing tools first)',
      'Test until the suite checks prove it',
      'Monitor status, incidents and health the client can see',
      'Maintain and hand off running automations'
    ],
    handoff: [
      'Status card: current state, last green check, ownership line',
      'Docs: how it runs, what breaks, what the client never has to do',
      'Running automations listed with their confirm-line gates'
    ]
  };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const subject = extractSubject(text);
  const own = ownershipOf(subject);
  const el = showPage((p) => { p.innerHTML = '<h2>Ownership handoff</h2><div class="sub">packaging…</div>'; });
  const html = [
    `<h2>We own the heavy lifting: ${esc(own.subject)}</h2>`,
    `<p class="sub">Client keeps the outcome. We take the systems.</p>`,
    `<h3>What the client owns</h3><ul>`,
    ...own.clientOwns.map(i => `<li>${esc(i)}</li>`),
    `</ul>`,
    `<h3>What we own</h3><ul>`,
    ...own.weOwn.map(i => `<li>${esc(i)}</li>`),
    `</ul>`,
    `<h3>Handoff package</h3><ul>`,
    ...own.handoff.map(i => `<li>${esc(i)}</li>`),
    `</ul>`,
    `<p><strong>We own the heavy lifting.</strong> You keep the result and do less.</p>`,
    `<div class="src">Source: A-to-Mind delivery practice</div>`
  ].join('');
  el.innerHTML = html;
  return 'we-own';
}

export default {
  name: 'we-own',
  examples: [
    'we own the heavy lifting for: late invoice follow-ups',
    'ownership handoff: client onboarding automation',
    'package ownership: status monitoring for the portal',
    'show we-own card for lead capture'
  ],
  nearMisses: ['we own a house', 'ownership of the code', 'what do we own'],
  match(lower, text) { return isWeOwn(text); },
  run,
  suite() {
    const ok = isWeOwn('we own the heavy lifting for: invoices')
      && isWeOwn('ownership handoff: onboarding')
      && !isWeOwn('we own a house')
      && ownershipOf('x').weOwn.length >= 4;
    return { ok, got: ok ? 'match and ownership split work' : 'failed' };
  }
};
