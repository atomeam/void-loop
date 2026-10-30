// Study how the best do a feature, from the inside, with evidence (frontier: REA; owner, 2026-10-15: "Verse should be able to
// reverse engineer everything, this would speed things up drastically"). Wraps REA (`rea-agents`, MIT) and uses only its passive,
// static web commands: list the page, capture its scripts, map modules, endpoints and WebMCP tools, each finding with its script
// and line. REA never runs the captured code; nothing here logs in, submits, breaks a protection or fetches past what a visitor's
// browser loads. Study, never copying: no code, assets or text are carried over; only Verse's own version of a feature ships.
// What was studied is the owner's: the repo, run logs and summaries are public, so findings go only to Verse's private memory
// (owner-only /api/memory, kind "study") and a run prints counts, never a URL or a finding.
//   node tools/rea-study.mjs --url <https://…> --question "how does it value a coin"   study here, print the digest (a builder's own machine)
//   node tools/rea-study.mjs --ask <https://…> "question"   file a study for the runner (VOID_OWNER_TOKEN); the request is private too
//   node tools/rea-study.mjs --run                        the runner (.github/workflows/rea-study.yml): every pending study, findings to memory
// CHROME_PATH picks the browser (default: Playwright's Chromium); VOID_SITE overrides https://a-to-mind.com.
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rankFindings, studyScripts, decodeSourceMap, originalPosition } from './study-engine.mjs'; // Verse's own evidence ranking, on top of REA's capture

export const REA = 'rea-agents@6.7.0'; // pinned: a new REA version is read before it is used
// the only REA commands this tool runs: passive and static (no debugger, no execution observer, no native or firmware tools)
// 6.7.0 read 2026-10-21: export-web-scripts, trace-web-source-location and compare-web-screenshots work on local files only (no fetch);
// capture-web-screenshot reads the visible viewport of the page already open. None runs the page's code or acts on it.
export const ALLOWED = new Set(['list-browser-targets', 'analyze-web-bundle', 'capture-web-screenshot', 'compare-web-screenshots', 'export-web-scripts', 'trace-web-source-location']);
export const MAX_DIGEST = 30000; // under memory's 32768-character body limit, so a study is never cut by the store

/** a public http(s) page, never this machine or a private network (localOk only for the tool's own test). Pure. */
export function safeUrl(u, localOk = false) {
  let x; try { x = new URL(String(u || '').trim()); } catch (_) { return null; }
  if (!/^https?:$/.test(x.protocol) || x.username || x.password) return null;
  const h = x.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const local = h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '::1' || /^f[cd]/.test(h) || /^fe80:/.test(h);
  if (local && !localOk) return null;
  return x.href;
}

const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };

/** the memory record for a study (pending, or done with its digest). Shaped for lib/memory-core.js cleanRecord. Pure. */
export function studyRecord({ url, question, digest = '', counts = null }) {
  const h = host(url);
  return {
    id: 'study-' + sha(url + '\n' + question).slice(0, 16), kind: 'study', state: '',
    name: ('Study: ' + String(question || 'how it works')).slice(0, 120),
    summary: counts ? 'studied ' + h + ': ' + counts.scripts + ' scripts, ' + counts.endpoints + ' endpoints, ' + counts.modules + ' modules' : 'pending ' + h,
    links: ['study', 'rea', h.replace(/[^a-z0-9.-]/g, '')].filter(Boolean),
    body: counts ? digest : JSON.stringify({ url, question }),
  };
}

/** REA's analyze-web-bundle result -> a short markdown digest with evidence (script and line per finding). Pure. */
export function digestOf({ url, question, at, result, own = null }) {
  const n = (result && result.normalized_result) || result || {};
  const cap = n.capture || {}, obs = n.observations || {}, nodes = (obs.chunks && obs.chunks.nodes) || [], edges = (obs.chunks && obs.chunks.edges) || [];
  const byKey = new Map(nodes.map((x) => [x.script_key, x]));
  const where = (loc) => { const s = loc && byKey.get(loc.script_key); return (s ? path(s.url) : (loc && loc.script_key ? loc.script_key.slice(0, 12) : '?')) + (loc && loc.line ? ':' + loc.line : ''); };
  const path = (u) => { try { const x = new URL(u); return x.pathname + (x.search ? '?…' : ''); } catch (_) { return String(u || '').slice(0, 80); } };
  const endpoints = obs.endpoints || [], inf = n.inferences || [];
  const L = ['# Study: ' + (question || 'how it works'), '', 'Page: ' + url, 'Studied: ' + at + ' with REA (' + REA + '), static capture only; nothing was run, submitted or copied.', '',
    '## What was captured', '- ' + (cap.scripts_observed || 0) + ' scripts seen, ' + (cap.scripts_analyzed || nodes.length) + ' analyzed, ' + edges.length + ' import links; completeness: ' + ((n.completeness && n.completeness.status) || 'unknown'), ''];
  if (nodes.length) {
    L.push('## Largest modules (where the work is)');
    for (const s of [...nodes].sort((a, b) => (b.bytes || 0) - (a.bytes || 0)).slice(0, 25)) L.push('- ' + path(s.url) + ' (' + Math.round((s.bytes || 0) / 1024) + ' KB)');
    L.push('');
  }
  if (endpoints.length) {
    L.push('## Endpoints the code calls (evidence: script:line)');
    const seen = new Set();
    for (const e of endpoints) { const k = e.value + ' ' + e.mechanism; if (seen.has(k)) continue; seen.add(k); L.push('- `' + String(e.value).slice(0, 120) + '` via ' + e.mechanism + ' at ' + where(e.location)); if (seen.size >= 60) break; }
    L.push('');
  }
  if (endpoints.length) { // Verse's own ranking: every REA sighting of one endpoint counts, direct calls weigh most (tools/study-engine.mjs)
    const strength = (m) => /fetch|xhr|websocket|eventsource|beacon/i.test(m) ? 0.9 : /^call:/.test(m) ? 0.75 : 0.4;
    const ranked = rankFindings([{ findings: endpoints.map((e) => ({ kind: 'endpoint', value: String(e.value).slice(0, 120), mechanism: e.mechanism, strength: strength(e.mechanism), built: false, script: where({ script_key: e.location && e.location.script_key }), line: (e.location && e.location.line) || 0 })) }]);
    L.push('## Strongest evidence first (Verse ranking)');
    for (const f of ranked.slice(0, 15)) L.push('- `' + f.value + '` ' + f.confidence + ' (' + f.score + '; ' + f.scripts + ' script(s), ' + f.mechanisms.join(', ') + ')');
    L.push('');
  }
  if ((obs.routes || []).length) { L.push('## Routes'); for (const r of obs.routes.slice(0, 40)) L.push('- `' + String(r.value || r.path || JSON.stringify(r)).slice(0, 120) + '`'); L.push(''); }
  if ((obs.webmcp_declarations || []).length) { L.push('## Tools the page declares for agents (WebMCP; untrusted, never called)'); for (const t of obs.webmcp_declarations.slice(0, 20)) L.push('- ' + String(t.name || t.value || '').slice(0, 80)); L.push(''); }
  if (inf.length) { L.push('## Inferences (with confidence)'); for (const i of inf.slice(0, 20)) L.push('- ' + i.kind + ': `' + String(i.value).slice(0, 100) + '` (' + i.confidence + ', ' + ((i.basis || []).map(where).join(', ') || 'no basis') + ')'); L.push(''); }
  const unk = n.unknowns || [], lim = n.limitations || [];
  if (unk.length || lim.length) { L.push('## What REA could not tell'); for (const x of [...unk, ...lim].slice(0, 12)) L.push('- ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300)); L.push(''); }
  if (own) { // Verse's own read of the same scripts (tools/study-engine.mjs): RPC, feature trace, source-map names, its own unknowns
    if (own.trace.length) { L.push('## Where "' + own.word + '" lives (Verse feature trace)'); for (const h of own.trace.slice(0, 12)) L.push('- ' + h.script + ':' + h.line + (h.fn ? ' in ' + h.fn + '()' : '') + (h.original ? ' (source ' + h.original + ')' : '') + (h.nearCalls.length ? '; calls near it: ' + h.nearCalls.slice(0, 3).join('; ') : '')); L.push(''); }
    const eps = own.ranked.filter((f) => f.kind === 'endpoint');
    if (eps.length && !endpoints.length) { L.push('## Endpoints the code calls (Verse\'s own read, strongest evidence first)'); for (const f of eps.slice(0, 30)) L.push('- `' + f.value + '` ' + f.confidence + ' (' + f.mechanisms.join(', ') + ') at ' + f.evidence.slice(0, 3).join(', ')); L.push(''); }
    const rpc = own.ranked.filter((f) => f.kind === 'rpc' || f.kind === 'graphql');
    if (rpc.length) { L.push('## RPC and GraphQL operations (Verse)'); for (const f of rpc.slice(0, 20)) L.push('- `' + f.value + '` ' + f.confidence + ' at ' + f.evidence.join(', ')); L.push(''); }
    L.push('## What Verse\'s own read could not tell'); for (const u of own.unknowns) L.push('- ' + u); L.push('');
  }
  L.push('## Use', 'Read for how it works, then build Verse\'s own version. Never copy its code, assets or text.');
  let out = L.join('\n');
  if (out.length > MAX_DIGEST) out = out.slice(0, MAX_DIGEST - 40) + '\n\n(digest shortened to fit)';
  return { digest: out, counts: { scripts: cap.scripts_analyzed || nodes.length, endpoints: endpoints.length, modules: nodes.length } };
}

function rea(args) {
  if (!ALLOWED.has(args[0])) throw new Error('rea-study: ' + args[0] + ' is not an allowed REA command');
  const r = spawnSync('npx', ['-y', REA, ...args, '--format', 'json'], { encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024 });
  let j = null; try { j = JSON.parse(r.stdout); } catch (_) {}
  if (!j || j.error) throw new Error('REA ' + args[0] + ' failed' + (j && j.code ? ' (' + j.code + ')' : ''));
  return j;
}

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const p of ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/usr/bin/google-chrome', '/usr/bin/chromium']) if (existsSync(p)) return p;
  throw new Error('no Chrome: set CHROME_PATH');
}

/** open the page in a fresh headless Chrome and let REA capture it; returns REA's analyze-web-bundle result */
export async function study(url, { observeMs = 4000, port = 9300 + Math.floor(Math.random() * 500) } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rea-study-'));
  const chrome = spawn(chromePath(), ['--headless=new', '--no-sandbox', '--no-first-run', '--disable-extensions', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + port, '--user-data-dir=' + dir, url], { stdio: 'ignore' });
  const endpoint = 'http://127.0.0.1:' + port;
  try {
    let target = null;
    for (let i = 0; i < 30 && !target; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try { const t = rea(['list-browser-targets', endpoint]); target = ((t.normalized_result || {}).targets || []).find((x) => x.type === 'page' && x.origin === new URL(url).origin); } catch (_) {}
    }
    if (!target) throw new Error('the page did not open');
    await new Promise((r) => setTimeout(r, 3000)); // let the page load its modules
    return rea(['analyze-web-bundle', endpoint, target.target_id, '--observation-ms', String(observeMs), '--fetch-source-maps']); // REA defaults to the page's own origin
  } finally { chrome.kill('SIGKILL'); try { rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
}

/** Verse's own read: the scripts REA saw, fetched again as plain public GETs (what the browser already loaded, same origin only,
 * capped), with their public source maps; never run. Returns studyScripts() plus each trace hit mapped to its original source. */
export async function ownRead(url, result, question, { max = 25, cap = 3e6 } = {}) {
  const n = (result && result.normalized_result) || result || {}, nodes = ((n.observations || {}).chunks || {}).nodes || [], origin = new URL(url).origin;
  const get = async (u) => { const x = safeUrl(u); if (!x || new URL(x).origin !== origin) return ''; try { const r = await fetch(x, { redirect: 'error' }); const t = r.ok ? await r.text() : ''; return t.length <= cap ? t : ''; } catch (_) { return ''; } };
  const scripts = [], list = nodes.map((x) => x.url);
  if (!list.length) { // REA had nothing (or failed: it ran out of memory on one big app in testing): read the page's own <script src> and imports
    const html = await get(url);
    for (const m of html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)) list.push(new URL(m[1], url).href);
    for (const m of html.matchAll(/<link\b[^>]*rel=["']modulepreload["'][^>]*href=["']([^"']+)["']/gi)) list.push(new URL(m[1], url).href);
  }
  for (let k = 0; k < list.length && scripts.length < max; k++) { // the page's scripts, then the modules they import (same origin, capped)
    const u = list[k]; if (scripts.some((x) => x.url === u)) continue;
    const text = await get(u); if (!text) continue;
    scripts.push({ name: (() => { try { return new URL(u).pathname; } catch (_) { return 'script'; } })(), text, url: u });
    for (const m of text.matchAll(/\bimport\s*\(?\s*["'](\.{0,2}\/[^"']+\.m?js)["']/g)) if (list.length < max * 3) { try { list.push(new URL(m[1], u).href); } catch (_) {} }
  }
  const word = (String(question || '').toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !/^(does|how|what|with|from|that|this|they|work|works|their)$/.test(w)).sort((a, b) => b.length - a.length)[0] || '';
  const own = { ...studyScripts(scripts, { word }), word };
  for (const h of own.trace) {
    const s = scripts.find((x) => x.name === h.script), m = s && /\/\/[#@]\s*sourceMappingURL=([^\s'"]+)/.exec(s.text);
    if (!m || /^data:/.test(m[1])) continue;
    const map = decodeSourceMap(await get(new URL(m[1], s.url).href)), o = map && originalPosition(map, h.line, 0);
    if (o) h.original = o.source.split('/').slice(-2).join('/') + ':' + o.line;
  }
  return own;
}

const site = () => process.env.VOID_SITE || 'https://a-to-mind.com';
async function memory(method, query, body) {
  const token = process.env.VOID_OWNER_TOKEN;
  if (!token) throw new Error('VOID_OWNER_TOKEN is not set: studies are the owner\'s');
  const r = await fetch(site() + '/api/memory' + (query || ''), { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error('memory ' + method + ' answered ' + r.status);
  return r.json();
}
const save = (rec) => memory('POST', '', { source: 'rea-study', records: [rec] });
export { memory as studyMemory, save as saveStudy }; // tools/loop-study.mjs files studies for the loop's parity picks

async function main(argv) {
  const opt = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : ''; };
  if (argv.includes('--run')) { // the runner: counts only in the log (it is public)
    const pending = ((await memory('GET', '?q=pending&limit=20')).memory || []).filter((r) => r.kind === 'study' && /^pending /.test(r.summary || ''));
    let done = 0, failed = 0;
    for (const p of pending) {
      try {
        const full = (await memory('GET', '?id=' + encodeURIComponent(p.id))).memory || {};
        const req = JSON.parse(full.body || '{}'), url = safeUrl(req.url);
        if (!url) throw new Error('not a public page');
        const result = await study(url).catch(() => ({ normalized_result: { limitations: ['REA could not finish on this page; Verse read its scripts on its own.'] } })), own = await ownRead(url, result, req.question).catch(() => null);
        const { digest, counts } = digestOf({ url, question: req.question, at: new Date().toISOString(), result, own });
        await save(studyRecord({ url, question: req.question, digest, counts })); done++;
      } catch (_) { failed++; }
    }
    console.log('rea-study: ' + pending.length + ' pending, ' + done + ' studied, ' + failed + ' failed (findings are in Verse\'s private memory)');
    return failed && !done ? 1 : 0;
  }
  if (argv.includes('--ask')) {
    const i = argv.indexOf('--ask'), url = safeUrl(argv[i + 1]), q = argv[i + 2] || 'how it works';
    if (!url) { console.error('rea-study: a public http(s) page, please'); return 2; }
    await save(studyRecord({ url, question: q }));
    console.log('rea-study: filed; run the "REA study" workflow (or wait for the next run) and ask Verse "what did you study"');
    return 0;
  }
  const url = safeUrl(opt('--url'), argv.includes('--local'));
  if (!url) { console.error('usage: node tools/rea-study.mjs --url <https://page> --question "…" | --ask <url> "question" | --run'); return 2; }
  const result = await study(url).catch(() => ({ normalized_result: { limitations: ['REA could not finish on this page; Verse read its scripts on its own.'] } })), own = await ownRead(url, result, opt('--question')).catch(() => null);
  const { digest } = digestOf({ url, question: opt('--question'), at: new Date().toISOString(), result, own });
  console.log(digest);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error('rea-study: ' + e.message); process.exit(1); });
