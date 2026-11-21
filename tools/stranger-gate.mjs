// Stranger gate: one check for a changed page, tool, game or card. It calls quality-measure, game-fun (short play),
// seo auditPage, handoff declOf, the capability-sweep list, and stranger.js. A model runs only when a Groq or
// Cloudflare AI secret is already set (studio-make). This file never creates or prints one.
//   node tools/stranger-gate.mjs [--paths /qr/] [--live] [--json f] [--shots dir] [--file-jobs f]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPage } from '../void-live-deploy/lib/seo-audit.js';
import { BANNED } from '../void-live-deploy/lib/show-pipe.js';
import { rawLeaks, judgePrompt, readJudge } from '../void-live-deploy/lib/stranger.js';
import { declOf, parseDecl } from './handoff-scan.mjs';
import { funChecks } from './game-fun.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'void-live-deploy');
export const MAX = 4;
export const NIGHTLY = 3;
// the bad end of scoreSpeed in lib/quality.js: past this, that part of the speed score is 0
export const SPEED = Object.freeze({ dclMs: 4000, bytes: 3_000_000, cls: 0.25 });
export const JUDGE_KEYS = Object.freeze(['GROQ_API_KEY', 'CLOUDFLARE_AI_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_API_TOKEN2']);
const FALSE_CLAIM = /\b(?:world's (?:first|best|only)|world’s (?:first|best|only)|guaranteed to|clinically proven|100% accurate|millions of users)\b/i;
const INVENTED = /\b(?:Acme Corp|WidgetCo|John Doe|Jane Doe|FooBar Inc)\b/;
const PLACEHOLDER = /\b(?:coming soon|your (?:name|logo|text|result) here|lorem ipsum)\b/i;

/** the name of a model secret that is already set, or ''. Never the value. */
export function judgeKeyName(env = {}) {
  return JUDGE_KEYS.find((k) => typeof env[k] === 'string' && env[k].length >= 8) || '';
}

/** tool routes from the capability sweep list, keyed by path. Pure. */
export function sweepByPath(list) {
  const out = {};
  for (const it of (list && list.items) || []) {
    if (!it || !it.page) continue;
    const p = String(it.page).split('?')[0];
    const route = p.endsWith('/') ? p : p + '/';
    if (!out[route]) out[route] = it.id;
  }
  return out;
}

/** changed files a stranger can meet, games and pages before cards, at most `max`. exists(route) is true when that page is on disk. Pure given exists. */
export function targetsFromFiles(files, { sweep = {}, max = MAX, exists = () => false, added = new Set() } = {}) {
  const out = [], seen = new Set();
  const add = (t) => { if (!t || out.length >= max || seen.has(t.id)) return; seen.add(t.id); out.push(t); };
  const page = (route, file) => add({ id: route, kind: sweep[route] ? 'tool' : 'page', path: route, added: !!(file && added.has(file)) });
  for (const f of files || []) {
    const g = /^void-live-deploy\/games\/([\w.-]+)\//.exec(f);
    if (g) add({ id: g[1], kind: 'game', path: '/games/' + g[1] + '/' });
  }
  for (const f of files || []) {
    if (/^(?:void\.html|void-live-deploy\/(?:index|void)\.html)$/.test(f)) page('/', f);
    const m = /^void-live-deploy\/((?:[\w.-]+\/)+)(?:index\.html|app\.js)$/.exec(f);
    if (m && !m[1].startsWith('games/')) page('/' + m[1], f);
    const lib = /^void-live-deploy\/lib\/([\w.-]+)\.js$/.exec(f);
    if (lib && exists('/' + lib[1] + '/')) page('/' + lib[1] + '/', f);
  }
  for (const f of files || []) {
    const s = /^void-live-deploy\/skills\/([\w.-]+)\.js$/.exec(f);
    if (s) add({ id: s[1], kind: 'card', path: '/', ask: s[1].replace(/-/g, ' ') });
  }
  return out;
}

/** one route string into a target. Pure. */
export function targetOfPath(p, sweep = {}) {
  const pathName = (String(p || '').trim().startsWith('/') ? String(p).trim() : '/' + String(p || '').trim()).split('?')[0];
  const g = /^\/games\/([\w.-]+)\/?$/.exec(pathName);
  if (g) return { id: g[1], kind: 'game', path: '/games/' + g[1] + '/' };
  const route = pathName.replace(/\/?$/, '/');
  return { id: route, kind: sweep[route] ? 'tool' : 'page', path: route };
}

/** `n` items from a rotation that moves one step a day. Pure. */
export function rotate(items, day, n = NIGHTLY) {
  if (!items || !items.length || n < 1) return [];
  const start = ((day % items.length) + items.length) % items.length;
  const out = [];
  for (let i = 0; i < Math.min(n, items.length); i++) out.push(items[(start + i) % items.length]);
  return out;
}

/** a new page that neither declares its handoff nor is on the legacy list. Pure. */
export function needsHandoff(html, route, legacyMap, added) {
  if (!added) return false;
  const tag = declOf(html);
  if (tag && parseDecl(tag)) return false;
  return !(legacyMap && legacyMap[route]);
}

/** the fun probe's reasons a short play can show. Idle-lose and the one-tap restart stay with game-fun's own gate. Pure. */
export function shortPlay(r) {
  return funChecks(r).filter((s) => !/doing nothing did not lose|did not restart|did not get harder/.test(s));
}

/** plain reasons one measured surface failed. `measure` is quality-measure's result; `funFails` is shortPlay. Pure. */
export function reasonsOf({ kind, measure, funFails, text, titleMissing, handoffMissing }) {
  const reasons = [];
  if (kind === 'game') reasons.push(...(funFails || []));
  else if (measure && measure.fail && !/^gated:/.test(measure.fail)) reasons.push('it did not load: ' + measure.fail);
  else if (measure && measure.metrics) {
    const e = measure.metrics.errs || {}, flows = measure.metrics.flows || {};
    if (e.errors) reasons.push(e.errors + ' error' + (e.errors > 1 ? 's' : '') + ' in the page' + (measure.details && measure.details.errors && measure.details.errors[0] ? ': ' + measure.details.errors[0] : ''));
    if (flows.controls > 0 && flows.controlsWithEffect === 0) reasons.push('the main control did nothing');
    if (kind === 'card' && !(measure.details && String(measure.details.text || '').trim().length >= 40)) reasons.push('the ask did not put a result on the stage');
    const art = measure.metrics.art || {}, lay = measure.metrics.layout || {};
    if (art.placeholders) reasons.push('placeholder art is on the page');
    if (art.broken) reasons.push('a picture is broken');
    if (lay.scrollX > 4) reasons.push('the page scrolls sideways');
    if (lay.clipped) reasons.push('text is cut off');
    if (e.placeholderText) reasons.push('placeholder text is on screen');
    const links = ((measure.details && measure.details.brokenLinks) || []).filter((h) => h && h !== '#' && h !== '(empty)');
    if (links.length) reasons.push('a link goes nowhere: ' + links.slice(0, 2).join(', '));
    const sp = measure.metrics.speedPhone || {};
    if (sp.dcl > SPEED.dclMs) reasons.push('the phone wait is ' + sp.dcl + ' ms, past the ' + SPEED.dclMs + ' ms budget');
    if (sp.bytes > SPEED.bytes) reasons.push('the phone download is ' + Math.round(sp.bytes / 1000) + ' KB, past the ' + Math.round(SPEED.bytes / 1000) + ' KB budget');
    if (sp.cls > SPEED.cls) reasons.push('the page jumps while it loads (shift ' + sp.cls + ', budget ' + SPEED.cls + ')');
  }
  const seen = String(text || '');
  for (const hit of rawLeaks(seen)) reasons.push('a stranger sees ' + hit);
  if (BANNED.test(seen)) reasons.push('internal words are on screen');
  if (PLACEHOLDER.test(seen)) reasons.push('placeholder copy is on screen');
  if (INVENTED.test(seen)) reasons.push('an invented name is on screen');
  if (FALSE_CLAIM.test(seen)) reasons.push('it states ' + (seen.match(FALSE_CLAIM) || [''])[0] + ' with nothing behind it');
  if (titleMissing) reasons.push('the page has no title');
  if (handoffMissing) reasons.push('a new page does not say what it takes and what it gives');
  return [...new Set(reasons)];
}

/** the model's no answers, as reasons. A missing answer adds none. Pure. */
export function reasonsFromJudge(j) {
  if (!j) return [];
  return ['looks', 'claims', 'names', 'purpose'].filter((k) => j[k] && j[k].ok === false && j[k].why).map((k) => j[k].why);
}

/** one queue job per failure. The target is what /api/queue dedupes on, and it is at most 40 characters. Pure. */
export function jobsFor(rows) {
  return (rows || []).filter((r) => r.reasons && r.reasons.length).map((r) => ({
    ask: ('stranger test failed for ' + r.id + ': ' + r.reasons[0]).slice(0, 200),
    target: ('stranger:' + String(r.id).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')).slice(0, 40),
  }));
}

/** the plain list a pull request prints. Pure. */
export function report(rows) {
  const bad = (rows || []).filter((r) => r.reasons && r.reasons.length);
  if (!(rows || []).length) return 'Stranger test: nothing a stranger meets changed.';
  if (!bad.length) return 'Stranger test passed (' + rows.length + ' checked).';
  return bad.map((r) => r.id + ' (' + r.kind + '): ' + r.reasons.join('; ')).join('\n');
}

const slug = (id) => String(id).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'item';
const chrome = () => [process.env.VOID_TEST_BROWSER, process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => p && fs.existsSync(p));

/** ask the model that is already configured. Returns '' when no secret is set or none answers. Never prints a secret. */
export async function askJudge(prompt, env = process.env, fetchImpl = fetch) {
  if (!judgeKeyName(env)) return '';
  const { llm } = await import('./studio-make.mjs');
  const safe = { ...env, GEMINI_API_KEY: '' };
  try {
    const got = await llm([{ role: 'user', content: prompt }], { max: 500, temperature: 0, env: safe, fetchImpl, prefer: ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile'] });
    return (got && got.text) || '';
  } catch (_) { return ''; }
}

function writeShots(dir, id, shots) {
  if (!dir) return {};
  fs.mkdirSync(dir, { recursive: true });
  const files = {};
  for (const [k, buf] of Object.entries(shots || {})) {
    if (!buf) continue;
    const name = slug(id) + '-' + k + '.png';
    fs.writeFileSync(path.join(dir, name), buf);
    files[k] = name;
  }
  return files;
}

/** measure the targets. origin empty serves the repo; a live origin is the site a stranger opens. */
export async function runTargets(targets, { origin = '', shotDir = '', env = process.env, fetchImpl = fetch, ms = 12000 } = {}) {
  const rows = [];
  if (!targets.length) return rows;
  const exe = chrome();
  if (exe && !env.VOID_TEST_BROWSER) process.env.VOID_TEST_BROWSER = exe;
  if (exe && !env.CHROME_PATH) process.env.CHROME_PATH = exe;
  let srv = null, base = origin;
  if (!base) {
    const { serve } = await import('./game-fun.mjs');
    srv = await serve();
    base = 'http://127.0.0.1:' + srv.address().port;
  }
  process.env.VOID_SITE = base.replace(/\/+$/, '');
  const savedOwner = process.env.VOID_OWNER_TOKEN;
  delete process.env.VOID_OWNER_TOKEN; // a stranger has no owner key; quality-measure would send one
  let browser = null;
  try {
    const needPage = targets.some((t) => t.kind !== 'game');
    if (needPage) {
      let qm = null;
      try { qm = await import('./quality-measure.mjs'); browser = await qm.launch(); }
      catch (e) {
        const why = 'the browser did not start: ' + String(e.message || e).slice(0, 140);
        for (const t of targets.filter((x) => x.kind !== 'game')) rows.push({ id: t.id, kind: t.kind, path: t.path, pass: false, reasons: [why], shots: {} });
      }
      for (const t of (browser ? targets.filter((x) => x.kind !== 'game') : [])) {
        let m;
        try { m = await qm.measure(browser, { id: t.id, path: t.path, kind: t.kind, ask: t.ask || '' }, { shots: !!shotDir }); }
        catch (e) { rows.push({ id: t.id, kind: t.kind, path: t.path, pass: false, reasons: ['the check did not finish: ' + String(e.message || e).slice(0, 140)], shots: {} }); continue; }
        const text = (m.details && m.details.text) || '';
        let html = '', titleMissing = false, handoffMissing = false;
        if (t.kind !== 'card') {
          const file = path.join(site, t.path === '/' ? 'index.html' : t.path.replace(/^\//, '') + 'index.html');
          html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
          if (html) titleMissing = auditPage(html, t.path, null).defects.some((d) => d.kind === 'title');
          if (html && t.added) {
            let legacy = {};
            try { legacy = JSON.parse(fs.readFileSync(path.join(root, 'tools/handoff-types.json'), 'utf8')); } catch (_) {}
            handoffMissing = needsHandoff(html, t.path, legacy, true);
          }
        }
        let reasons = reasonsOf({ kind: t.kind, measure: m, text, titleMissing, handoffMissing });
        if (judgeKeyName(env)) reasons = [...new Set(reasons.concat(reasonsFromJudge(readJudge(await askJudge(judgePrompt({ id: t.id, kind: t.kind, title: t.id, visible: text.slice(0, 1500) }), env, fetchImpl)))))];
        const shots = writeShots(shotDir, t.id, m.shots);
        rows.push({ id: t.id, kind: t.kind, path: t.path, pass: reasons.length === 0, reasons, shots, note: m.fail && /^gated:/.test(m.fail) ? 'a stranger sees the sign-in screen' : '' });
      }
    }
    const { probe } = await import('./game-fun.mjs');
    for (const t of targets.filter((x) => x.kind === 'game')) {
      if (shotDir) fs.mkdirSync(shotDir, { recursive: true });
      const shot = shotDir ? path.join(shotDir, slug(t.id) + '-phone.png') : '';
      let r;
      try { r = await probe(t.id, { base, ms, quick: true, shot }); }
      catch (e) { rows.push({ id: t.id, kind: 'game', path: t.path, pass: false, reasons: ['the check did not finish: ' + String(e.message || e).slice(0, 140)], shots: {} }); continue; }
      const reasons = shortPlay(r);
      rows.push({ id: t.id, kind: 'game', path: t.path, pass: reasons.length === 0, reasons, shots: shot ? { phone: path.basename(shot) } : {} });
    }
  } finally {
    if (savedOwner) process.env.VOID_OWNER_TOKEN = savedOwner;
    if (browser) await browser.close().catch(() => {});
    if (srv) srv.close();
  }
  return rows;
}

export async function fileJobs(jobs, { token = '', fetchImpl = fetch, siteUrl = 'https://a-to-mind.com' } = {}) {
  const out = [];
  for (const j of jobs || []) {
    if (!token) { out.push({ target: j.target, filed: false, status: 0 }); continue; }
    const res = await fetchImpl(siteUrl + '/api/queue', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ ask: j.ask, target: j.target }), signal: AbortSignal.timeout(20000) }).catch(() => null);
    out.push({ target: j.target, filed: !!(res && res.ok), status: res ? res.status : 0 });
  }
  return out;
}

function gitList(flag) {
  const r = spawnSync('git', ['diff', flag, 'origin/main...HEAD'], { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? String(r.stdout || '') : '';
}

function arg(name, args) {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : '';
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--file-jobs')) {
    const file = args[args.indexOf('--file-jobs') + 1];
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const posted = await fileJobs(jobsFor(data.rows || []), { token: process.env.VOID_OWNER_TOKEN || '' });
    for (const p of posted) console.log((p.filed ? 'filed ' : 'not filed ') + p.target + (p.status ? ' ' + p.status : ''));
    return;
  }
  const paths = (arg('paths', args) || process.env.STRANGER_PATHS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const event = process.env.GITHUB_EVENT_NAME || '';
  const live = args.includes('--live') || event === 'schedule' || event === 'workflow_dispatch';
  let sweep = {};
  try { sweep = sweepByPath(JSON.parse(fs.readFileSync(path.join(root, 'tools/capability-sweep/list.json'), 'utf8'))); } catch (_) {}
  let targets = [];
  if (paths.length) targets = paths.map((p) => targetOfPath(p, sweep)).slice(0, MAX);
  else if (live) {
    const { pages } = await import('./handoff-scan.mjs');
    const routes = pages().filter((r) => !r.startsWith('/games/')).map((r) => targetOfPath(r, sweep));
    let games = [];
    try { games = Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'data/game-manifest.json'), 'utf8')).games || {}).map((id) => targetOfPath('/games/' + id + '/', sweep)); } catch (_) {}
    const day = Math.floor(Date.now() / 86400000);
    targets = rotate([...games, ...routes], day, Number(arg('n', args)) || NIGHTLY);
  } else {
    const names = gitList('--name-only').split('\n').map((s) => s.trim()).filter(Boolean);
    const added = new Set(gitList('--name-status').split('\n').map((l) => l.match(/^A\t(.+)$/)).filter(Boolean).map((m) => m[1]));
    targets = targetsFromFiles(names, { sweep, added, exists: (route) => fs.existsSync(path.join(site, route.replace(/^\//, ''), 'index.html')) });
  }
  const shotDir = arg('shots', args) || (event ? 'stranger-out' : '');
  const rows = await runTargets(targets, { origin: live ? 'https://a-to-mind.com' : '', shotDir });
  const body = { at: new Date().toISOString(), live: !!(live || args.includes('--live')), judge: judgeKeyName(process.env) ? 'model' : 'measure', rows };
  const jsonPath = arg('json', args) || (event ? 'stranger-out/stranger.json' : '');
  if (jsonPath) { fs.mkdirSync(path.dirname(jsonPath), { recursive: true }); fs.writeFileSync(jsonPath, JSON.stringify(body, null, 2) + '\n'); }
  const text = report(rows);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Stranger test\n\n' + text + '\n');
  if (rows.some((r) => r.reasons.length)) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
