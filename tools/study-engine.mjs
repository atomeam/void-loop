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
  const analyses = (scripts || []).map((s) => { const a = analyzeScript(s.text, s.name); a.findings.push(...rpcOf(s.text, s.name)); return a; });
  return { ...meta, modules: analyses.map((a) => a.script), ranked: rankFindings(analyses), unknowns: unknownsOf(analyses), trace: meta.word ? traceFeature(scripts, meta.word) : [],
    minified: analyses.filter((a) => a.minified).length, sourceMaps: analyses.filter((a) => a.sourceMap).length };
}

// ---- source maps (own decoder of the public Source Map v3 format: base64 VLQ "mappings") ----
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** one VLQ segment string -> numbers. Pure. */
export function vlq(seg) {
  const out = []; let v = 0, shift = 0;
  for (const ch of seg) {
    const d = B64.indexOf(ch); if (d < 0) return null;
    v += (d & 31) << shift;
    if (d & 32) { shift += 5; continue; }
    out.push(v & 1 ? -(v >>> 1) : v >>> 1); v = 0; shift = 0;
  }
  return shift ? null : out;
}
/** a parsed source map -> lines of [genCol, srcIdx, srcLine, srcCol, nameIdx?] (all 0-based). Pure; null when not v3. */
export function decodeSourceMap(map) {
  const m = typeof map === 'string' ? (() => { try { return JSON.parse(map); } catch (_) { return null; } })() : map;
  if (!m || m.version !== 3 || typeof m.mappings !== 'string') return null;
  const lines = []; let src = 0, sl = 0, sc = 0, nm = 0;
  for (const l of m.mappings.split(';')) {
    let gc = 0; const segs = [];
    for (const s of l.split(',')) {
      if (!s) continue; const n = vlq(s); if (!n) return null;
      gc += n[0];
      if (n.length >= 4) { src += n[1]; sl += n[2]; sc += n[3]; const seg = [gc, src, sl, sc]; if (n.length >= 5) { nm += n[4]; seg.push(nm); } segs.push(seg); } else segs.push([gc]);
    }
    lines.push(segs);
  }
  return { sources: (m.sources || []).map((s) => (m.sourceRoot || '') + s), names: m.names || [], lines, hasContent: Array.isArray(m.sourcesContent) && m.sourcesContent.some(Boolean) };
}
/** generated 1-based line and 0-based column -> the original source, line (1-based), column and name. Pure. */
export function originalPosition(decoded, line, column = 0) {
  const segs = decoded && decoded.lines[line - 1]; if (!segs) return null;
  let best = null; for (const s of segs) { if (s[0] > column) break; if (s.length >= 4) best = s; }
  if (!best) return null;
  return { source: decoded.sources[best[1]] || '', line: best[2] + 1, column: best[3], name: best.length > 4 ? decoded.names[best[4]] || '' : '' };
}

// ---- readable un-minify (own formatter: strings, template literals, comments and regex literals kept intact) ----
/** minified JavaScript -> indented lines, plus short names restored where a source map names them. Pure. */
export function readable(js, { indent = '  ', names = null } = {}) {
  const t = String(js || ''); let out = '', depth = 0, i = 0, paren = 0, prev = '';
  const nl = () => { out = out.replace(/[ \t]+$/, ''); out += '\n' + indent.repeat(Math.max(0, depth)); };
  while (i < t.length) {
    const c = t[i];
    if (c === '"' || c === "'" || c === '`') { let j = i + 1; while (j < t.length && t[j] !== c) j += t[j] === '\\' ? 2 : 1; out += t.slice(i, j + 1); i = j + 1; prev = c; continue; }
    if (c === '/' && t[i + 1] === '/') { const j = t.indexOf('\n', i); const e = j < 0 ? t.length : j; out += t.slice(i, e); i = e; continue; }
    if (c === '/' && t[i + 1] === '*') { const j = t.indexOf('*/', i + 2); const e = j < 0 ? t.length : j + 2; out += t.slice(i, e); i = e; continue; }
    if (c === '/' && /[=(,:;!&|?{}[\n]|^$/.test(prev || '')) { let j = i + 1, cls = false; while (j < t.length && (t[j] !== '/' || cls)) { if (t[j] === '\\') j++; else if (t[j] === '[') cls = true; else if (t[j] === ']') cls = false; j++; } out += t.slice(i, j + 1); i = j + 1; prev = 'r'; continue; }
    if (c === '\n' || c === '\r') { i++; continue; }
    if (c === '(') paren++; if (c === ')') paren--;
    if (c === '{') { out += ' {'; depth++; nl(); }
    else if (c === '}') { depth--; nl(); out += '}'; if (t[i + 1] && !/[;,)\]]/.test(t[i + 1])) nl(); }
    else if (c === ';' && paren <= 0) { out += ';'; if (t[i + 1] !== '}') nl(); }
    else out += c;
    if (!/\s/.test(c)) prev = c; i++;
  }
  let s = out.replace(/\n\s*\n/g, '\n').replace(/^ /, '').trim() + '\n';
  if (names) for (const [short, long] of Object.entries(names)) if (/^[A-Za-z_$][\w$]{0,2}$/.test(short) && /^[A-Za-z_$][\w$]*$/.test(long)) s = s.replace(new RegExp('(?<![\\w$.\'"`])' + short.replace(/\$/g, '\\$') + '(?![\\w$])', 'g'), long);
  return s;
}

// ---- RPC endpoints: tRPC, JSON-RPC, gRPC-web (own patterns) ----
const RPC = [
  ['rpc:trpc', /(['"`])(\/(?:api\/)?trpc\/[\w.,\-]+)\1/g, 0.8],
  ['rpc:json-rpc', /jsonrpc\s*:\s*['"]2\.0['"][^}]{0,120}?method\s*:\s*(['"])([\w.\-/]{1,80})\1/g, 0.8],
  ['rpc:json-rpc', /method\s*:\s*(['"])([\w.\-/]{1,80})\1[^}]{0,120}?jsonrpc\s*:\s*['"]2\.0['"]/g, 0.8],
  ['rpc:grpc-web', /(['"`])(\/[a-z][\w]*(?:\.[\w]+)+\/[A-Z]\w+)\1/g, 0.75],
];
/** RPC calls in one script, with line evidence. Pure. */
export function rpcOf(text, name = 'script') {
  const t = String(text || ''), out = [];
  for (const [mechanism, re, strength] of RPC) { re.lastIndex = 0; for (let m; (m = re.exec(t));) out.push({ kind: 'rpc', value: m[2], mechanism, strength, built: false, script: name, line: LINE(t, m.index) }); }
  return out;
}

// ---- feature trace from a starting word ----
/** scripts + a word from the question -> where the feature lives: each hit's line, the function around it, and the calls near it. Pure. */
export function traceFeature(scripts, word, { near = 12 } = {}) {
  const w = String(word || '').trim(); if (w.length < 3) return [];
  const re = new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), hits = [];
  for (const s of scripts || []) {
    const lines = String(s.text || '').split('\n');
    const calls = [...analyzeScript(s.text, s.name).findings, ...rpcOf(s.text, s.name)];
    lines.forEach((l, i) => {
      if (!re.test(l)) return;
      let fn = ''; for (let k = i; k >= Math.max(0, i - 60) && !fn; k--) { const m = /(?:function\s+([\w$]+)|([\w$]+)\s*[:=]\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[\w$]+\s*=>))/.exec(lines[k]); if (m) fn = m[1] || m[2]; }
      const nearCalls = calls.filter((f) => Math.abs(f.line - (i + 1)) <= near).map((f) => f.value + ' (' + f.mechanism + ', line ' + f.line + ')');
      hits.push({ script: s.name, line: i + 1, fn, nearCalls, score: (nearCalls.length ? 2 : 1) + (fn ? 1 : 0) - (/locale|i18n|lang|translation/i.test(s.name) ? 2 : 0) });
    });
  }
  return hits.sort((a, b) => b.score - a.score || a.line - b.line).slice(0, 40);
}

// ---- visual compare (own, over raw RGBA pixels of two same-size captures) ----
/** {width,height,data} x2 -> share of changed pixels and the box around the change. Pure. */
export function visualDiff(a, b, threshold = 0) {
  if (!a || !b || a.width !== b.width || a.height !== b.height) return { comparable: false };
  let changed = 0, x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let p = 0, n = a.width * a.height; p < n; p++) {
    const o = p * 4; let d = 0; for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a.data[o + c] - b.data[o + c]));
    if (d > threshold) { changed++; const x = p % a.width, y = (p / a.width) | 0; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  }
  return { comparable: true, changed, share: Math.round(changed / Math.max(1, a.width * a.height) * 10000) / 10000, box: changed ? { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null };
}

// ---- the build loop: a finished study raises its skill's pick ----
/** finished studies -> {skill: boost}: strong evidence makes a parity want go first (1 to 1.5). Pure. */
export function studyBoosts(studies) {
  const out = {};
  for (const s of studies || []) { if (!s || !s.skill) continue; const strong = (s.ranked || []).filter((f) => f.confidence === 'exact' || f.confidence === 'high').length; out[s.skill] = Math.max(out[s.skill] || 1, 1 + Math.min(0.5, strong * 0.1)); }
  return out;
}
