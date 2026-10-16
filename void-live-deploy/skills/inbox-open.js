/**
 * inbox-open skill — shows the open and building rows from the growth inbox.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show open inbox", "what's open in growth", "growth inbox open rows".
 * Empty surface stays empty.
 */
export function inboxOpenOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:show|list|what'?s|see)\s+(?:the\s+)?(?:open|building)\s+(?:rows?\s+)?(?:in\s+)?(?:the\s+)?(?:growth\s+)?inbox(?:\s+rows?)?$/.test(t)
    || /^growth\s+inbox\s+(?:open|building)\s+rows?$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!inboxOpenOf(text)) return 'none';
  const rows = [
    { status: 'building', ask: 'film discovery skill returns JSON film metadata' },
    { status: 'open', ask: 'phone-cut films skill auto-generates promotional posters' },
    { status: 'open', ask: 'browser video recordings pipeline to GitHub release assets' },
  ];
  showPage((p) => {
    p.innerHTML = '<h2>Growth inbox open rows</h2><div class="sub">Never deleted; shipped stay with SHA</div>'
      + '<ul>' + rows.map((r) => '<li><b>' + esc(r.status) + '</b> — ' + esc(r.ask) + '</li>').join('') + '</ul>'
      + '<div class="src">From domains/growth-inbox.md (snapshot)</div>';
  });
  return 'inbox-open';
}

export default {
  name: 'inbox-open',
  examples: ['show open inbox', 'growth inbox open rows', "what's open in growth"],
  nearMisses: ['growth', 'what did you do today', 'open a card'],
  match(lower, text) { return inboxOpenOf(text); },
  run,
  suite() {
    return { ok: inboxOpenOf('show open inbox') && inboxOpenOf('growth inbox open rows') && !inboxOpenOf('growth') };
  },
};
