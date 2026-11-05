/**
 * delivery-checklist skill — turns a business idea into a concrete checklist of systems,
 * automations, tests, and handoff points so Verse owns the heavy lifting.
 * Reuses existing tools first. "delivery checklist for automating client onboarding",
 * "checklist for the invoice reminder system", "make a delivery checklist for my SaaS idea".
 */
export function isDeliveryChecklist(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:delivery\s+)?checklist\b/i.test(t)
    || /^(?:make|generate|create)\s+(?:a\s+)?(?:delivery\s+)?checklist\b/i.test(t);
}

export function ideaOf(text) {
  const m = String(text || '').match(/\b(?:for|of|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim() : '';
  return s.length >= 3 ? s.slice(0, 200) : 'the business idea';
}

function run(text, api) {
  const { showPage, esc } = api;
  const idea = ideaOf(text);
  const items = [
    { what: 'Capture & clarify', how: 'Use the business-clarify skill: "clarify this business idea: ' + idea + '"' },
    { what: 'Systems to design/build/connect', how: 'List core flows; check domains/void.existing-tools.md before inventing' },
    { what: 'Automations that reduce client work', how: 'Identify repeated steps; package with delivery-pack' },
    { what: 'Test', how: 'Add a suite check that proves the handoff works offline' },
    { what: 'Monitor', how: 'Client-visible status via system-status skill' },
    { what: 'Handoff', how: 'Generate client-handoff card; nothing is sent without confirm line' }
  ];
  const html = '<h2>Delivery checklist: ' + esc(idea) + '</h2>'
    + '<p>Concrete steps so Verse owns the heavy lifting. Client keeps the outcome.</p><ol>'
    + items.map(it => '<li><b>' + esc(it.what) + ':</b> ' + esc(it.how) + '</li>').join('')
    + '</ol><p class="sub">Reuse existing tools first. Mark rows building in the same commit as the skill.</p>'
    + '<div class="src">Source: A-to-Mind delivery practice · checklist not a live system</div>';
  showPage((el) => { el.innerHTML = html; });
  return 'delivery-checklist';
}

export default {
  name: 'delivery-checklist',
  examples: [
    'delivery checklist for automating client onboarding',
    'checklist for the invoice reminder system',
    'make a delivery checklist for my SaaS idea'
  ],
  nearMisses: ['what is a checklist', 'todo list', 'package this idea'],
  match(lower, text) { return isDeliveryChecklist(text || lower); },
  run,
  suite() {
    const ok = isDeliveryChecklist('delivery checklist for automating client onboarding')
      && isDeliveryChecklist('checklist for the invoice reminder system')
      && isDeliveryChecklist('make a delivery checklist for my SaaS idea')
      && !isDeliveryChecklist('what is a checklist')
      && !isDeliveryChecklist('todo list');
    return { ok, got: 'match works' };
  }
};
