#!/usr/bin/env node
// What Verse watched becomes a feature on a-to-mind.com, not an idea list (Atom, 2026-11-04; void-live-deploy/lib/watch-build.js has the why).
//   node tools/watch-build.mjs plan [--file notes.json]     this cycle's plan as JSON: the best idea, the page it improves or adds, the product
//   node tools/watch-build.mjs queue [--file notes.json]    queue it as one tv: build job (VOID_OWNER_TOKEN); conductor -> verse-job.yml builds it
//   node tools/watch-build.mjs assemble [--check]           domains/tv-built/*.json -> void-live-deploy/tv-built.json, the log /local/ shows
// tools/watch.py runs `queue` after every hour's learning. A job for the same idea already open is not queued twice (/api/queue answers it).
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { planCycle, jobOf, assembleLog } from '../void-live-deploy/lib/watch-build.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.VERSE_SITE || 'https://a-to-mind.com';
export const LOG_DIR = join(root, 'domains/tv-built'), OUT = join(root, 'void-live-deploy/tv-built.json');

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
    if (!e.isDirectory() || /^(lib|skills|functions|vendor|data|_|\.)/.test(e.name)) continue;
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
  const r = await fetch(SITE + '/api/watchalong?kind=idea&limit=60', { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('watchalong idea notes: ' + r.status);
  return (await r.json()).notes || [];
}

export function planNow(notes) {
  const built = entries().flatMap((e) => [e.slug, [e.source && e.source.medium, e.source && e.source.station, e.source && e.source.at].map((s) => String(s || '')).join('|').toLowerCase()]);
  return planCycle(notes, { pages: sitePages(), built });
}

async function main(argv) {
  const cmd = argv[0] || 'plan';
  if (cmd === 'assemble') {
    const log = { updated: null, builds: assembleLog(entries(), prOf) };
    const text = JSON.stringify({ ...log, updated: log.builds[0] ? (log.builds[0].shipped || log.builds[0].source.day) : null }, null, 1) + '\n';
    if (argv.includes('--check')) { const ok = existsSync(OUT) && readFileSync(OUT, 'utf8') === text; console.log(ok ? 'tv-built.json is current' : 'tv-built.json is stale'); return ok ? 0 : 1; }
    writeFileSync(OUT, text); console.log('wrote ' + log.builds.length + ' build(s) to void-live-deploy/tv-built.json'); return 0;
  }
  const plan = planNow(await notesFrom(argv));
  if (!plan) { console.log('none: no idea worth building this cycle'); return 0; }
  if (cmd === 'plan') { console.log(JSON.stringify(plan, null, 1)); return 0; }
  if (cmd === 'queue') {
    const job = jobOf(plan), token = process.env.VOID_OWNER_TOKEN;
    console.log((plan.action === 'improve' ? 'improve ' : 'build ') + plan.page + ' ← ' + plan.topic + ' (' + plan.score.why + '); earns via ' + plan.product.url);
    if (!token || argv.includes('--dry')) { console.log('not queued (' + (token ? '--dry' : 'no VOID_OWNER_TOKEN') + '): ' + JSON.stringify(job)); return 0; }
    const r = await fetch(SITE + '/api/queue', { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'user-agent': 'a2m-watch-build/1' }, body: JSON.stringify(job) });
    const j = await r.json().catch(() => ({}));
    console.log(r.ok ? 'queued ' + (j.item && j.item.id) + ' ' + job.target + (j.item && j.item.state !== 'queued' ? ' (already ' + j.item.state + ')' : '') : 'queue refused: ' + r.status);
    return 0;
  }
  console.error('usage: node tools/watch-build.mjs plan|queue|assemble [--file notes.json] [--check] [--dry]'); return 2;
}

if (process.argv[1] && process.argv[1].endsWith('watch-build.mjs')) main(process.argv.slice(2)).then((c) => process.exit(c || 0)).catch((e) => { console.error(String(e.message || e)); process.exit(0); });
