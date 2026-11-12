/**
 * reuse-pack skill — map a business process or idea to existing tools that already cover parts of it
 * instead of inventing new ones. Checks void.existing-tools.md first so the client can reuse what is already there.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "reuse pack for client onboarding", "map to existing tools: invoice reminders", "what can we reuse for support tickets"
 */
export function isReusePack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:reuse|existing[- ]tools?)\s+(?:pack|map)\b/i.test(t)
    || /^(?:map|show)\s+(?:to\s+)?(?:existing\s+)?tools?\b/i.test(t)
    || /^what\s+(?:(?:tools?|connectors?)\s+)?(?:can|could|should)\s+we\s+reuse\b/i.test(t)
    || /^(?:reuse|use)\s+existing\s+(?:tools?|connectors?)\s+for\b/i.test(t);
}

function extractProcess(text) {
  const t = String(text || '');
  const m = t.match(/(?:for|:|on)\s+(.+)/i) || t.match(/\b(?:idea|process|system)\s*[:\-]\s*(.+)/i);
  return m ? m[1].trim() : 'the described process';
}

export function suggestReuse(process) {
  const t = process.toLowerCase();
  const hits = [];
  if (/email|inbox|message|customer|support|ticket/.test(t)) {
    hits.push({ tool: 'Verse\'s confirm line (void_approvals)', why: 'approvals before any send or action' });
    hits.push({ tool: 'Workers AI model catalog', why: 'routing and triage without new hosting' });
  }
  if (/invoice|bill|payment|remind|schedule/.test(t)) {
    hits.push({ tool: 'Gumroad\'s Agent tab', why: 'store and payment tooling already available' });
    hits.push({ tool: 'Cloudflare edge cache + Pages middleware', why: 'rate limits and guards for payment flows' });
  }
  if (/onboard|signup|client|welcome|setup/.test(t)) {
    hits.push({ tool: 'Verse\'s confirm line', why: 'client yes before any send or book' });
    hits.push({ tool: 'MCP Skills extension', why: 'package onboarding steps as discoverable skills' });
  }
  if (/code|review|security|scan|audit/.test(t)) {
    hits.push({ tool: 'Snyk connector / Semgrep + gitleaks', why: 'security scans without inventing a new auditor' });
    hits.push({ tool: 'npm audit', why: 'dependency checks already in the deploy path' });
  }
  if (/schedule|recurring|daily|automation|watch/.test(t)) {
    hits.push({ tool: 'ChatGPT Work scheduled tasks / Hermes Agent', why: 'recurring jobs and skill-growing loops' });
    hits.push({ tool: 'Verse automations + approve card', why: 'tasks that keep running after you leave' });
  }
  if (!hits.length) {
    hits.push({ tool: 'Workers AI + Cloudflare edge', why: 'any model or API call stays at the edge' });
    hits.push({ tool: 'Verse\'s existing skills (calc, convert, notes, etc.)', why: 'compose what is already on the stage' });
  }
  return hits;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const process = extractProcess(text);
  const el = showPage((p) => { p.innerHTML = '<h2>Reuse pack</h2><div class="sub">checking existing tools…</div>'; });
  const hits = suggestReuse(process);
  const list = hits.map(h => `<li><strong>${esc(h.tool)}</strong> — ${esc(h.why)}</li>`).join('');
  const pack = [
    `<h2>Reuse pack: ${esc(process)}</h2>`,
    `<p><strong>Use what already exists before building.</strong> Existing processes mapped to tools that already handle them.</p>`,
    `<h3>Existing tools that cover parts</h3><ul>${list}</ul>`,
    `<h3>What's handled</h3><ul>`,
    `<li>Connecting and monitoring the chosen tools</li>`,
    `<li>The confirm line and ledger for any action</li>`,
    `<li>Status and handoff so the client sees the outcome</li>`,
    `</ul>`,
    `<p class="sub">A map of current processes to tools that already handle them. The client keeps the outcome.</p>`,
    `<div class="src">Source: domains/void.existing-tools.md</div>`
  ].join('');
  el.innerHTML = pack;
  return 'reuse-pack';
}

export default {
  name: 'reuse-pack',
  examples: [
    'reuse pack for client onboarding',
    'map to existing tools: invoice reminders',
    'what can we reuse for support tickets',
    'use existing tools for the email triage system'
  ],
  nearMisses: ['what is reuse', 'pack the bags', 'existing code'],
  match(lower, text) { return isReusePack(text || lower); },
  run,
  suite() {
    const ok = isReusePack('reuse pack for client onboarding')
      && isReusePack('map to existing tools: invoice reminders')
      && isReusePack('what can we reuse for support tickets')
      && isReusePack('use existing tools for the email triage system')
      && !isReusePack('what is reuse')
      && !isReusePack('pack the bags')
      && !isReusePack('existing code');
    return { ok, got: 'match works' };
  }
};
