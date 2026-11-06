/**
 * system-blueprint skill — map an inbound business idea into a structured system plan
 * (A-to-Mind: facilitate ideas and take over the heavy lifting).
 * "blueprint this: late invoice follow-ups" / "turn this into a system: ..." / "idea to system: ..."
 * also the asks from the idea-to-system and system-sketch drafts: "system plan for: ...",
 * "sketch the system for: ...", "system design for ...". A "blueprint of" that is not a system
 * ("blueprint of the human body") is not one.
 * becomes a card: outcome, likely friction, ordered build steps, next actions, open questions.
 * No model call; the planner is fixed templates by idea shape so the same sentence always
 * yields the same structure. Empty surface stays empty until someone asks. The card's build line
 * (functions/api/blueprint.js) starts the build of an idea Verse learned itself and shows its real state.
 */

// Each lead keeps the idea in group 1. "blueprint of the human body" matches none of them.
const LEADS = [
  /^(?:please\s+)?(?:blueprint|map|structure|scope)\s+(?:this|that|my)\s*(?:idea|system|workflow|process|automation)?\s*[:\-]?\s*(.{8,280})$/i,
  /^(?:please\s+)?system\s+blueprint\s+for\s+(.{8,280})$/i,
  /^turn\s+(?:this|that|it)\s+into\s+a\s+system\s*[:\-]?\s*(.{8,280})$/i,
  /^idea\s+to\s+system\s*[:\-]?\s*(.{8,280})$/i,
  /^(?:make|build|design|generate|create)\s+(?:me\s+)?(?:a\s+)?(?:system\s+)?(?:blueprint|plan)\s+(?:for|of|:)\s*(.{8,280})$/i,
  /^(?:sketch|outline)\s+(?:the\s+)?system\s+(?:for|of|:)\s*(.{8,280})$/i,
  /^system\s+(?:plan|sketch|design)\s+(?:for|of|:)\s*(.{8,280})$/i,
];

/** Strip lead-in; return the raw idea text or null. Pure. */
export function ideaOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  for (const re of LEADS) {
    const m = re.exec(t);
    if (!m) continue;
    const idea = m[1].replace(/^(?:to\s+|for\s+|:\s*)/i, '').trim();
    if (idea.length >= 8) return idea;
  }
  return null;
}

const SHAPES = [
  {
    id: 'follow-up',
    re: /\b(?:follow[- ]?ups?|chase|remind|overdue|late\s+pay|collections?|dunning)\b/i,
    outcome: 'Reliable follow-ups without manual chasing',
    friction: ['Who owns the list today', 'Where status lives', 'When a human must step in'],
    steps: ['Define trigger (event or schedule)', 'Pull the work queue from the source of truth', 'Branch: auto message vs human review', 'Log every touch and outcome', 'Alert when still open past the SLA'],
    next: ['Name the source system and the field that marks "needs follow-up"', 'Draft the first message template and the stop conditions'],
  },
  {
    id: 'intake',
    re: /\b(?:intake|onboard|sign[- ]?up|lead|inquiry|request\s+form|new\s+client|new\s+customer)\b/i,
    outcome: 'Every inbound request becomes a tracked, owned work item',
    friction: ['Duplicate entries', 'Missing required fields', 'No clear owner after capture'],
    steps: ['Capture the request in one place', 'Validate required fields', 'Assign owner and SLA', 'Ack the requester', 'Hand off to the delivery queue with a link'],
    next: ['List the fields you already collect', 'Name who should own a new item in the first hour'],
  },
  {
    id: 'report',
    re: /\b(?:report|dashboard|metrics?|kpi|weekly\s+summary|status\s+update)\b/i,
    outcome: 'A repeatable status view that updates without copy-paste',
    friction: ['Data in multiple tools', 'Manual screenshots', 'No single definition of done'],
    steps: ['Pick the three numbers that matter', 'Connect each to one source', 'Schedule the refresh', 'Publish to the people who act on it', 'Flag when a number is stale or missing'],
    next: ['Write the three numbers and their sources', 'Decide the audience and cadence'],
  },
  {
    id: 'sync',
    re: /\b(?:sync|connect|integrat|zap|make\.com|n8n|between|two\s+tools|crm|spreadsheet)\b/i,
    outcome: 'Two systems stay aligned without double entry',
    friction: ['Conflicting updates', 'Missing IDs', 'Silent failures'],
    steps: ['Choose the source of truth per field', 'Map fields and IDs', 'Define create vs update rules', 'Log failures and retry', 'Add a daily drift check'],
    next: ['Name both tools and the fields that must match', 'Say which side wins on conflict'],
  },
  {
    id: 'notify',
    re: /\b(?:notif|alert|slack|email\s+when|ping|warn)\b/i,
    outcome: 'The right person hears about the right event once',
    friction: ['Noise', 'Wrong channel', 'No link back to the work'],
    steps: ['Define the event', 'Filter to actionable cases only', 'Route by owner or team', 'Include a deep link', 'Throttle repeats'],
    next: ['Write the event in one sentence', 'Name the channel and who should get it'],
  },
  {
    id: 'generic',
    re: /./,
    outcome: 'A clear path from idea to a running system someone can own',
    friction: ['Vague success criteria', 'Hidden manual steps', 'No owner after build'],
    steps: ['State the outcome in one line', 'List tools and people in the loop today', 'Mark each manual step to keep, automate, or drop', 'Design the happy path end to end', 'Add monitoring and a human fallback'],
    next: ['Rewrite the idea as "when X, the system does Y so that Z"', 'List the tools already in use'],
  },
];

/** Shape id for an idea string. Pure. */
export function shapeOf(idea) {
  const s = String(idea || '');
  for (const sh of SHAPES) if (sh.id !== 'generic' && sh.re.test(s)) return sh.id;
  return 'generic';
}

/** Full blueprint object for an idea. Pure. */
export function blueprintOf(idea) {
  const raw = String(idea || '').trim();
  if (raw.length < 8) return null;
  const id = shapeOf(raw);
  const sh = SHAPES.find((x) => x.id === id) || SHAPES[SHAPES.length - 1];
  return {
    idea: raw.slice(0, 280),
    shape: sh.id,
    outcome: sh.outcome,
    friction: sh.friction.slice(),
    steps: sh.steps.slice(),
    next: sh.next.slice(),
    questions: [
      'What does done look like in one sentence?',
      'What breaks if this stays manual for another month?',
      'Who is on the hook when the automation fails?',
    ],
  };
}

function run(text, api) {
  const idea = ideaOf(text);
  if (!idea) return 'none';
  const bp = blueprintOf(idea);
  if (!bp) return 'none';
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML =
      '<h2>' + esc('System blueprint') + '</h2>'
      + '<p style="opacity:.85"><b>Idea:</b> ' + esc(bp.idea) + '</p>'
      + '<p><b>Outcome:</b> ' + esc(bp.outcome) + '</p>'
      + '<p><b>Likely friction</b></p><ol>' + bp.friction.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ol>'
      + '<p><b>Build order</b></p><ol>' + bp.steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>'
      + '<p><b>Next actions</b></p><ol>' + bp.next.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>'
      + '<p><b>Open questions</b></p><ol>' + bp.questions.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>'
      + '<p class="bp-build" data-state="checking"><b>Build:</b> <span>checking…</span></p>'
      + '<div class="src">Local plan · shape ' + esc(bp.shape) + ' · as of 2026-11</div>';
    buildLine(el, bp.idea);
  });
  return 'system-blueprint';
}

/** the card's build line from /api/blueprint's answer: its words as text, and a link only to a page on Verse itself. Pure but for el. */
export function showBuild(line, s) {
  if (!line) return;
  const span = line.querySelector('span');
  if (!s || !s.line) { line.dataset.state = 'unknown'; span.textContent = 'its state did not load just now'; return; }
  line.dataset.state = String(s.state || '');
  span.textContent = s.line;
  if (s.page && /^\/[a-z0-9][\w\/?=&.-]*$/i.test(s.page)) { const a = document.createElement('a'); a.href = s.page; a.textContent = ' open it'; span.append(' ·', a); }
}
// Every blueprint starts its own build (owner, 2026-11-06: "the blueprints should just automatically be started and built into verse
// somewhere"): opening the card asks /api/blueprint to start it, which it does only for an idea Verse learned itself, and the line says
// what is real (queued, building, live with its page, or a plan). One look when the card opens, one more a minute later while it is open.
function buildLine(el, idea) {
  const line = el.querySelector('.bp-build');
  if (!line || typeof fetch !== 'function') return;
  const ask = (method) => fetch('/api/blueprint' + (method === 'GET' ? '?idea=' + encodeURIComponent(idea) : ''), method === 'GET' ? { cache: 'no-store' } : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea }) })
    .then((r) => r.json()).then((s) => showBuild(line, s)).catch(() => showBuild(line, null));
  ask('POST');
  setTimeout(() => { if (line.isConnected) ask('GET'); }, 60000);
}

export default {
  name: 'system-blueprint',
  examples: [
    'blueprint this: late invoice follow-ups for clients',
    'turn this into a system: new lead intake from the website form',
    'idea to system: sync closed deals from CRM to the finance sheet',
    'map this idea: slack alert when a support ticket sits over 24 hours',
    'system blueprint for weekly ops metrics without copy-paste',
    'system plan for: automate client onboarding',
    'sketch the system for: automate invoices',
    'system design for the client portal',
  ],
  nearMisses: [
    'what is a blueprint',
    'blueprint of the human body',
    'idea certificate',
    'keep this idea',
    'plan my day',
  ],
  match(lower, text) { return !!ideaOf(text || lower); },
  run,
};
