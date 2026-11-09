/**
 * client-intake skill — capture a business idea and show the systems Verse already serves that match it, plus the idea's real build state.
 * "intake this idea: …", "client intake for …", "capture and own …"
 * The card reads GET /tools.json and GET /api/blueprint. It does not invent a system, a status or a plan. Nothing is sent.
 */
const STOP = new Set(['this', 'that', 'with', 'from', 'your', 'have', 'into', 'over', 'than', 'them', 'they', 'will', 'what', 'when', 'where', 'which', 'while', 'about', 'after', 'before', 'under', 'again', 'there', 'their', 'these', 'those', 'idea', 'ideas', 'business', 'process', 'client', 'clients', 'system', 'systems', 'verse']);

export function isClientIntake(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  if (!t) return false;
  return /^(?:client\s+)?intake\s+(?:this|my|the)\s+(?:idea|business|process|ask)\b/i.test(t)
    || /^(?:client\s+)?intake\s+(?:for|of|on)\b/i.test(t)
    || /^capture\s+and\s+own\b/i.test(t);
}

/** the idea the ask names, or the ask itself. Pure. */
export function ideaOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  const m = t.match(/(?:idea|business|process|ask)\s*[:\-]\s*(.+)/i)
    || t.match(/\b(?:for|of|on)\s+(?:my\s+|the\s+|a\s+)?(.+)/i)
    || t.match(/^capture\s+and\s+own\s+(?:the\s+)?(.+)/i);
  return (m ? m[1] : t).trim().slice(0, 280);
}

/** words long enough to look up in the catalog. Pure. */
export function wordsOf(idea) {
  const seen = new Set();
  const out = [];
  for (const w of String(idea || '').toLowerCase().match(/[a-z0-9]{4,}/g) || []) {
    if (STOP.has(w) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
  }
  return out;
}

function hitsOf(tool, words) {
  const hay = [tool.name, tool.description, ...(Array.isArray(tool.examples) ? tool.examples : [])].join('\n').toLowerCase();
  return words.filter((w) => new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(hay));
}

/** tools from a /tools.json body, minus this skill. Pure. */
export function catalogOf(body) {
  const list = body && Array.isArray(body.tools) ? body.tools : [];
  return list.filter((t) => t && typeof t.name === 'string' && t.name && t.name !== 'client-intake');
}

/** the build line /api/blueprint returned, or null when it did not. Pure. */
export function buildOf(body) {
  if (!body || typeof body !== 'object' || body.error || !body.line) return null;
  return {
    state: String(body.state || ''),
    line: String(body.line),
    page: typeof body.page === 'string' ? body.page : '',
    pr: body.pr == null ? '' : String(body.pr),
  };
}

/**
 * what the card may say. covered names only tools that were in the catalog and share a word with the idea.
 * A missing source stays an error. Nothing is filled in. Pure.
 */
export function intakeOf({ idea, toolsBody, toolsError, buildBody, buildError }) {
  const words = wordsOf(idea);
  const catalog = catalogOf(toolsBody);
  const ranked = toolsError ? [] : catalog.map((t) => ({
    name: t.name,
    description: typeof t.description === 'string' ? t.description : '',
    hits: hitsOf(t, words),
  })).filter((t) => t.hits.length).sort((a, b) => b.hits.length - a.hits.length || a.name.localeCompare(b.name));
  return {
    idea: String(idea || ''),
    words,
    covered: ranked.slice(0, 8),
    matchCount: ranked.length,
    catalogCount: catalog.length,
    toolsError: toolsError ? String(toolsError) : '',
    build: buildOf(buildBody),
    buildError: buildError ? String(buildError) : '',
  };
}

export function intakeHtml(esc, view) {
  const e = (s) => esc(s == null ? '' : s);
  let covered;
  if (view.toolsError) covered = '<p>' + e(view.toolsError) + '</p>';
  else if (!view.words.length) covered = '<p>This idea has no word long enough to match against the catalog.</p>';
  else if (!view.covered.length) covered = '<p>No tool in the catalog shares a word with this idea (' + e(String(view.catalogCount)) + ' tools read).</p>';
  else {
    covered = '<ul>' + view.covered.map((t) => '<li><b>' + e(t.name) + '</b>' + (t.description ? ': ' + e(t.description) : '') + '</li>').join('') + '</ul>';
    if (view.matchCount > view.covered.length) covered += '<p>' + e(String(view.covered.length)) + ' of ' + e(String(view.matchCount)) + ' matching tools.</p>';
  }
  const build = view.buildError
    ? '<p>' + e(view.buildError) + '</p>'
    : view.build
      ? '<p><b>' + e(view.build.state) + '</b>: ' + e(view.build.line) + (view.build.pr ? ' (#' + e(view.build.pr) + ')' : '') + (view.build.page ? ' · ' + e(view.build.page) : '') + '</p>'
      : '<p>No build state came back.</p>';
  return '<h2>Client intake: ' + e(view.idea || 'unnamed idea') + '</h2>'
    + '<h3>Systems Verse already has</h3>' + covered
    + '<div class="src">Source: GET /tools.json</div>'
    + '<h3>Build state</h3>' + build
    + '<div class="src">Source: GET /api/blueprint</div>'
    + '<p class="sub">Nothing on this card is invented. A source that did not answer is named, and no system is filled in for it.</p>';
}

async function readJson(url, fetchFn) {
  try {
    const r = await fetchFn(url, { cache: 'no-store' });
    if (!r || !r.ok) return { error: 'answered HTTP ' + ((r && r.status) || 0) };
    return { body: await r.json() };
  } catch (_) {
    return { error: 'did not answer' };
  }
}

async function run(text, api) {
  const fallback = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const esc = typeof api.esc === 'function' ? api.esc : fallback;
  const idea = ideaOf(text);
  const el = api.showPage((p) => { p.innerHTML = '<h2>Client intake</h2><div class="sub">reading /tools.json and /api/blueprint…</div>'; });
  const fetchFn = typeof api.fetch === 'function' ? api.fetch : ((u, o) => fetch(u, o));
  const [tools, build] = await Promise.all([
    readJson('/tools.json', fetchFn),
    readJson('/api/blueprint?idea=' + encodeURIComponent(idea), fetchFn),
  ]);
  el.innerHTML = intakeHtml(esc, intakeOf({
    idea,
    toolsBody: tools.body,
    toolsError: tools.error ? 'the tool catalog ' + tools.error : '',
    buildBody: build.body,
    buildError: build.error ? 'the build state ' + build.error : '',
  }));
  return 'client-intake';
}

export default {
  name: 'client-intake',
  examples: [
    'intake this idea: automate client onboarding',
    'client intake for invoice reminders',
    'intake for the support ticket router',
    'capture and own the lead qualification process',
  ],
  nearMisses: [
    'what is intake',
    'intake form',
    'clarify the weather',
    'clarify this business idea: a tool that turns customer emails into running automations',
    'package this idea: automate client onboarding',
    'ownership map for client onboarding',
    'system handoff for the onboarding automation',
    'status pack for onboarding',
  ],
  match(lower, text) { return isClientIntake(text || lower); },
  run,
};
