// The 7-day re-test (asked by Verse, its reflection on #858: "Implement an automated 're-test' trigger: if a skill hasn't been
// last_tested in 7 days, queue a small, non-destructive validation task to refresh its success_rate."). Once a day, after the smoke
// test, every skill whose last_tested in skills/families.json is missing or older than RETEST_DAYS is re-tested here, non-destructively:
// its module loaded, each of its examples routed through the whole skill order (it must come first), none of its near misses taken,
// and its own unit test (tools/<name>.test.mjs) run when it has one. The result is written to tools/retest.json; tools/families.mjs
// reads it (a passing skill's last_tested is that day, "a re-test"; a failing one loses its self-test evidence and carries what
// failed). No queue job unless a re-test fails: then one `retest:<skill>` job at /api/queue with the failing example's text (the
// skill's own example, never a visitor's words), one per skill, none while one is open.
//   node tools/retest.mjs            re-test the stale skills, write tools/retest.json, queue a failure (VOID_OWNER_TOKEN)
//   node tools/retest.mjs --all      re-test every skill (writes the file)
//   node tools/retest.mjs --dry      re-test, print, write nothing, queue nothing
//   node tools/retest.mjs --skill x  one skill (writes the file)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'void-live-deploy', 'skills');
export const OUT = resolve(root, 'tools', 'retest.json');
export const RETEST_DAYS = 7;
export const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';

/** the skills due a re-test: no last_tested, or one older than `days` on `today`. Pure. */
export function stale(fam, today, days = RETEST_DAYS) {
  const t = Date.parse(today + 'T00:00:00Z'), out = [];
  for (const f of (fam && fam.families) || []) for (const s of f.skills || []) {
    if (!s || !s.name) continue;
    const at = /^\d{4}-\d{2}-\d{2}$/.test(String(s.last_tested || '')) ? Date.parse(s.last_tested + 'T00:00:00Z') : NaN;
    const old = Number.isNaN(at) ? Infinity : Math.floor((t - at) / 864e5);
    if (old > days) out.push({ name: s.name, last_tested: s.last_tested || null, days: Number.isFinite(old) ? old : null });
  }
  return out.sort((a, b) => (b.days === null) - (a.days === null) || (b.days || 0) - (a.days || 0) || a.name.localeCompare(b.name));
}

/** one skill's re-test against the loaded order: routing of its examples and near misses, its unit test. Pure given `first` and `runTest`. */
export function retestOne(mod, first, runTest) {
  const failing = [];
  for (const e of mod.examples || []) { const got = first(e); if (got !== mod.name) failing.push(`"${e}" -> ${got}`); }
  for (const e of mod.nearMisses || []) if (first(e) === mod.name) failing.push(`near miss "${e}" taken`);
  const test = runTest(mod.name); // { file, ok, out } | null
  if (test && !test.ok) failing.push('tools/' + test.file + ' failed' + (test.out ? ': ' + test.out.slice(0, 120) : ''));
  return { ok: !failing.length, failing: failing.map((x) => x.slice(0, 160)), test: test ? test.file : null };
}

/** the queue plan: one retest:<skill> job per failing skill whose first failing example is its own words, none while one is open. Pure. */
export function plan(results, queue, mods = {}) {
  const items = (queue && queue.items) || [];
  const open = items.filter((i) => i && String(i.target || '').startsWith('retest:') && /^(queued|building)$/.test(i.state)).length;
  const taken = new Set(items.map((i) => i && i.target));
  const jobs = [];
  for (const [name, r] of Object.entries(results || {})) {
    if (!r || r.ok) continue;
    const m = (mods[name] && mods[name].examples) || [], ex = r.failing.map((f) => /^"(.+)" -> /.exec(f)).filter(Boolean).map((x) => x[1]).find((e) => m.includes(e)) || m[0] || '';
    const target = ('retest:' + name).slice(0, 40);
    if (taken.has(target)) continue;
    jobs.push({ target, ask: (ex ? ex : 're-test ' + name + ': ' + r.failing[0]).slice(0, 200), note: ('The daily re-test failed this skill (tools/retest.mjs): ' + r.failing.join('; ')).slice(0, 300) });
  }
  return { open, queue: open ? [] : jobs.slice(0, 1), later: open ? jobs : jobs.slice(1) };
}

export const summary = ({ due, results, queued, dry }) => {
  const bad = Object.entries(results).filter(([, r]) => !r.ok);
  return ['### Verse re-tested its stale skills', '', '| What | How many |', '|:--|--:|', '| skills due (no test in ' + RETEST_DAYS + ' days) | ' + due.length + ' |',
    '| re-tested | ' + Object.keys(results).length + ' |', '| failed | ' + bad.length + ' |', '| queued for the builders | ' + (dry ? 'none (dry)' : queued.map((j) => '`' + j.target + '`').join(', ') || 0) + ' |',
    ...(bad.length ? ['', ...bad.map(([n, r]) => '- ' + n + ': ' + r.failing.join('; '))] : [])].join('\n');
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), dry = args.includes('--dry'), all = args.includes('--all'), one = args[args.indexOf('--skill') + 1];
  const today = new Date().toISOString().slice(0, 10);
  const fam = JSON.parse(readFileSync(resolve(dir, 'families.json'), 'utf8'));
  const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
  const due = args.includes('--skill') ? [{ name: one }] : all ? names.map((n) => ({ name: n })) : stale(fam, today);
  const mods = [], byName = {};
  for (const n of names) { const m = (await import(pathToFileURL(resolve(dir, n + '.js')).href)).default; mods.push(m); byName[m.name] = m; for (const p of m.family ? m.members : []) byName[p.name] = p; }
  const first = (a) => { const k = mods.find((s) => s.match(a.toLowerCase(), a)); return k ? k.name : null; };
  const runTest = (name) => { const file = name + '.test.mjs'; if (!existsSync(resolve(root, 'tools', file))) return null; const r = spawnSync(process.execPath, ['--test', resolve(root, 'tools', file)], { encoding: 'utf8', cwd: root, timeout: 300000 }); return { file, ok: r.status === 0, out: r.status === 0 ? '' : ((r.stdout || '') + (r.stderr || '')).split('\n').filter((l) => /^not ok|Error|expected|actual/.test(l)).slice(0, 3).join(' ') }; };
  const results = {};
  for (const d of due) { const m = byName[d.name]; if (!m) { results[d.name] = { ok: false, failing: ['not in skills/index.json'], test: null }; continue; } results[d.name] = retestOne(m, (a) => { const k = first(a); return k === m.name || (m.family && k) ? m.name : k; }, runTest); }
  const tok = (process.env.VOID_OWNER_TOKEN || process.env.VOID_MISSES_TOKEN || '').trim();
  let q = { items: [] }, queued = [];
  const api = async (path, method = 'GET', body) => { const res = await fetch(SITE + path, { method, headers: { 'user-agent': 'a2m-retest/1.0', authorization: 'Bearer ' + tok, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) }); if (!res.ok) throw new Error(path + ' answered ' + res.status); return res.json(); };
  if (!dry && tok) { try { q = await api('/api/queue'); } catch (e) { console.error('retest: could not read the queue: ' + e.message); } }
  const p = plan(results, q, byName);
  if (!dry && tok) for (const job of p.queue) { try { const r = await api('/api/queue', 'POST', { ask: job.ask, target: job.target }), it = r.item || {}; if (it.id && it.ask === job.ask) { await api('/api/queue', 'PATCH', { id: it.id, note: job.note }); queued.push(job); } } catch (e) { console.error('retest: could not queue ' + job.target + ': ' + e.message); } }
  if (!dry) writeFileSync(OUT, JSON.stringify({ note: 'the daily re-test of skills not tested in ' + RETEST_DAYS + ' days (tools/retest.mjs; asked by Verse): each loaded, its examples routed, its near misses kept out, its own unit test run. Read by tools/families.mjs: a passing skill was tested that day, a failing one has no passing self-test.', at: today, retested: results }, null, 1) + '\n');
  console.log(summary({ due, results, queued: dry ? p.queue : queued, dry }));
}
