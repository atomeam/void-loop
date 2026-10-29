// Upkeep automations (owner, 2026-10-15: "add automations ... everywhere you can to hyperize productivity and progress").
// One small file of pure helpers plus a CLI per job, run by .github/workflows/upkeep.yml. Every job is safe to run any time:
// it reads, writes one data file only when something changed, or warns; nothing waits on a person.
//   node tools/upkeep.mjs clips-stats      /c/_stats (owner token) -> domains/void.clips.json visits per moment
//   node tools/upkeep.mjs handoff-done <branch> <pr-url>   Working on line(s) for that branch -> Just finished
//   node tools/upkeep.mjs piped            probe the public Piped hosts in functions/api/video.js -> domains/void.piped.json
//   node tools/upkeep.mjs links            every URL in sitemap.xml and llms.txt answers (warns, never fails the run)
//   node tools/upkeep.mjs stale [--apply]  remote branches merged into main and idle 14+ days, with no open PR (deletes only with --apply)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..');
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';

/** visits per moment from /c/_stats rows ({ clip: '20261015-clock-mini', platform, visits }). Pure. */
export function visitsByMoment(rows) {
  const out = {};
  for (const r of rows || []) {
    const m = /^\d{8}-(.+)$/.exec(String(r.clip || '')); if (!m) continue;
    out[m[1]] = (out[m[1]] || 0) + (+r.visits || 0);
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

/** move every Working on line that names `branch` to the top of Just finished, with the PR link. Pure; returns the same text when nothing matches. */
export function handoffDone(md, branch, prUrl, today = new Date().toISOString().slice(0, 10)) {
  const lines = md.split('\n'), w = lines.indexOf('## Working on'), j = lines.indexOf('## Just finished');
  if (w < 0 || j < 0 || !branch) return md;
  const end = (i) => { let k = i + 1; while (k < lines.length && !/^## /.test(lines[k])) k++; return k; };
  const we = end(w), mine = [], keep = [];
  const tag = new RegExp('·\\s*' + branch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '\\s*·');
  for (let i = w + 1; i < we; i++) (/^- /.test(lines[i]) && tag.test(lines[i]) ? mine : keep).push(lines[i]);
  if (!mine.length) return md;
  const done = mine.map((l) => { const p = l.replace(/^- /, '').split('·').map((x) => x.trim()); return `- **${p[2] || branch} (${p[0] || 'builder'}, ${today})**: shipped in ${prUrl}.`; });
  const out = [...lines.slice(0, w + 1), ...keep, ...lines.slice(we)];
  const j2 = out.indexOf('## Just finished'); let at = j2 + 1; while (at < out.length && out[at] === '') at++;
  out.splice(at, 0, ...done);
  return out.join('\n');
}

const ghJson = (args) => JSON.parse(execFileSync('gh', args, { encoding: 'utf8', timeout: 120e3 }));

async function main(cmd, a) {
  if (cmd === 'clips-stats') {
    const tok = process.env.VOID_OWNER_TOKEN; if (!tok) { console.log('::warning::VOID_OWNER_TOKEN not set; clip visits not copied'); return; }
    const r = await fetch(SITE + '/c/_stats', { headers: { authorization: 'Bearer ' + tok } });
    if (!r.ok) { console.log('::warning::/c/_stats answered ' + r.status); return; }
    const f = path.join(root, 'domains/void.clips.json'), d = JSON.parse(fs.readFileSync(f, 'utf8'));
    d.visits = visitsByMoment((await r.json()).visits); fs.writeFileSync(f, JSON.stringify(d, null, 1) + '\n');
    console.log('visits', JSON.stringify(d.visits));
  } else if (cmd === 'handoff-done') {
    const f = path.join(root, 'domains/handoff.md'), md = fs.readFileSync(f, 'utf8'), next = handoffDone(md, a[0], a[1]);
    if (next !== md) { fs.writeFileSync(f, next); console.log('moved', a[0]); } else console.log('no Working on line for', a[0]);
  } else if (cmd === 'piped') {
    const src = fs.readFileSync(path.join(root, 'void-live-deploy/functions/api/video.js'), 'utf8');
    const hosts = JSON.parse((/export const PIPED = (\[[^\]]*\])/.exec(src) || [, '[]'])[1].replace(/'/g, '"'));
    const res = await Promise.all(hosts.map(async (h) => { // all hosts at once
      const t0 = Date.now(); let ok = false, status = 0;
      try { const r = await fetch(h + '/search?filter=videos&q=black%20holes', { signal: AbortSignal.timeout(6000) }); status = r.status; ok = r.ok && Array.isArray((await r.json()).items); } catch (_) {}
      return { host: h, ok, status, ms: Date.now() - t0 };
    }));
    const f = path.join(root, 'domains/void.piped.json'), alive = res.filter((x) => x.ok).map((x) => x.host);
    const prev = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
    console.log(JSON.stringify(res));
    if (!alive.length) console.log('::warning title=No Piped host answers::keyless YouTube search falls back to Wikidata only; re-probe hosts and edit PIPED in functions/api/video.js');
    if (JSON.stringify(prev.alive) !== JSON.stringify(alive)) fs.writeFileSync(f, JSON.stringify({ note: 'Public Piped hosts that answered a search (tools/upkeep.mjs piped, daily). Written only when the set changes.', checked: new Date().toISOString().slice(0, 10), alive, hosts: res.map(({ host, ok, status }) => ({ host, ok, status })) }, null, 1) + '\n');
  } else if (cmd === 'links') {
    const urls = new Set();
    for (const f of ['void-live-deploy/sitemap.xml', 'void-live-deploy/llms.txt']) for (const m of fs.readFileSync(path.join(root, f), 'utf8').matchAll(/https?:\/\/[^\s<>"')\]]+/g)) urls.add(m[0].replace(/[.,]$/, ''));
    const codes = await Promise.all([...urls].map(async (u) => { // all links at once, one timeout each
      try { return [u, (await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'user-agent': 'Verse-linkcheck' } })).status]; } catch (_) { return [u, 0]; }
    }));
    let bad = 0;
    for (const [u, s] of codes) if (!(s >= 200 && s < 400) && ![401, 403, 405, 429].includes(s)) { bad++; console.log(`::warning title=Dead link::${u} answered ${s || 'nothing'}`); }
    console.log(`${urls.size} links, ${bad} dead`);
  } else if (cmd === 'stale') { // local git only (one call per branch to the API took minutes): needs a full fetch of origin
    const repo = process.env.GITHUB_REPOSITORY || 'atomeam/void-loop', apply = a.includes('--apply'), cutoff = Date.now() / 1000 - 14 * 86400;
    const open = new Set(ghJson(['pr', 'list', '-R', repo, '--state', 'open', '--limit', '200', '--json', 'headRefName']).map((p) => p.headRefName));
    const git = (...x) => execFileSync('git', x, { encoding: 'utf8', cwd: root, timeout: 120e3 }).trim();
    const merged = git('branch', '-r', '--merged', 'origin/main', '--format=%(refname:short) %(committerdate:unix)').split('\n').filter(Boolean);
    let n = 0;
    for (const line of merged) {
      const [ref, t] = line.split(' '), name = ref.replace(/^origin\//, '');
      if (!ref.startsWith('origin/') || ['main', 'HEAD', 'origin'].includes(name) || open.has(name) || !(+t < cutoff)) continue;
      n++; console.log((apply ? 'deleting ' : 'would delete ') + name);
      if (apply) { try { git('push', 'origin', '--delete', name); } catch (e) { console.log('::warning::could not delete ' + name); } }
    }
    console.log(n + ' merged, idle branches');
  } else { console.log('usage: see the top of tools/upkeep.mjs'); process.exitCode = 2; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main(process.argv[2], process.argv.slice(3));
