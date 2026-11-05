/**
 * system-blueprint skill — map an inbound business idea into a structured system plan
 * (A-to-Mind: facilitate ideas and take over the heavy lifting).
 * "blueprint this: late invoice follow-ups" / "turn this into a system: ..." / "idea to system: ..."
 * becomes a card: outcome, likely friction, ordered build steps, next actions, open questions.
 * No model call; the planner is fixed templates by idea shape so the same sentence always
 * yields the same structure. Nothing is sent. Empty surface stays empty until someone asks.
 */

const LEAD = String.raw`(?:(?:please\s+)?(?:blueprint|map|structure|scope)\s+(?:this|that|my|the)?\s*(?:idea|system|workflow|process|automation)?\s*[:\-]?\s*|turn\s+(?:this|that|it)\s+into\s+a\s+system\s*[:\-]?\s*|idea\s+to\s+system\s*[:\-]?\s*|(?:make|build|design)\s+(?:me\s+)?(?:a\s+)?(?:system\s+)?blueprint\s+(?:for|of)\s+)`;
const ASK_RE = new RegExp('^' + LEAD + '(.{8,280})$', 'i');

/** Strip lead-in; return the raw idea text or null. Pure. */
export function ideaOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = ASK_RE.exec(t);
  if (!m) return null;
  const idea = m[1].replace(/^(?:to\s+|for\s+)/i, '').trim();
  return idea.length >= 8 ? idea : null;
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
      + '<div class="src">Local plan · shape ' + esc(bp.shape) + ' · nothing sent · as of 2026-11</div>';
  });
  return 'system-blueprint';
}

export default {
  name: 'system-blueprint',
  examples: [
    'blueprint this: late invoice follow-ups for clients',
    'turn this into a system: new lead intake from the website form',
    'idea to system: sync closed deals from CRM to the finance sheet',
    'map this idea: slack alert when a support ticket sits over 24 hours',
    'system blueprint for weekly ops metrics without copy-paste',
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
