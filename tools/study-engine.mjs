// Verse's own study engine: what Verse adds on top of REA (tools/rea-study.mjs wraps REA's passive web capture; this file is
// Verse's own code, no REA code copied). Every function is pure and reads only script text a visitor's browser already loaded.
// Nothing here runs the studied code, calls an endpoint it finds, logs in or submits anything. See docs/REA-GAPS.md.
//   analyzeScript   static read of one script: endpoints (fetch, XHR, axios-style, WebSocket, EventSource, sendBeacon, GraphQL
//                   operations), source-map pointer, minified or not, each finding with its line and a mechanism strength
//   rankFindings    evidence strength: direct calls beat string guesses; more lines and more scripts raise it; tiers exact/high/medium/low
//   unknownsOf      what this read could not tell, said plainly (built strings, minified code without a map, no scripts)
//   cacheFresh      the study cache: the same page and question are not studied again inside the freshness window
//   diffStudies     what changed between two studies of the same page (new and gone endpoints, modules, tools)
//   combineStudies  several sites' approaches side by side: what most of them do first, what only one does
//   relatedStudies  skill-library retrieval: earlier studies closest to a new question
//   buildBrief      a want for the build loop from a study, with no studied URL, host or question in it (the repo is public)

const LINE = (text, idx) => { let n = 1; for (let i = 0; i < idx && i < text.length; i++) if (text.charCodeAt(i) === 10) n++; return n; };
const strArg = '\\s*\\(\\s*([\'"`])((?:(?!\\1)[^\\\\\\n]|\\\\.){1,300})\\1';
// strength: a direct call with a literal URL is the strongest evidence; a bare URL-looking string is the weakest
export const MECHANISMS = [
  ['call:fetch', new RegExp('\\bfetch' + strArg, 'g'), 0.9],
  ['call:xhr', new RegExp('\\.open\\s*\\(\\s*[\'"](?:GET|POST|PUT|PATCH|DELETE)[\'"]\\s*,\\s*([\'"`])((?:(?!\\1)[^\\\\\\n]|\\\\.){1,300})\\1', 'g'), 0.85],
  ['call:http-client', new RegExp('\\b(?:axios|http|api|client|\\$http|ky)\\.(?:get|post|put|patch|delete|request)' + strArg, 'g'), 0.75],
  ['call:websocket', new RegExp('\\bnew\\s+WebSocket' + strArg, 'g'), 0.9],
  ['call:eventsource', new RegExp('\\bnew\\s+EventSource' + strArg, 'g'), 0.9],
  ['call:beacon', new RegExp('\\bsendBeacon' + strArg, 'g'), 0.8],
  ['string:path', /(['"`])(\/(?:api|v\d|graphql|rpc|ws|auth|search|upload)[\w\-./{}:]*)\1/g, 0.35],
];
const GQL = /\b(query|mutation|subscription)\s+([A-Z_a-z]\w{1,80})\s*[({]/g;

/** one script's text -> findings with line evidence. Pure. */
export function analyzeScript(text, name = 'script') {
  const t = String(text || '');
  const findings = [];
  for (const [mechanism, re, strength] of MECHANISMS) {
    re.lastIndex = 0;
    for (let m; (m = re.exec(t));) {
      const value = m[2];
      const built = /\$\{|^\s*$/.test(value) || m[1] === '`' && value.includes('${');
      findings.push({ kind: 'endpoint', value: value.replace(/\$\{[^}]*\}/g, '{…}'), mechanism, strength: built ? strength * 0.6 : strength, built, script: name, line: LINE(t, m.index) });
    }
  }
  GQL.lastIndex = 0;
  for (let m; (m = GQL.exec(t));) findings.push({ kind: 'graphql', value: m[1] + ' ' + m[2], mechanism: 'graphql:operation', strength: 0.7, built: false, script: name, line: LINE(t, m.index) });
  const map = /\/\/[#@]\s*sourceMappingURL=([^\s'"]+)/.exec(t);
  const lines = t.split('\n'), longest = lines.reduce((a, l) => Math.max(a, l.length), 0);
  const minified = t.length > 2000 && (longest > 1000 || t.length / Math.max(1, lines.length) > 300);
  return { script: name, bytes: t.length, minified, sourceMap: map ? map[1].slice(0, 200) : '', findings };
}

const TIERS = [[0.95, 'exact'], [0.75, 'high'], [0.5, 'medium'], [0, 'low']];
/** many scripts' findings -> one ranked list, strongest evidence first. Pure. */
export function rankFindings(analyses) {
  const by = new Map();
  for (const a of analyses || []) for (const f of a.findings || []) {
    const k = f.kind + ' ' + f.value;
    const e = by.get(k) || { kind: f.kind, value: f.value, mechanisms: new Set(), scripts: new Set(), evidence: [], best: 0, built: true };
    e.mechanisms.add(f.mechanism); e.scripts.add(f.script); e.best = Math.max(e.best, f.strength); e.built = e.built && f.built;
    if (e.evidence.length < 5) e.evidence.push(f.script + ':' + f.line);
    e.count = (e.count || 0) + 1; by.set(k, e);
  }
  return [...by.values()].map((e) => {
    // independent sightings raise confidence: 1 - Π(1 - s) over up to 4 sightings, capped by the best mechanism + 0.1
    const n = Math.min(4, e.count), score = Math.min(e.best + 0.1, 1 - Math.pow(1 - e.best, n) + 0.03 * (e.scripts.size - 1));
    const s = Math.round(Math.min(1, score) * 100) / 100;
    return { kind: e.kind, value: e.value, score: s, confidence: TIERS.find(([x]) => s >= x)[1], mechanisms: [...e.mechanisms].sort(), scripts: e.scripts.size, evidence: e.evidence, built: e.built };
  }).sort((a, b) => b.score - a.score || a.value.localeCompare(b.value));
}

/** what the read could not tell. Pure. */
export function unknownsOf(analyses) {
  const a = analyses || [], out = [];
  if (!a.length) out.push('No scripts were captured, so nothing about how it works could be read.');
  const minNoMap = a.filter((x) => x.minified && !x.sourceMap).length;
  if (minNoMap) out.push(minNoMap + ' minified script(s) had no source map, so names are shortened and some calls may be missed.');
  const built = a.reduce((n, x) => n + x.findings.filter((f) => f.built).length, 0);
  if (built) out.push(built + ' address(es) are built at run time; only their fixed parts are known.');
  const quiet = a.filter((x) => x.bytes > 20000 && !x.findings.length).length;
  if (quiet) out.push(quiet + ' large script(s) showed no network calls; their work may be local or the calls may be wrapped.');
  out.push('A static read cannot see server-side logic, what answers come back, or code loaded only after a click.');
  return out;
}

/** the study cache: is a stored study of this page and question still fresh? Pure. */
export function cacheFresh(record, now = Date.now(), days = 14) {
  const at = Date.parse(record && (record.studiedAt || record.at) || '');
  return Number.isFinite(at) && now - at < days * 864e5;
}

const keys = (s) => new Set((s && s.ranked || []).map((f) => f.kind + ' ' + f.value));
/** two studies of the same page -> what changed. Pure. */
export function diffStudies(older, newer) {
  const a = keys(older), b = keys(newer);
  const mods = (s) => new Set((s && s.modules || []));
  const ma = mods(older), mb = mods(newer);
  return {
    added: [...b].filter((k) => !a.has(k)).sort(), gone: [...a].filter((k) => !b.has(k)).sort(),
    modulesAdded: [...mb].filter((k) => !ma.has(k)).sort(), modulesGone: [...ma].filter((k) => !mb.has(k)).sort(),
  };
}

const shape = (v) => String(v).replace(/^https?:\/\/[^/]+/, '').replace(/\{…\}|\b\d+\b|[0-9a-f]{8,}/gi, ':id').replace(/\?.*$/, '').toLowerCase();
/** several sites' studies -> approaches ranked by how many sites use them. Pure. */
export function combineStudies(studies) {
  const by = new Map();
  for (const [i, s] of (studies || []).entries()) for (const f of s.ranked || []) {
    const k = f.kind === 'graphql' ? 'graphql ' + f.value.split(' ')[0] : f.mechanisms[0] + ' ' + shape(f.value);
    const e = by.get(k) || { approach: k, sites: new Set(), score: 0 }; e.sites.add(i); e.score = Math.max(e.score, f.score); by.set(k, e);
  }
  const n = (studies || []).length;
  return [...by.values()].map((e) => ({ approach: e.approach, sites: e.sites.size, of: n, score: e.score, shared: e.sites.size > 1 }))
    .sort((a, b) => b.sites - a.sites || b.score - a.score || a.approach.localeCompare(b.approach));
}

const words = (s) => new Set(String(s || '').toLowerCase().match(/[a-z]{3,}/g) || []);
/** skill-library retrieval: earlier studies closest to a new question (word overlap, Jaccard). Pure. */
export function relatedStudies(question, studies, k = 3) {
  const q = words(question);
  return (studies || []).map((s) => { const w = words(s.question + ' ' + (s.name || '')); let i = 0; for (const x of q) if (w.has(x)) i++; return { s, sim: i / Math.max(1, q.size + w.size - i) }; })
    .filter((x) => x.sim > 0).sort((a, b) => b.sim - a.sim).slice(0, k).map((x) => ({ id: x.s.id, sim: Math.round(x.sim * 100) / 100 }));
}

/** a study -> a want for the build loop, stripped of anything that names what was studied. Pure. */
export function buildBrief(study, feature) {
  const top = (study.ranked || []).filter((f) => f.confidence !== 'low').slice(0, 8);
  const kinds = [...new Set(top.map((f) => f.mechanisms[0].replace(/^\w+:/, '')))];
  const text = 'Build Verse\'s own ' + String(feature || 'feature').slice(0, 80) + ': the best example works through ' + (kinds.join(', ') || 'local code only') +
    ' (' + top.length + ' strong finding(s)); write it from scratch, copy nothing.';
  return { kind: 'want', source: 'study', text: text.replace(/https?:\/\/\S+/g, '[page]'), evidence: top.length, studyId: study.id || '' };
}

/** the whole engine over captured scripts: [{name, text}] -> a study object. Pure. */
export function studyScripts(scripts, meta = {}) {
  const analyses = (scripts || []).map((s) => analyzeScript(s.text, s.name));
  return { ...meta, modules: analyses.map((a) => a.script), ranked: rankFindings(analyses), unknowns: unknownsOf(analyses),
    minified: analyses.filter((a) => a.minified).length, sourceMaps: analyses.filter((a) => a.sourceMap).length };
}
