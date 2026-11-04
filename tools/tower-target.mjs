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
// Never waiting (owner, 2026-11-03: "the purpose of the tower is not to get stuck waiting for a grade or comparison, its to confidently outclass
// and outperform and move on. stuck on vat for over a week does not scream confidence"):
//   - a target the gate PASSED (lib/tower.js gate().cleared: ahead or equal on all measured, none behind, Verse's bar met, better on one thing)
//     goes on the `passed` list and the next easiest site takes over in the same run; its open aspects go to `background` to be measured later
//   - a passed site never moves back: a later loss shows on the card as "fixing" (lib/tower.js `behind`) and is a fix job, not a demotion
//   - hard limit: no target holds the Tower for more than HOLD_DAYS; then it gives way and the file says why
export const HOLD_DAYS = 1;
export const STALL_DAYS = HOLD_DAYS; // the old name (tests and the card's note read it)
/** the target after the hold check: { stalled, why } from the old file, the lock's floor now and today's date (YYYY-MM-DD). Pure. */
export function stallCheck(old, floors, today, days = HOLD_DAYS) {
  const f = floors.find((x) => x.id === old.id); if (!f || f.beaten || f.cleared) return { stalled: false };
  const n = f.n || 0, since = old.since || old.progressAt || today, progressAt = !Number.isFinite(+old.n) || n > +old.n ? today : old.progressAt || since;
  const age = (Date.parse(today) - Date.parse(since)) / 864e5;
  return age >= days ? { stalled: true, n, progressAt, why: old.id + ' held the Tower since ' + since + ' (' + Math.round(age) + ' day' + (Math.round(age) === 1 ? '' : 's') + ', limit ' + days + ') at ' + n + ' of ' + (f.m || 0) + ' aspects ahead, so it gives way and keeps being measured in the background' } : { stalled: false, n, progressAt };
}
/** the background work a passed site leaves: one row per aspect still open (questions to write for accuracy and completeness, the journeys to
 *  script). Pure. */
export const backgroundOf = (f, today) => (f.open || f.left || []).filter((a) => !(f.lost || []).includes(a)).map((a) => ({ id: f.id, aspect: a, since: today, job: /^journey/.test(a) ? 'script the journey with steps and negative controls' : a === 'accuracy' ? 'write the question and work out its answer (tools/tower-probes.mjs truth)' : a === 'completeness' ? 'list what the best sites in the category show (tools/tower-probes.mjs facts)' : 'measure it in tools/tower-gate.mjs' }));
/** one run: the old target file and the floors (tower() with the passed list) to the new file. Pure. */
export function advance(old, floors, today) {
  const passed = (old.passed || []).slice(), background = (old.background || []).slice(), skipped = (old.skipped || []).slice(-20);
  const by = new Map(floors.map((f) => [f.id, f])), cur = old.id ? by.get(old.id) : null;
  let why = '';
  if (cur && cur.cleared && !passed.some((r) => r.id === cur.id)) {
    passed.push({ id: cur.id, at: today, n: cur.n, m: cur.m, open: (cur.open || []).slice() });
    for (const r of backgroundOf(cur, today)) if (!background.some((b) => b.id === r.id && b.aspect === r.aspect)) background.push(r);
    why = 'passed ' + cur.id + ' (' + cur.n + '/' + cur.m + ', conquering in background)';
  }
  const st = old.id && !why ? stallCheck(old, floors, today) : { stalled: false };
  if (st.stalled) { skipped.push({ id: old.id, at: today, why: st.why }); why = st.why; }
  const away = new Set([...skipped.map((x) => x.id), ...passed.map((r) => r.id)]);
  const keep = old.id && !why && cur && !cur.beaten && !cur.cleared && !cur.held;
  const next = keep ? old.id : (floors.find((f) => !f.beaten && !f.cleared && !f.held && !away.has(f.id) && f.state !== 'passed') || {}).id || null;
  const nf = by.get(next) || {};
  const about = 'The site Verse is taking on. It passes when Verse leads or ties on everything measured, is behind on nothing, meets Verse\'s own bar (fast, mobile, accessible, correct on its main job) and is better on one thing; the rest is conquered in the background. No site holds the Tower more than ' + HOLD_DAYS + ' day (tools/tower-target.mjs).';
  const base = { about, id: next, since: next === old.id ? old.since || today : today, n: next === old.id && st.n !== undefined ? st.n : nf.n || 0, progressAt: next === old.id ? st.progressAt || old.progressAt || today : today };
  return { file: { ...base, ...(passed.length ? { passed } : {}), ...(background.length ? { background } : {}), ...(skipped.length ? { skipped } : {}), ...(why ? { last: { at: today, why } } : old.last ? { last: old.last } : {}) }, why };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const old = rd('tower.target.json') || {}, ev = rd('tower.evidence.json') || {};
  const ids = (old.passed || []).map((r) => r.id);
  const unlocked = tower((rd('lap.items.json') || {}).onlySite || [], ev.floors || {}, rd('tower.frontier.json'), null, rd('tower.rank.json'), rd('tower.size.json'), null, ids);
  const today = new Date().toISOString().slice(0, 10), { file, why } = advance(old, unlocked.floors, today);
  if (why) console.log(why);
  if (JSON.stringify(file) !== JSON.stringify(old)) fs.writeFileSync(OUT, JSON.stringify(file, null, 1) + '\n');
  console.log('target: ' + (file.id || 'none') + (file.id === old.id ? ' (kept)' : ' (new)'));
}
