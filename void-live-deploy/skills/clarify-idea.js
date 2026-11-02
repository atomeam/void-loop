/**
 * clarify-idea skill — turn a rough business idea into a structured outline that captures the problem, outcome, systems to build or connect, and handoff points.
 * Helps A-to-Mind take over the heavy lifting: clarify once, then design, build, monitor and hand off reliably.
 * "clarify this idea: automate client onboarding", "clarify idea: we need better invoicing for the agency", "turn this into a system plan: ...".
 */
export function isClarify(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:clarify\s+(?:this\s+|my\s+|the\s+)?(?:business\s+)?idea|turn\s+this\s+(?:business\s+)?idea\s+into\s+a\s+(?:system\s+)?(?:plan|outline)|clarify\s*:)/i.test(t);
}

function extractIdea(text) {
  const m = String(text || '').match(/(?:idea|plan|clarify)\s*[:\-]\s*(.+)/i);
  return m ? m[1].trim().slice(0, 400) : String(text || '').replace(/^(?:please\s+)?(?:clarify\s+(?:this\s+|my\s+|the\s+)?(?:business\s+)?idea|turn\s+this\s+(?:business\s+)?idea\s+into\s+a\s+(?:system\s+)?(?:plan|outline))\s*[:\-]?\s*/i, '').trim().slice(0, 400);
}

async function run(text, api) {
  const { showPage, esc, say } = api;
  const idea = extractIdea(text);
  if (!idea) {
    say('Say “clarify idea: your rough business idea here”');
    return 'none';
  }
  const el = showPage((p) => { p.innerHTML = '<h2>Clarifying idea…</h2>'; });
  const sections = [
    ['Idea', idea],
    ['Problem it solves', 'The friction or manual work this removes for the business and its clients.'],
    ['Desired outcome', 'A running system the client can rely on, with status handed off cleanly.'],
    ['Systems to design / build / connect', 'Intake or capture, the core process automation, connections to existing tools, tests, and a monitor.'],
    ['Handoff & packaging', 'Client-ready docs or a live card showing status, what Verse owns, and how to ask for changes.'],
    ['Next heavy lifting Verse can take', 'Draft the proposal, build the first automation, set a monitor, prepare the handoff package.']
  ];
  const html = '<h2>Clarified idea</h2><p style="font-size:18px;font-weight:500">' + esc(idea) + '</p>'
    + sections.map(([h, b]) => '<h3 style="margin:14px 0 4px;font-size:15px">' + esc(h) + '</h3><p style="margin:0;opacity:.9">' + esc(b) + '</p>').join('')
    + '<div class="sub" style="margin-top:12px">Edit any line, then say “make a proposal from this” or “build the automation” to continue. Nothing is sent.</div>';
  el.innerHTML = html;
  say('Idea clarified into a system outline · yours to edit and hand off');
  return 'clarify-idea';
}

export default {
  name: 'clarify-idea',
  examples: [
    'clarify this idea: automate client onboarding for the law firm',
    'clarify idea: we need better invoicing for the agency',
    'turn this into a system plan: connect our CRM to the billing tool and watch for failed payments',
    'clarify: help the bakery track custom orders without spreadsheets'
  ],
  nearMisses: ['what is an idea', 'clarify the weather', 'business plan template', 'idea for a movie'],
  match(lower, text) { return isClarify(text || lower); },
  run,
  suite() {
    const ok = isClarify('clarify this idea: automate invoicing') && isClarify('clarify idea: track orders') && !isClarify('what is an idea');
    return { ok, got: ok ? 'match works' : 'match failed' };
  }
};
