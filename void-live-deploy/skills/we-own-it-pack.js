/**
 * we-own-it-pack skill — package a clarified business idea into a client-facing card that shows
 * exactly what Verse owns (capture, design, build, connect, test, monitor, handoff) so the client
 * does less and we can sell "we own the heavy lifting."
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "we own it pack for my invoice idea", "package the heavy lifting for client onboarding", "we-own-it for SaaS support"
 */
export function isWeOwnIt(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:we\s+own\s+it|heavy\s+lifting)\s+(?:pack|package)\b/i.test(t)
    || /^(?:package|pack)\s+the\s+heavy\s+lifting\b/i.test(t)
    || /^(?:make|create|generate)\s+(?:a\s+)?(?:we-own-it|heavy-lift)\s+(?:pack|package)\b/i.test(t);
}

function extractIdea(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|idea|business)\s*[:\-]\s*(.+)/i) || t.match(/\bfor\s+(?:my\s+|the\s+|a\s+)?(.+)/i) || t.match(/[:\-]\s*(.+)/);
  return m ? m[1].trim() : 'unspecified business idea';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const idea = extractIdea(text);
  const el = showPage((p) => { p.innerHTML = '<h2>We own it</h2><div class="sub">building…</div>'; });
  const pack = [
    `<h2>We own the heavy lifting: ${esc(idea)}</h2>`,
    `<p><strong>Clarified idea:</strong> ${esc(idea)} becomes a reliable system Verse designs, builds, connects, tests and monitors.</p>`,
    `<h3>What Verse owns</h3><ul>`,
    `<li>Capture & clarify the ask into requirements</li>`,
    `<li>Design and build the core workflow or automation</li>`,
    `<li>Connect existing tools first (void.existing-tools.md)</li>`,
    `<li>Test with suite checks that prove the handoff</li>`,
    `<li>Monitor with status the client can see, and own incidents</li>`,
    `<li>Handoff docs, status and running automations</li>`,
    `</ul>`,
    `<h3>What the client keeps</h3><p>The outcome and the final yes. Everything else is off their plate.</p>`,
    `<p class="sub">Use this card when packaging or selling: "we own the heavy lifting."</p>`,
    `<div class="src">Source: A-to-Mind delivery practice</div>`
  ].join('');
  el.innerHTML = pack;
  return 'we-own-it-pack';
}

export default {
  name: 'we-own-it-pack',
  examples: [
    'we own it pack for my invoice idea',
    'package the heavy lifting for client onboarding',
    'we-own-it for SaaS support',
    'make a we-own-it pack for the support ticket router'
  ],
  nearMisses: ['what do we own', 'own it', 'heavy lifting only'],
  match(lower, text) { return isWeOwnIt(text || lower); },
  run,
  suite() {
    const ok = isWeOwnIt('we own it pack for my invoice idea')
      && isWeOwnIt('package the heavy lifting for client onboarding')
      && isWeOwnIt('we-own-it for SaaS support')
      && isWeOwnIt('make a we-own-it pack for the support ticket router')
      && !isWeOwnIt('what do we own')
      && !isWeOwnIt('own it')
      && !isWeOwnIt('heavy lifting only');
    return { ok, got: 'match works' };
  }
};
