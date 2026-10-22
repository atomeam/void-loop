// The site tester (Adam's pick, 2026-10-15): drives a site in headless Chrome the way a person would and checks what comes back.
//   node tools/site-test.mjs                       Verse: every case in tools/site-test.json on live a-to-mind.com (VOID_SITE overrides)
//   node tools/site-test.mjs --url <u> --steps f   any site: a JSON list of steps (goto, click, fill, wait, expect, shot)
//   node tools/site-test.mjs ... --json out.json   also write the results; --shots dir saves a screenshot per case (default site-test-shots/)
//   node tools/site-test.mjs --improve             after a Verse run: pick this run's one improvement, apply it to the suite, log it
// Rules (Adam, 2026-10-15): it only tests. Every request that is not a GET is answered by the tester itself with an empty 204 and never
// leaves the browser, so it cannot submit a form, post, sign up, buy, send, or land in Verse's answer/miss logs or view counts. Each
// run goes through the suite once, never the same ask twice, at most one ask every GAP_MS. Its traffic says who it is (user agent
// "VerseSiteTest" and an x-void-test header). On another site it reads robots.txt first and stops if the path is disallowed.
// Every run ends in exactly one improvement (lib below: improve): a new failure is filed once (deduped by key), else the suite grows
// by one ask, else a threshold tightens, else the weakest answer is filed for a quality upgrade. tools/site-test.log.json keeps one
// line per run so nobody has to wonder whether a run was wasted.
// Its asks are its own: skill examples from the code and wordings it makes up (variants). Visitors' exact asks never go into the suite,
// the seen-set or the log (the repo is public); a wording learned from real traffic is committed only as a paraphrase.
// fps here is headless software GL (CI has no GPU): a floor that only ratchets up, a regression alarm, not the real-device number.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SUITE = resolve(here, 'site-test.json'), LOG = resolve(here, 'site-test.log.json'), SEEN = resolve(here, 'site-test.seen.json');
export const NEW_PER_RUN = 4;
export const GAP_MS = 3000, UA_TAG = 'VerseSiteTest/1 (+https://a-to-mind.com/; tests only, sends nothing)';
export const REFUSAL = /don.t know this yet|couldn.t find|isn.t connected|something went wrong/i;
/** the asks that failed this run and the first reason each, so the log (and the tester card) can name them, not only count them
 *  (owner, 2026-10-19: the card said "64 of 74" every run and nobody could tell which ten). The suite's own asks only, never a visitor's. Pure. */
export const failedOf = (results) => (results || []).filter((r) => r && !r.ok).slice(0, 12).map((r) => ({ ask: String(r.ask || '').slice(0, 80), why: String((r.why || [])[0] || '').slice(0, 120) }));
export const STEP_KINDS = ['goto', 'click', 'fill', 'wait', 'expect', 'shot'];

/** One case's verdict from what the page showed. Pure. r: { text, newThings, errors, fps, loadMs }. */
export function judge(c, r, limits = {}) {
  const why = [], ex = c.expect || {};
  if (!String(r.text || '').trim() && !r.newThings && !(ex.selector && r.selector)) why.push('nothing appeared');
  if (/^\s*\S.{0,200}\n?\s*thinking…\s*$/s.test(r.text || '') && !ex.modelOk) why.push('no skill caught it (it went to the model, which the tester never calls)');
  if (REFUSAL.test(r.text || '') && !ex.refusalOk) why.push('refused: ' + (String(r.text).match(REFUSAL) || [''])[0]);
  if (ex.text && !new RegExp(ex.text, 'i').test(r.text || '')) why.push('missing text /' + ex.text + '/');
  if (ex.not && new RegExp(ex.not, 'i').test(r.text || '')) why.push('unwanted text /' + ex.not + '/');
  if (ex.selector && !r.selector) why.push('no ' + ex.selector);
  if ((r.errors || []).length) why.push('console: ' + r.errors[0].slice(0, 120));
  const fpsMin = ex.fpsMin ?? (c.fps ? limits.fpsMin : undefined);
  if (fpsMin && typeof r.fps === 'number' && r.fps < fpsMin) why.push('fps ' + r.fps + ' < ' + fpsMin);
  if (limits.loadMs && r.loadMs > limits.loadMs) why.push('load ' + r.loadMs + ' ms > ' + limits.loadMs);
  // flags are noted, never failed (asked by Verse: flag a card-stats idle wait over 500 ms): a busy runner's slow idle is not a broken site
  const flags = [];
  if (limits.statsIdleMs && Number.isFinite(r.statsIdleMs) && r.statsIdleMs > limits.statsIdleMs) flags.push('stats idle ' + r.statsIdleMs + ' ms > ' + limits.statsIdleMs);
  // a console error or a broken file is the page's, not the ask's: one key for all asks, so it is filed once, not once per ask
  const site = why.length && /^console: /.test(why[0]);
  return { ask: c.ask, ok: !why.length, why, flags, key: (site ? 'site' : c.ask) + ' | ' + (why[0] || '').replace(/[\d.]+/g, '#').slice(0, 60) };
}

/** The asks of a suite, each once (a repeat is dropped, never sent twice in a run). Pure. */
/** what a page's text gained between two reads: the middle that differs once the shared start and end are trimmed (an answer can replace a
 * status line in the middle of the page, as "the void is empty · summon something first" does, not only grow its end). Pure. */
export function changedText(before, after) {
  const b = String(before || ''), t = String(after || ''); let i = 0, j = 0;
  while (i < b.length && i < t.length && b[i] === t[i]) i++;
  while (j < b.length - i && j < t.length - i && b[b.length - 1 - j] === t[t.length - 1 - j]) j++;
  return t.slice(i, t.length - j).slice(0, 1500);
}
export const onceEach = (cases) => { const s = new Set(); return cases.filter((c) => { const k = String(c.ask).trim().toLowerCase(); return !s.has(k) && s.add(k); }); };

/** robots.txt: is this path allowed for any agent? Minimal reader of the User-agent: * group. Pure. */
export function robotsAllows(txt, path) {
  let star = false; const dis = [], allow = [];
  for (const raw of String(txt || '').split('\n')) { const l = raw.replace(/#.*/, '').trim(); const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') star = v === '*'; else if (star && k === 'disallow' && v) dis.push(v); else if (star && k === 'allow' && v) allow.push(v); }
  const hit = (list) => Math.max(-1, ...list.filter((p) => path.startsWith(p)).map((p) => p.length));
  return hit(allow) >= hit(dis);
}

/** Steps for another site, checked before anything runs: known kinds only, nothing that presses keys or submits. Pure. */
export function checkSteps(steps) {
  if (!Array.isArray(steps) || !steps.length) return 'steps must be a non-empty list';
  for (const [i, s] of steps.entries()) {
    if (!s || !STEP_KINDS.includes(s.do)) return 'step ' + (i + 1) + ': do must be one of ' + STEP_KINDS.join(', ');
    if (/submit|buy|checkout|sign.?up|register|pay|send|post/i.test(String(s.selector || '')) && s.do === 'click') return 'step ' + (i + 1) + ': the tester never clicks a submit, buy, sign-up, send or post control';
  }
  return '';
}

/** Everything Verse has that an ask can reach: every skill with its own examples, plus the pages. skills: [{ name, examples }]. Pure. */
export function inventory(skills, pages = ['/store/', '/films/']) {
  return skills.filter((k) => k && k.name && Array.isArray(k.examples) && k.examples.length).map((k) => ({ id: 'skill:' + k.name, asks: k.examples.map(String) }))
    .concat(pages.map((p) => ({ id: 'page:' + p, path: p, asks: [] })));
}

const SYN = [[/^play /, ["let's play ", 'can we play ', 'start ']], [/^open /, ['show me ', 'pull up ', 'gimme ']], [/^show me /, ['let me see ', 'i wanna see ']],
  [/^what is /, ["what's ", 'whats ']], [/\bfour\b/, ['4']], [/\bconnect 4\b/, ['connect four']], [/\bplease\b/, ['pls']]];
/** New wordings of an ask, never the ask itself: synonyms, slang, one swapped-letter typo, a real game name Verse maps (games). Pure. */
export function variants(ask, games = {}) {
  const a = String(ask).toLowerCase().trim(), out = [];
  for (const [re, subs] of SYN) if (re.test(a)) for (const s of subs) out.push(a.replace(re, s));
  out.push('yo ' + a, a + ' pls');
  const w = a.split(' '), i = w.findIndex((x) => x.length > 4); if (i >= 0) { const x = w[i]; w[i] = x.slice(0, 2) + x[3] + x[2] + x.slice(4); out.push(w.join(' ')); }
  for (const [real, ours] of Object.entries(games)) if (a.includes(ours)) out.push(a.replace(ours, real));
  return [...new Set(out)].filter((x) => x !== a);
}

/** This run's new ground: the NEW_PER_RUN least recently tested features, each with one ask never tried before (its own examples
 *  first, then new wordings); features in priority go first. A feature with nothing left untried is skipped, so the tester never loops. Pure.
 *  seen: { features: { id: iso }, asks: [ask] }. */
export function plan(inv, seen = {}, n = NEW_PER_RUN, games = {}, priority = []) {
  const tried = new Set((seen.asks || []).map((x) => x.toLowerCase())), last = seen.features || {}, out = [];
  // priority first, in order (the least-checked skills from the growth page's friction line), then least recently tested
  const rank = (f) => { const i = priority.indexOf(f.id); return i < 0 ? priority.length : i; };
  for (const f of [...inv].sort((a, b) => rank(a) - rank(b) || String(last[a.id] || '').localeCompare(String(last[b.id] || '')) || a.id.localeCompare(b.id))) {
    if (out.length >= n) break;
    if (f.path) { if (!tried.has(f.path)) out.push({ ask: f.path, path: f.path, feature: f.id, page: true }); continue; }
    const fresh = f.asks.find((x) => !tried.has(x.toLowerCase()));
    const v = fresh ? null : f.asks.flatMap((x) => variants(x, games).map((w) => [w, x])).find(([w]) => !tried.has(w));
    const ask = fresh || (v && v[0]);
    if (ask) out.push({ ask, feature: f.id, variant: !fresh, base: fresh || v[1] }); // base: the example this wording came from
  }
  return out;
}

/** The seen-set after a run: every ask tried, every feature touched, stamped now. Pure. */
export function remember(seen = {}, probes, at) {
  const asks = [...new Set((seen.asks || []).concat(probes.map((p) => p.ask)))], features = { ...(seen.features || {}) };
  for (const p of probes) features[p.feature] = at;
  return { features, asks };
}

/** This run's one improvement. Pure: returns { kind, note, suite } with the suite to write (unchanged unless it grows or tightens).
 *  filed: keys already filed (from the log), so a failure is filed once. */
export function improve(results, suite, filed = []) {
  const done = new Set(filed);
  // a new wording or activity Verse did not understand: teach it (one alias item with its regression case), before anything else
  const unheard = (r) => r.variant && r.why.every((w) => /^(refused|nothing appeared|no skill caught)/.test(w)); // Verse did not understand the wording
  const miss = results.find((r) => !r.ok && unheard(r) && !done.has('teach | ' + r.ask));
  if (miss) return { kind: 'teach', key: 'teach | ' + miss.ask, note: 'teach Verse "' + miss.ask + '" (means "' + miss.base + '", ' + miss.feature + '): ' + miss.why.join('; '),
    suite: { ...suite, teach: (suite.teach || []).concat({ ask: miss.ask, means: miss.base, feature: miss.feature }) } };
  const fail = results.find((r) => !r.ok && !unheard(r) && !done.has(r.key));
  if (fail) return { kind: 'file', key: fail.key, note: 'fix: "' + fail.ask + '" ' + fail.why.join('; '), suite };
  // every failure already filed: nothing is filed twice, the run still improves the suite below
  // a new ask that passed becomes a regression case (it is now known ground)
  const asked = new Set(suite.cases.map((c) => c.ask.toLowerCase()));
  const won = results.find((r) => r.ok && r.probe && !r.page && !asked.has(r.ask.toLowerCase()));
  if (won) return { kind: 'grow', note: 'new ground passed, kept as a regression case: "' + won.ask + '" (' + won.feature + ')', suite: { ...suite, cases: suite.cases.concat({ ask: won.ask }) } };
  const next = (suite.candidates || []).find((c) => !asked.has(String(c.ask || c).toLowerCase()));
  if (next) { const c = typeof next === 'string' ? { ask: next } : next;
    return { kind: 'grow', note: 'grew the suite: "' + c.ask + '"', suite: { ...suite, cases: suite.cases.concat(c), candidates: suite.candidates.filter((x) => x !== next) } }; }
  const fps = results.filter((r) => typeof r.fps === 'number'), lim = suite.limits || {};
  if (fps.length) { const lo = Math.min(...fps.map((r) => r.fps)), to = Math.min(120, Math.floor(lo * 0.9));
    if (to > (lim.fpsMin || 0)) return { kind: 'tighten', note: 'fps floor ' + (lim.fpsMin || 0) + ' -> ' + to, suite: { ...suite, limits: { ...lim, fpsMin: to } } }; }
  const loads = results.map((r) => r.loadMs).filter(Number.isFinite);
  if (loads.length && lim.loadMs) { const to = Math.max(1000, Math.ceil(Math.max(...loads) * 1.25 / 100) * 100);
    if (to < lim.loadMs) return { kind: 'tighten', note: 'load ceiling ' + lim.loadMs + ' -> ' + to + ' ms', suite: { ...suite, limits: { ...lim, loadMs: to } } }; }
  const weak = results.filter((r) => r.ok && !done.has('weak | ' + r.ask)).sort((a, b) => (a.chars || 0) - (b.chars || 0))[0];
  if (weak) return { kind: 'file', key: 'weak | ' + weak.ask, note: 'quality upgrade: weakest answer was "' + weak.ask + '" (' + (weak.chars || 0) + ' chars)', suite };
  return { kind: 'none', note: 'nothing left to improve this run (add candidates)', suite };
}

async function browser() {
  const { chromium } = await import('playwright-core');
  const exe = process.env.CHROME_PATH || ['/usr/bin/google-chrome', '/opt/pw-browsers/chromium'].find((p) => existsSync(p));
  const b = await chromium.launch({ executablePath: exe, headless: true, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const ua = b.version ? 'Mozilla/5.0 (X11; Linux x86_64) Chrome/' + b.version() + ' ' + UA_TAG : UA_TAG;
  // a fresh context per case (nothing kept from the last ask), and only tests: nothing but GETs leaves the browser
  const ctx = async () => { const c = await b.newContext({ viewport: { width: 1280, height: 860 }, userAgent: ua, extraHTTPHeaders: { 'x-void-test': 'site-test' } });
    await c.route('**/*', (r) => r.request().method() === 'GET' ? r.continue() : r.fulfill({ status: 204, body: '' })); return c; };
  return { b, ctx };
}
const fpsOf = (p, ms = 2000) => p.evaluate((ms) => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < ms ? requestAnimationFrame(f) : ok(Math.round(n * 1000 / (performance.now() - t0))); }; requestAnimationFrame(f); }), ms);
const meta = (c) => ({ probe: !!c.feature, page: !!c.page, variant: !!c.variant, feature: c.feature, base: c.base });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runVoid(suite, { site = process.env.VOID_SITE || 'https://a-to-mind.com', shots = 'site-test-shots' } = {}) {
  mkdirSync(shots, { recursive: true }); const { b, ctx } = await browser(); const out = [];
  try { for (const c of onceEach(suite.cases)) {
    const cx = await ctx(), p = await cx.newPage(), errors = [];
    p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && !/favicon|204|net::ERR|cloudflareinsights|Permissions policy violation/i.test(m.text()) && errors.push(m.text()));
    // a script answered with the wrong type: name the file (the console line alone does not, issue #757)
    p.on('response', (res) => { const q = res.request(), ct = res.headers()['content-type'] || ''; if (q.resourceType() === 'script' && res.status() < 300 && !/javascript|wasm|json/.test(ct)) errors.unshift('script ' + new URL(res.url()).pathname + ' served as ' + (ct || 'nothing') + ' (' + res.status() + ')'); });
    const t0 = Date.now(); await p.goto(site + (c.path || '/'), { waitUntil: 'load', timeout: 45000 }); let loadMs = Date.now() - t0;
    // one slow load on a shared runner is not a slow site: over the ceiling, the page is loaded once more and the faster load counts
    // (issues #1022, #1028: 1244 and 1426 ms once, while the same pages load well inside the ceiling run after run). A slow site stays slow twice.
    if (suite.limits && suite.limits.loadMs && loadMs > suite.limits.loadMs) { const t1 = Date.now(); await p.goto(site + (c.path || '/'), { waitUntil: 'load', timeout: 45000 }); loadMs = Math.min(loadMs, Date.now() - t1); }
    if (c.page) { await p.waitForTimeout(1500); const text = (await p.evaluate(() => document.body.innerText)).slice(0, 1500);
      const v = judge(c, { text, errors, loadMs }, suite.limits); out.push({ ...v, ...meta(c), loadMs, chars: text.trim().length });
      console.log((v.ok ? 'ok   ' : 'FAIL ') + c.path + ' · ' + loadMs + ' ms' + (v.ok ? '' : ' · ' + v.why.join('; '))); await cx.close(); await wait(GAP_MS); continue; }
    await p.waitForSelector('#input', { timeout: 15000 }); await p.waitForTimeout(800);
    const before = await p.evaluate(() => ({ n: document.querySelectorAll('.thing').length, t: document.body.innerText }));
    await p.fill('#input', c.ask); await p.keyboard.press('Enter');
    // a hint ("the void is empty · summon something first") is said for 3.5 s, so the page is read early as well as at the end
    const SOON = 1200; await p.waitForTimeout(SOON); const early = await p.evaluate(() => document.body.innerText); await p.waitForTimeout(Math.max(0, (c.waitMs || 4000) - SOON));
    const seen = await p.evaluate(([b, sel]) => ({ newThings: document.querySelectorAll('.thing').length - b.n, text: document.body.innerText, selector: sel ? !!document.querySelector(sel) : true }), [before, (c.expect || {}).selector]);
    seen.text = [changedText(before.t, early), changedText(before.t, seen.text)].filter((x) => x.trim()).join('\n').slice(0, 1500);
    let fps = c.fps ? await fpsOf(p) : undefined;
    // the same for frames: under the floor, a second sample after a breath, and the better one counts (issues #1024, #1026: 1 and 2 fps once)
    if (c.fps && suite.limits && suite.limits.fpsMin && fps < suite.limits.fpsMin) { await p.waitForTimeout(1500); fps = Math.max(fps, await fpsOf(p)); }
    const slug = c.ask.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40); await p.screenshot({ path: resolve(shots, slug + '.png') }).catch(() => {});
    const statsIdleMs = await p.evaluate(() => { const e = performance.getEntriesByName('card-stats-idle').pop(); return e ? Math.round(e.duration) : null; }).catch(() => null);
    const v = judge(c, { ...seen, errors, fps, loadMs, statsIdleMs }, suite.limits); out.push({ ...v, ...meta(c), fps, loadMs, statsIdleMs, chars: seen.text.trim().length });
    console.log((v.ok ? 'ok   ' : 'FAIL ') + c.ask + (fps ? ' · ' + fps + ' fps' : '') + ' · ' + loadMs + ' ms' + (v.ok ? '' : ' · ' + v.why.join('; ')) + (v.flags.length ? ' · flag: ' + v.flags.join('; ') : ''));
    await cx.close(); await wait(GAP_MS);
  } } finally { await b.close(); }
  return out;
}

export async function runSteps(url, steps, { shots = 'site-test-shots' } = {}) {
  const bad = checkSteps(steps); if (bad) throw new Error(bad);
  const u = new URL(url), robots = await fetch(u.origin + '/robots.txt', { headers: { 'user-agent': UA_TAG } }).then((r) => r.ok ? r.text() : '').catch(() => '');
  if (!robotsAllows(robots, u.pathname)) throw new Error('robots.txt disallows ' + u.pathname + ': not testing it');
  mkdirSync(shots, { recursive: true }); const { b, ctx } = await browser(); const p = await (await ctx()).newPage(), errors = [], out = [];
  p.on('pageerror', (e) => errors.push(e.message));
  try { await p.goto(url, { waitUntil: 'load' });
    for (const [i, s] of steps.entries()) { let ok = true, why = '';
      try {
        if (s.do === 'goto') { const to = new URL(s.url, url); if (!robotsAllows(robots, to.pathname)) throw new Error('robots.txt disallows'); await p.goto(to.href, { waitUntil: 'load' }); }
        else if (s.do === 'click') await p.click(s.selector, { timeout: 10000 });
        else if (s.do === 'fill') await p.fill(s.selector, String(s.text || ''));
        else if (s.do === 'wait') await p.waitForSelector(s.selector, { timeout: s.ms || 10000 });
        else if (s.do === 'expect') { const t = await p.innerText(s.selector || 'body'); if (!new RegExp(s.text, 'i').test(t)) { ok = false; why = 'missing /' + s.text + '/'; } }
        else if (s.do === 'shot') await p.screenshot({ path: resolve(shots, 'step-' + (i + 1) + '.png') });
      } catch (e) { ok = false; why = e.message.split('\n')[0]; }
      out.push({ step: i + 1, do: s.do, ok, why }); console.log((ok ? 'ok   ' : 'FAIL ') + (i + 1) + ' ' + s.do + ' ' + (s.selector || s.url || s.text || '') + (why ? ' · ' + why : ''));
      await wait(Math.min(GAP_MS, 1500));
    }
    if (errors.length) out.push({ step: 'page', ok: false, why: 'page errors: ' + errors[0] });
  } finally { await b.close(); }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const shots = opt('--shots') || 'site-test-shots';
  if (opt('--url')) { const r = await runSteps(opt('--url'), JSON.parse(readFileSync(opt('--steps'), 'utf8')), { shots });
    if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(r, null, 2)); process.exit(r.every((x) => x.ok) ? 0 : 1); }
  const suite = JSON.parse(readFileSync(SUITE, 'utf8')), seen = existsSync(SEEN) ? JSON.parse(readFileSync(SEEN, 'utf8')) : {};
  const skillsDir = resolve(here, '..', 'void-live-deploy', 'skills'), skills = [];
  for (const n of JSON.parse(readFileSync(resolve(skillsDir, 'index.json'), 'utf8'))) { try { skills.push((await import(resolve(skillsDir, n + '.js'))).default); } catch (_) {} }
  const regress = new Set(suite.cases.map((c) => c.ask.toLowerCase()));
  const probes = a.includes('--no-new') ? [] : plan(inventory(skills), seen, NEW_PER_RUN, suite.games || {}, suite.priority || []).filter((p) => !regress.has(p.ask.toLowerCase()));
  const results = await runVoid({ ...suite, cases: suite.cases.concat(probes) }, { shots });
  if (a.includes('--improve')) writeFileSync(SEEN, JSON.stringify(remember(seen, probes, new Date().toISOString().replace(/\.\d+Z$/, 'Z'))) + '\n');
  if (opt('--json')) writeFileSync(opt('--json'), JSON.stringify(results, null, 2));
  if (a.includes('--improve')) {
    const log = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf8')) : [];
    const act = improve(results, suite, log.map((l) => l.key).filter(Boolean));
    if (act.kind === 'teach') act.title = 'site-test: ' + act.note.slice(0, 120);
    if (act.suite !== suite) writeFileSync(SUITE, JSON.stringify(act.suite, null, 2) + '\n');
    const lms = results.map((r) => r.loadMs).filter(Number.isFinite).sort((a, b) => a - b);
    log.push({ at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), passed: results.filter((r) => r.ok).length, of: results.length, ...(lms.length ? { ms: lms[lms.length >> 1] } : {}), kind: act.kind, ...(act.key ? { key: act.key } : {}), failed: failedOf(results), note: act.note });
    writeFileSync(LOG, JSON.stringify(log.slice(-300), null, 1) + '\n');
    writeFileSync(resolve(shots, 'improvement.json'), JSON.stringify(act.kind === 'file' || act.kind === 'teach' ? { title: 'site-test: ' + act.note.slice(0, 120), key: act.key } : { kind: act.kind, note: act.note }));
    console.log('improvement: ' + act.kind + ' · ' + act.note);
  }
  // only the regression cases decide the exit code: new ground that fails is an improvement to make, not a broken site
  process.exit(results.filter((r) => !r.probe).every((r) => r.ok) ? 0 : 1);
}
