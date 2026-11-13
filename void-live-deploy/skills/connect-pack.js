/**
 * connect-pack skill — given a business process, list the existing tools to reuse first
 * so Verse owns the connections and the client does less new building.
 * Checks void.existing-tools.md pattern: prefer platform tools, Verse confirm line, etc.
 * "connect pack for client onboarding", "what existing tools for invoice reminders",
 * "reuse tools for the support router"
 */
export function isConnectPack(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:connect|reuse|existing)\s+(?:pack|tools|map)\b/i.test(t)
    || /^what\s+(?:existing|platform)\s+tools\s+(?:for|to)\b/i.test(t)
    || /^prefer\s+existing\s+tools\s+for\b/i.test(t);
}

/** the process named after for/of/to, not a "map" or "to" sitting inside another word. */
export function extractProcess(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const m = t.match(/\b(?:for|of|to|:)\s+(?:the\s+|my\s+|a\s+)?(.+)/i);
  const s = m ? m[1].trim().replace(/[?!.]+$/, '') : '';
  return s.length >= 3 ? s.slice(0, 160) : 'the described process';
}

function mentions(process, re) {
  return re.test(String(process || '').toLowerCase());
}

export function suggestConnections(process) {
  const tools = [];
  if (mentions(process, /\b(?:emails?|inbox|messages?|customers?|support|tickets?)\b/)) {
    tools.push('Verse confirm line for any send or reply');
    tools.push('existing mail handoff (rides skill) for drafts');
  }
  if (mentions(process, /\b(?:invoices?|bills?|billing|payments?|reminders?|schedules?|scheduled)\b/)) {
    tools.push('scheduled tasks already in the platform');
    tools.push('Verse confirm line before any spend or send');
  }
  if (mentions(process, /\b(?:onboarding|onboard|signups?|clients?|welcome|forms?)\b/)) {
    tools.push('existing form and list tools on the stage');
    tools.push('notebook or notepad for the checklist');
  }
  if (mentions(process, /\b(?:reports?|status|updates?|dashboards?|monitors?|monitoring)\b/)) {
    tools.push('system-status and monitor-pack cards');
    tools.push('growth ledger and incident log for history');
  }
  if (tools.length === 0) {
    tools.push('check domains/void.existing-tools.md before inventing');
    tools.push('Verse confirm line for any external action');
    tools.push('stage cards the client already knows');
  }
  return [...new Set(tools)];
}

/** card markup. Every piece that came from the ask goes through esc. */
export function cardHtml(subject, tools, esc) {
  const e = typeof esc === 'function' ? esc : (v) => String(v == null ? '' : v);
  const list = (tools || []).map((t) => '<li>' + e(t) + '</li>').join('');
  return '<h2>Connect pack: ' + e(subject) + '</h2>'
    + '<p class="sub">Use what already exists. Verse owns the connections so the client builds less.</p>'
    + '<h3>Existing tools to reuse first</h3><ul>' + list + '</ul>'
    + '<h3>What Verse owns</h3><ul>'
    + '<li>The wiring between them (confirm-line approvals, status cards)</li>'
    + '<li>The tests that prove the connections stay green</li>'
    + '<li>The handoff docs that name what is reused vs newly built</li>'
    + '</ul>'
    + '<p>Client work stays on the outcome.</p>'
    + '<div class="src">Source: A-to-Mind delivery practice · existing tools checked first</div>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const subject = extractProcess(text);
  const tools = suggestConnections(subject);
  showPage((el) => { el.innerHTML = cardHtml(subject, tools, esc); });
  return 'connect-pack';
}

export default {
  name: 'connect-pack',
  examples: [
    'connect pack for client onboarding',
    'what existing tools for invoice reminders',
    'reuse tools for the support ticket router',
    'prefer existing tools for weekly status reports'
  ],
  nearMisses: ['connect the dots', 'pack a suitcase', 'existing inventory'],
  match(lower, text) { return isConnectPack(text || lower); },
  run,
  suite() {
    const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const nasty = 'client <script>alert(1)</script> onboarding';
    const html = cardHtml(nasty, suggestConnections(nasty), esc);
    const checks = [
      ['onboarding', isConnectPack('connect pack for client onboarding')],
      ['invoice', isConnectPack('what existing tools for invoice reminders')],
      ['router', isConnectPack('reuse tools for the support ticket router')],
      ['reports', isConnectPack('prefer existing tools for weekly status reports')],
      ['dots', !isConnectPack('connect the dots')],
      ['suitcase', !isConnectPack('pack a suitcase')],
      ['inventory', !isConnectPack('existing inventory')],
      ['map word', extractProcess('reuse map for the support ticket router') === 'support ticket router'],
      ['to inside customer', extractProcess('connect pack for customer onboarding') === 'customer onboarding'],
      ['of not map', extractProcess('existing map of weekly reports') === 'weekly reports'],
      ['tools to', extractProcess('connect tools to bill customers') === 'bill customers'],
      ['question', extractProcess('what existing tools for invoice reminders?') === 'invoice reminders'],
      ['bare', extractProcess('connect pack') === 'the described process'],
      ['platform', !suggestConnections('platform migration').some((t) => t.includes('form and list'))],
      ['status card', suggestConnections('weekly status reports').some((t) => t.includes('monitor-pack'))],
      ['escaped', html.includes('&lt;script&gt;') && !html.includes('<script')]
    ];
    const bad = checks.filter((c) => !c[1]).map((c) => c[0]);
    return { ok: bad.length === 0, got: bad.length ? bad.join(', ') : 'match works' };
  }
};
