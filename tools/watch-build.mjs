#!/usr/bin/env node
// What Verse watched becomes a feature on a-to-mind.com, not an idea list (Atom, 2026-11-04; void-live-deploy/lib/watch-build.js has the why).
//   node tools/watch-build.mjs plan [--file notes.json]     this cycle's plan as JSON: the best idea, the page it improves or adds, the product
//   node tools/watch-build.mjs queue [--file notes.json]    queue every blueprint not built yet as a tv: build job, a few a run, best first
//                                                            (VOID_OWNER_TOKEN); conductor -> verse-job.yml builds each
//   node tools/watch-build.mjs assemble [--check]           domains/tv-built/*.json -> void-live-deploy/tv-built.json, the log /local/ shows
// tools/watch.py runs `queue` after every hour's learning, and the conductor runs queueBlueprints every hour whatever the watch does (owner,
// 2026-11-06: "the blueprints should just automatically be started and built into verse somewhere"). An idea with any job already (open,
// shipped, set aside) is not queued again; at most PER_RUN a run and BACKLOG_MAX open at once, so the rest wait for the next run instead of
// crowding out every other kind of work (the limits adapt the pace, they never stop the line).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { planCycle, planAll, jobOf, assembleLog } from '../void-live-deploy/lib/watch-build.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.VERSE_SITE || 'https://a-to-mind.com';
export const LOG_DIR = join(root, 'domains/tv-built'), OUT = join(root, 'void-live-deploy/tv-built.json');
export const PER_RUN = 3, BACKLOG_MAX = 6;

/** every page on the site as { route, title, desc }, from void-live-deploy/<dir>/index.html (one level, then one more). */
export function sitePages(dir = join(root, 'void-live-deploy')) {
  const out = [];
  const read = (rel) => {
    const f = join(dir, rel, 'index.html');
    if (!existsSync(f)) return;
    const h = readFileSync(f, 'utf8');
    const title = (/<title>([^<]*)/i.exec(h) || [])[1] || '', desc = (/<meta name="description" content="([^"]*)/i.exec(h) || [])[1] || '';
    if (title) out.push({ route: '/' + rel + '/', title: title.replace(/\s*·\s*Verse\s*$/, ''), desc });
  };
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || /^(lib|lab|skills|functions|vendor|data|_|\.)/.test(e.name)) continue;
    read(e.name);
    for (const s of readdirSync(join(dir, e.name), { withFileTypes: true })) if (s.isDirectory()) read(e.name + '/' + s.name);
  }
  return out;
}

/** the lineage files, each with its file name. */
export function entries(dir = LOG_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ ...JSON.parse(readFileSync(join(dir, f), 'utf8')), _file: 'domains/tv-built/' + f }));
}

/** the pull request that added a file to main: the squash commit's "(#123)", from git history (the deploy checks out all of it). */
export function prOf(file) {
  const r = spawnSync('git', ['log', '--diff-filter=A', '--format=%s', '--', file], { cwd: root, encoding: 'utf8' });
  const m = /\(#(\d+)\)\s*$/m.exec(String(r.stdout || '').trim().split('\n').pop() || '');
  return m ? Number(m[1]) : null;
}

async function notesFrom(argv) {
  const i = argv.indexOf('--file');
  if (i >= 0) { const j = JSON.parse(readFileSync(argv[i + 1], 'utf8')); return Array.isArray(j) ? j : j.notes || []; }
  const r = await fetch(SITE + '/api/watchalong?kind=idea&limit=200', { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('watchalong idea notes: ' + r.status);
  return (await r.json()).notes || [];
}

const builtKeys = () => entries().flatMap((e) => [e.slug, [e.source && e.source.medium, e.source && e.source.station, e.source && e.source.at].map((s) => String(s || '')).join('|').toLowerCase()]);
export function planNow(notes) {
  return planCycle(notes, { pages: sitePages(), built: builtKeys() });
}

/** which plans to queue this run: those whose target has no job yet (any state: an open one builds, a shipped one goes live, a set aside
 *  one was tried three times), best first, at most PER_RUN and no more than BACKLOG_MAX tv jobs open. rows: the queue's tv: rows. Pure. */
export function pickToQueue(plans, rows = [], { perRun = PER_RUN, backlog = BACKLOG_MAX } = {}) {
  const had = new Set(rows.map((r) => String(r.target || '').toLowerCase()));
  const open = rows.filter((r) => String(r.target || '').startsWith('tv:') && ['queued', 'building'].includes(r.state)).length;
  const room = Math.max(0, Math.min(perRun, backlog - open));
  const fresh = plans.filter((p) => !had.has(jobOf(p).target.toLowerCase()));
  return { take: fresh.slice(0, room), waiting: Math.max(0, fresh.length - room), open };
}

/** queue every blueprint not built yet: the idea notes, the site's pages, the built log and the queue's tv rows, then one POST per job.
 *  -> { queued: [target], waiting, open, said: [lines] }. Never throws for one job's refusal. */
export async function queueBlueprints({ token = process.env.VOID_OWNER_TOKEN, notes = null, dry = false, fetchFn = fetch } = {}) {
  const said = [];
  if (!notes) notes = await notesFrom([]);
  const plans = planAll(notes, { pages: sitePages(), built: builtKeys() });
  if (!plans.length) return { queued: [], waiting: 0, open: 0, said: ['none: every blueprint Verse wrote is built, queued or skipped'] };
  if (!token) return { queued: [], waiting: plans.length, open: 0, said: ['not queued (no VOID_OWNER_TOKEN): ' + plans.length + ' blueprint(s) wait'] };
  const auth = { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'user-agent': 'a2m-watch-build/1' };
  const g = await fetchFn(SITE + '/api/queue?state=' + encodeURIComponent('queued,building,done,set aside,failed') + '&kind=tv&limit=500', { headers: auth });
  if (!g.ok) return { queued: [], waiting: plans.length, open: 0, said: ['the queue answered ' + g.status + '; nothing queued this run'] };
  const rows = ((await g.json()).items || []).filter((r) => String(r.target || '').startsWith('tv:'));
  const { take, waiting, open } = pickToQueue(plans, rows);
  const queued = [];
  for (const plan of take) {
    const job = jobOf(plan), line = (plan.action === 'improve' ? 'improve ' : 'build ') + plan.page + ' ← ' + plan.topic + (plan.score.why ? ' (' + plan.score.why + ')' : '');
    if (dry) { said.push('would queue ' + job.target + ': ' + line); continue; }
    const r = await fetchFn(SITE + '/api/queue', { method: 'POST', headers: auth, body: JSON.stringify(job) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { queued.push(job.target); said.push('queued ' + (j.item && j.item.id) + ' ' + job.target + ': ' + line); } else said.push('queue refused ' + job.target + ': ' + r.status);
  }
  said.push(open + ' tv job(s) were open; ' + waiting + ' blueprint(s) wait for the next run');
  return { queued, waiting, open, said };
}

async function main(argv) {
  const cmd = argv[0] || 'plan';
  if (cmd === 'assemble') {
    const log = { updated: null, builds: assembleLog(entries(), prOf) };
    const text = JSON.stringify({ ...log, updated: log.builds[0] ? (log.builds[0].shipped || log.builds[0].source.day) : null }, null, 1) + '\n';
    if (argv.includes('--check')) { const ok = existsSync(OUT) && readFileSync(OUT, 'utf8') === text; console.log(ok ? 'tv-built.json is current' : 'tv-built.json is stale'); return ok ? 0 : 1; }
    writeFileSync(OUT, text); console.log('wrote ' + log.builds.length + ' build(s) to void-live-deploy/tv-built.json'); return 0;
  }
  if (cmd === 'plan') {
    const plan = planNow(await notesFrom(argv));
    if (!plan) { console.log('none: no idea worth building this cycle'); return 0; }
    console.log(JSON.stringify(plan, null, 1)); return 0;
  }
  if (cmd === 'queue') {
    const out = await queueBlueprints({ notes: await notesFrom(argv), dry: argv.includes('--dry') });
    for (const l of out.said) console.log(l);
    return 0;
  }
  console.error('usage: node tools/watch-build.mjs plan|queue|assemble [--file notes.json] [--check] [--dry]'); return 2;
}

if (process.argv[1] && process.argv[1].endsWith('watch-build.mjs')) main(process.argv.slice(2)).then((c) => process.exit(c || 0)).catch((e) => { console.error(String(e.message || e)); process.exit(0); });
