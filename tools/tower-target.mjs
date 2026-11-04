// The fight in progress (void-live-deploy/tower.target.json): the site Verse is on stays the target until it is beaten, then the next smallest
// site takes over, so the target never flips when a new weight arrives. Run after each weighing (tower-size.yml) and by hand.
//   node tools/tower-target.mjs          set the target when none is set or the last one is beaten
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tower } from '../void-live-deploy/lib/tower.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), SITE = path.join(ROOT, 'void-live-deploy'), OUT = path.join(SITE, 'tower.target.json');
const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SITE, f), 'utf8')); } catch (_) { return null; } };
/** the next target: the locked site while it is unbeaten and not held, else the easiest unbeaten site (no lock applied). Pure. */
export function nextTarget({ lock, floors }) {
  const by = new Map(floors.map((f) => [f.id, f]));
  if (lock && by.has(lock) && !by.get(lock).beaten && !by.get(lock).held) return lock;
  return (floors.find((f) => f.state === 'current') || floors.find((f) => !f.beaten) || {}).id || null;
}
// a stalled target (owner, 2026-11-03: "still no page, get us unstuck on the tower"): a target whose aspects ahead have not grown for STALL_DAYS
// days gives way to the next easiest site, and the target file says which site gave way and why, so the tower never sits on one site for good.
export const STALL_DAYS = 3;
/** the target after a stall check: { id, n, progressAt, stalled } from the old file, the lock's floor now and today's date (YYYY-MM-DD). Pure. */
export function stallCheck(old, floors, today, days = STALL_DAYS) {
  const f = floors.find((x) => x.id === old.id); if (!f || f.beaten) return { stalled: false };
  const n = f.n || 0, since = old.progressAt || old.since || today;
  if (!Number.isFinite(+old.n) || n > +old.n) return { stalled: false, n, progressAt: today };
  const age = (Date.parse(today) - Date.parse(since)) / 864e5;
  return age >= days ? { stalled: true, n, progressAt: since, why: old.id + ' stayed at ' + n + ' of ' + (f.m || 0) + ' aspects ahead since ' + since + ' (' + Math.round(age) + ' days), so the next easiest site takes over' } : { stalled: false, n, progressAt: since };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const old = rd('tower.target.json') || {}, ev = rd('tower.evidence.json') || {};
  const unlocked = tower((rd('lap.items.json') || {}).onlySite || [], ev.floors || {}, rd('tower.frontier.json'), null, rd('tower.rank.json'), rd('tower.size.json'), null);
  const today = new Date().toISOString().slice(0, 10), st = old.id ? stallCheck(old, unlocked.floors, today) : { stalled: false };
  const skipped = (old.skipped || []).slice(-20), passed = new Set(skipped.map((x) => x.id));
  if (st.stalled) { skipped.push({ id: old.id, at: today, why: st.why }); passed.add(old.id); console.log('stalled: ' + st.why); }
  const id = st.stalled ? (unlocked.floors.find((f) => !f.beaten && !f.held && !passed.has(f.id)) || {}).id || null : nextTarget({ lock: old.id, floors: unlocked.floors });
  const about = 'The site Verse is assimilating. It stays the target until it is beaten or stalls (no aspect gained for ' + STALL_DAYS + ' days); then the next smallest site takes over (tools/tower-target.mjs).';
  const nf = unlocked.floors.find((f) => f.id === id) || {};
  if (id && id !== old.id) fs.writeFileSync(OUT, JSON.stringify({ about, id, since: today, n: nf.n || 0, progressAt: today, ...(skipped.length ? { skipped } : {}) }, null, 1) + '\n');
  else if (id && (st.n !== old.n || st.progressAt !== old.progressAt)) fs.writeFileSync(OUT, JSON.stringify({ ...old, about, n: st.n, progressAt: st.progressAt }, null, 1) + '\n');
  console.log('target: ' + (id || 'none') + (id === old.id ? ' (kept)' : ' (new)'));
}
