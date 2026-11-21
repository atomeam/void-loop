// Run one house lane. The last stdout line is JSON. --dry writes nothing.
//   node tools/house-loops.mjs list
//   node tools/house-loops.mjs run <lane> [--dry]   (every run starts with the revenue lane; `run revenue` runs only that)
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOOPS, LINK_FIXES, DATASETS, HANDS_OFF, blankLoop, backoff, noteResult, redirectAdds, withRedirects, plainPatch, healthOf, langPatch, speedLine, twinGroups, staleSets, seoPatch, nextGap, topHandoff, directPatch, advisoryCount, costOf, payTier, sameFinding, h1Text } from '../void-live-deploy/lib/house-loops.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.VOID_SITE || 'https://a-to-mind.com').replace(/\/+$/, '');
const logPath = (id) => join(root, 'void-live-deploy/progress/loops', id + '.json');
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };
let save = (file, text) => writeFileSync(file, text);
const FROZEN = new Set(['void-live-deploy/index.html', 'void-live-deploy/void.html', 'void.html']);

function pages() {
  const site = join(root, 'void-live-deploy'), out = [];
  const walk = (d, route) => {
    let ents = []; try { ents = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (!e.isDirectory() || /^(node_modules|lib|skills|functions|vendor|api)$/.test(e.name) || e.name.startsWith('.')) continue;
      const r = route + e.name + '/', file = join(d, e.name, 'index.html');
      if (existsSync(file)) out.push({ route: r, file });
      walk(join(d, e.name), r);
    }
  };
  walk(site, '/');
  return out.filter((p) => !HANDS_OFF.test(p.route) && !FROZEN.has(p.file.slice(root.length + 1)));
}
async function hit(path) {
  const t = Date.now();
  try {
    const r = await fetch(SITE + path, { redirect: 'manual', signal: AbortSignal.timeout(12000), headers: { 'user-agent': 'Verse-house' } });
    if (!r.ok) return { path, status: r.status, ms: Date.now() - t, bytes: 0, html: '', headers: r.headers };
    const buf = await r.arrayBuffer();
    return { path, status: r.status, ms: Date.now() - t, bytes: buf.byteLength, html: new TextDecoder().decode(buf).slice(0, 180000), headers: r.headers };
  } catch { return { path, status: 0, ms: Date.now() - t, bytes: 0, html: '', headers: { get: () => '' } }; }
}
function loadOne(loop) { try { return JSON.parse(read(logPath(loop.id))); } catch { return blankLoop(loop); } }
function put(rec, dry) {
  const prev = loadOne(LOOPS.find((l) => l.id === rec.id));
  if (sameFinding(prev, rec)) return false;
  if (!dry) { const p = logPath(rec.id); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(rec) + '\n'); }
  return true;
}
async function runLinks() {
  const statuses = {};
  for (const f of LINK_FIXES) statuses[f.path] = (await hit(f.path)).status;
  const file = join(root, 'void-live-deploy/_redirects');
  const home = existsSync(join(root, 'void-live-deploy/echo-vault/index.html'));
  const lines = redirectAdds(read(file), statuses, LINK_FIXES, home);
  if (lines.length) save(file, withRedirects(read(file), lines, LINK_FIXES[0].why));
  const dead = LINK_FIXES.filter((f) => statuses[f.path] === 404).map((f) => f.path);
  const last = lines.length ? 'Added a redirect for ' + dead.join(' and ') + ' to the Echo Vault entry that already holds a reading list.' : 'The plain names that already have a home answered.';
  return { last, ok: true };
}
async function runHealth() {
  const bits = [];
  for (const p of ['/', '/progress/', '/tools/']) {
    const g = await hit(p), h = healthOf(g.html, g.headers);
    bits.push(g.path + ' ' + (g.status || 'no answer') + (h.lang ? '' : ', no language') + (h.missingAlt ? ', ' + h.missingAlt + ' pictures without alt text' : '') + (h.csp ? ', security header present' : ', no security header'));
  }
  let patched = '';
  for (const p of pages()) { const next = langPatch(read(p.file)); if (next) { save(p.file, next); patched = p.route; break; } }
  return { last: (patched ? 'Set the language on ' + patched + '. ' : '') + bits.join('. ') + '.', ok: true };
}
async function runSpeed() {
  const rows = [];
  for (const p of ['/', '/progress/']) rows.push(await hit(p));
  return { last: speedLine(rows), ok: rows.some((r) => r.status === 200) };
}
function runTwins() {
  const groups = twinGroups(pages().map((p) => ({ path: p.route, h1: h1Text(read(p.file)) })));
  const last = groups.length ? 'Same heading on ' + groups[0].paths.join(' and ') + '.' + (groups.length > 1 ? ' ' + (groups.length - 1) + ' more pairs.' : '') : 'No two pages share a heading.';
  return { last, ok: true };
}
function runPlain() {
  for (const p of pages()) { const next = plainPatch(read(p.file)); if (!next) continue; save(p.file, next); return { last: 'Added the page description as the sentence under the heading on ' + p.route + '.', ok: true, note: 'No model call. The sentence is the page description.' }; }
  return { last: 'Every checked page has a sentence under its heading.', ok: true };
}
function runFresh() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = DATASETS.map((d) => { let asOf = ''; try { asOf = JSON.parse(read(join(root, d.file))).asOf || ''; } catch { asOf = ''; } return { ...d, asOf }; });
  const stale = staleSets(rows, today);
  return { last: stale.length ? stale.map((s) => s.id + ' is dated ' + s.asOf + '. ' + s.owner + ' refreshes it.').join(' ') : 'The candle files are inside their two-day window.', ok: true };
}
function runSeo() {
  for (const p of pages()) { if (read(p.file).length > 200000) continue; const next = seoPatch(read(p.file)); if (!next) continue; save(p.file, next); return { last: 'Filled a missing title on ' + p.route + '.', ok: true }; }
  return { last: 'Checked pages have a title.', ok: true };
}
async function runCoverage() {
  const { untested } = await import('./untested.mjs');
  const files = ['void-live-deploy/lib', 'void-live-deploy/skills'].flatMap((d) => { try { return readdirSync(join(root, d)).filter((n) => n.endsWith('.js')).map((n) => ({ path: d + '/' + n, bytes: read(join(root, d, n)).length })); } catch { return []; } });
  const tests = readdirSync(join(root, 'tools')).filter((n) => /\.test\.mjs$|^test_/.test(n)).map((n) => read(join(root, 'tools', n)));
  const u = untested(files, tests);
  return { last: u.length ? 'Next file no test mentions: ' + u[0].path + ' (' + u.length + ' still unmentioned).' : 'Every library file is mentioned by a test.', ok: true };
}
function runDeps() {
  const r = spawnSync('npm', ['audit', '--omit=dev', '--json'], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 8 << 20 });
  let audit = {}; try { audit = JSON.parse(r.stdout || '{}'); } catch { audit = {}; }
  const n = advisoryCount(audit), one = directPatch(audit);
  const last = one ? 'High or critical advisories: ' + n + '. A patch for ' + one.name + (one.version ? ' ' + one.version : '') + ' is the direct fix. This run does not bump it.' : (n ? 'High or critical advisories: ' + n + '. None is a direct patch bump.' : 'No high or critical advisory in production dependencies.');
  return { last, ok: true };
}
async function runHandoff() {
  const { scan } = await import('./handoff-scan.mjs');
  const top = topHandoff(scan().gaps);
  return { last: top ? 'Next unconnected pair: ' + top.from + ' to ' + top.to + ', carrying ' + (top.shared || []).join(', ') + '.' : 'No unconnected page pair in the scan.', ok: true };
}
async function infraCents() {
  try {
    const r = await fetch(SITE + '/api/treasury', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return 0;
    const j = await r.json();
    return Number(j && j.pots && j.pots.infrastructure) || 0;
  } catch { return 0; }
}
const oneSentence = (s) => { const t = String(s || '').trim().split('\n')[0].trim(); return /^[A-Z][^<>"]{20,180}\.$/.test(t) && !/https?:/i.test(t) ? t : ''; };
async function askSentence(h1) {
  const { providersFrom, stackModel } = await import('./verse-coder.mjs');
  const { tierFor } = await import('../void-live-deploy/lib/agent-core.js');
  const ps = providersFrom(process.env).filter((p) => p && p.key);
  if (ps.length) {
    const got = await stackModel(ps, { timeoutMs: 25000, maxOut: 80 })([{ role: 'user', content: 'Write one plain sentence under 25 words for "' + String(h1).replace(/"/g, '') + '". No product names. End with a full stop.' }]);
    const text = oneSentence(got && got.text);
    if (text) return { text, tier: payTier({ freeFailed: false }) };
  }
  const cents = await infraCents();
  const tier = payTier({ freeFailed: true, infraCents: cents });
  if (tier.use !== 'paid') return { text: '', tier };
  const key = process.env.CLOUDFLARE_AI_TOKEN || process.env.CLOUDFLARE_API_TOKEN, account = process.env.CLOUDFLARE_ACCOUNT_ID, model = tierFor(cents).model;
  if (!key || !account || !model) return { text: '', tier };
  try {
    const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(account) + '/ai/run/' + model, { method: 'POST', signal: AbortSignal.timeout(25000), headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'One plain sentence under 25 words for "' + String(h1).replace(/"/g, '') + '". End with a full stop.' }], max_tokens: 80 }) });
    if (!r.ok) return { text: '', tier };
    const j = await r.json();
    return { text: oneSentence(j && j.result && (j.result.response || '')), tier };
  } catch { return { text: '', tier }; }
}
function growthPick() {
  const raw = read(join(root, 'void-live-deploy/tower.ideas.json'));
  if (!raw.trim()) return '';
  let j;
  try { j = JSON.parse(raw); } catch (e) {
    console.log('growth board: ' + String(e && e.message || e).slice(0, 120));
    return '';
  }
  const p = j && j.picks && j.picks[0];
  return p && p.title ? 'The growth loop pick is ' + String(p.title).slice(0, 160) + '.' : '';
}
async function runNext() {
  const fromLoop = growthPick();
  if (fromLoop) return { last: fromLoop, ok: true, note: 'Folded into the growth loop. No separate model call.', paidCents: 0 };
  const g = nextGap(read(join(root, 'docs/GAPS.md')));
  let last = g ? 'Oldest open gap is ' + g.n + ', ' + g.ask + '.' : 'No open gap in the list.';
  if (!g || process.env.HOUSE_ASK !== '1') return { last, ok: true };
  const asked = await askSentence(g.ask);
  if (asked.text) last += ' ' + asked.text;
  return { last, ok: true, note: asked.tier.note, paidCents: asked.tier.paidCents };
}
const JOBS = { links: runLinks, health: runHealth, speed: runSpeed, twins: runTwins, plain: runPlain, fresh: runFresh, seo: runSeo, coverage: runCoverage, deps: runDeps, handoff: runHandoff, 'next-tool': runNext };

export async function main(argv = process.argv.slice(2)) {
  const [cmd, lane] = argv, dry = argv.includes('--dry'), job = lane === 'revenue' ? () => ({}) : JOBS[lane];
  if (cmd === 'list') { for (const l of LOOPS) console.log(l.id + '\t' + l.hourUtc + ':' + String(l.minuteUtc).padStart(2, '0')); return 0; }
  if (cmd !== 'run' || !job) { console.error('usage: node tools/house-loops.mjs list | run <lane> [--dry]'); return 2; }
  // the revenue lane is the top priority (tools/revenue-lane.mjs): it runs first in every house run, fenced so it never fails the lane
  try { const { runLane } = await import('./revenue-lane.mjs'); const r = await runLane({ dry }); console.log('Revenue: ' + r.last); } catch (e) { console.log('revenue: ' + String((e && e.message) || e).slice(0, 160)); }
  if (lane === 'revenue') return 0;
  // a lane branch left over from a merged pull request cannot take today's patch: make it fresh (tools/house-branch.mjs; Actions only, never one with an open pull request)
  if (!dry) { try { const { freshLaneBranch } = await import('./house-branch.mjs'); await freshLaneBranch(lane); } catch (e) { console.log('house branch: ' + String((e && e.message) || e).slice(0, 160)); } }
  const loop = LOOPS.find((l) => l.id === lane), prev = loadOne(loop), now = Date.now(), gate = backoff(prev.state, now);
  save = (file, text) => { if (!dry) writeFileSync(file, text); };
  const result = gate.run ? await job() : { last: prev.last, ok: true };
  const rec = { ...prev, status: gate.run ? 'Ran.' : gate.status, last: result.last || prev.last, cost: costOf(loop, { minutes: loop.minutes, note: result.note, paidCents: result.paidCents }), state: gate.run ? noteResult(prev.state, result.ok !== false, now) : prev.state };
  const wrote = put(rec, dry);
  console.log(rec.name + ': ' + rec.status + ' ' + rec.last + (wrote ? '' : ' (unchanged)'));
  console.log(JSON.stringify({ id: rec.id, status: rec.status, last: rec.last, wrote, cost: rec.cost }));
  // Verse's self-guards ride the lane (tools/verse-guards.mjs): each one is fenced, so a guard that breaks never fails the lane
  try { const { runRides } = await import('./verse-guards.mjs'); await runRides(lane, { dry }); } catch (e) { console.log('guards: ' + String((e && e.message) || e).slice(0, 160)); }
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((c) => process.exit(c)).catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
