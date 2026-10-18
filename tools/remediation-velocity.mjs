// Remediation velocity (asked by Verse: "a 'remediation-velocity' metric that tracks how quickly a 'miss' on the bench is converted back into a
// 'proven' skill"): from the history of skills/families.json, how long a skill that was failing (a benchmark success rate under 100%, or a
// daily-test finding) took to be proven again. A skill is "missing" from the first snapshot where it shows a failure while not proven; it is
// converted at the first later snapshot where it is proven with no failure. Skills still missing are listed with how long.
//   node tools/remediation-velocity.mjs           write void-live-deploy/remediation.json (needs the git history of families.json)
//   node tools/remediation-velocity.mjs --print   print it, write nothing
// Regenerate and commit it when you want the card ("how fast do you fix your misses") to move: a shallow checkout has no history to read.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = 'void-live-deploy/skills/families.json', OUT = resolve(root, 'void-live-deploy/remediation.json');
const DAY = 864e5;

/** the failing / proven state of every skill in one families.json. Pure. */
export function stateOf(fam) {
  const out = {};
  for (const f of (fam && Array.isArray(fam.families) ? fam.families : [])) for (const s of (f && f.skills) || []) {
    if (!s || !s.name) continue;
    const failing = (Array.isArray(s.smoke) && s.smoke.length > 0) || (typeof s.success_rate === 'number' && s.success_rate < 1);
    out[s.name] = { proven: s.tier === 'proven', failing };
  }
  return out;
}

/** snapshots [{ at: ISO, state }] oldest first -> { converted, open, medianDays, windowDays }. Pure. */
export function velocityOf(snaps, now = Date.now()) {
  const missing = new Map(), converted = [];
  for (const sn of snaps) {
    const t = Date.parse(sn.at); if (!Number.isFinite(t)) continue;
    for (const [name, st] of Object.entries(sn.state)) {
      if (!st.proven && st.failing) { if (!missing.has(name)) missing.set(name, t); }
      else if (st.proven && !st.failing && missing.has(name)) { const from = missing.get(name); converted.push({ skill: name, missedAt: new Date(from).toISOString(), provenAt: sn.at, days: Math.round((t - from) / DAY * 10) / 10 }); missing.delete(name); }
    }
  }
  const last = snaps.length ? snaps[snaps.length - 1].state : {};
  const open = [...missing].filter(([n]) => last[n] && !last[n].proven).map(([skill, from]) => ({ skill, sinceDays: Math.round((now - from) / DAY * 10) / 10 })).sort((a, b) => b.sinceDays - a.sinceDays);
  const d = converted.map((c) => c.days).sort((a, b) => a - b);
  const median = d.length ? (d.length % 2 ? d[(d.length - 1) / 2] : Math.round((d[d.length / 2 - 1] + d[d.length / 2]) / 2 * 10) / 10) : null;
  const first = snaps.length ? Date.parse(snaps[0].at) : now;
  return { windowDays: Math.round((now - first) / DAY * 10) / 10, converted: converted.slice(-30).reverse(), convertedTotal: converted.length, medianDays: median, open: open.slice(0, 30), openTotal: open.length };
}

function history(file = FILE) {
  const log = execFileSync('git', ['log', '--reverse', '--format=%H %cI', '--', file], { cwd: root, encoding: 'utf8', timeout: 60e3 }).trim().split('\n').filter(Boolean);
  const snaps = [];
  for (const line of log) {
    const [sha, at] = line.split(' ');
    try { snaps.push({ at, state: stateOf(JSON.parse(execFileSync('git', ['show', sha + ':' + file], { cwd: root, encoding: 'utf8', maxBuffer: 64e6, timeout: 30e3 }))) }); } catch (_) { /* a commit where the file did not parse is skipped */ }
  }
  return snaps;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snaps = history();
  if (!snaps.length) { console.error('remediation-velocity: no history of ' + FILE + ' here (a shallow checkout?); nothing written'); process.exit(1); }
  const now = new Date(), v = { note: 'How long a failing skill took to be proven again, from the history of skills/families.json (tools/remediation-velocity.mjs; asked by Verse).', at: now.toISOString(), snapshots: snaps.length, ...velocityOf(snaps, now.getTime()) };
  if (process.argv.includes('--print')) console.log(JSON.stringify(v, null, 1));
  else { writeFileSync(OUT, JSON.stringify(v, null, 1) + '\n'); console.log('remediation-velocity: ' + v.convertedTotal + ' converted, median ' + (v.medianDays == null ? 'n/a' : v.medianDays + ' days') + ', ' + v.openTotal + ' still missing (' + v.snapshots + ' snapshots)'); }
}
