// The fight in progress (void-live-deploy/tower.target.json): the site Verse is on stays the target until it is beaten, then the next smallest
// site takes over, so the target never flips when a new weight arrives. Run after each weighing (tower-size.yml) and by hand.
//   node tools/tower-target.mjs          set the target when none is set or the last one is beaten
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGone, isGone } from './tower-alive.mjs';
import { tower, towerArgs } from '../void-live-deploy/lib/tower.js';
import { overlay, readFloorDir } from './tower-files.mjs';

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
export const PASS_RUN = 40;
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
export function advance(old, floors, today, gone = {}) {
  const passed = (old.passed || []).slice(), background = (old.background || []).slice(), skipped = (old.skipped || []).slice(-20);
  const by = new Map(floors.map((f) => [f.id, f])), cur = old.id ? by.get(old.id) : null;
  let why = '';
  if (cur && (cur.cleared || cur.gateCleared) && !passed.some((r) => r.id === cur.id)) {
    passed.push({ id: cur.id, at: today, n: cur.n, m: cur.m, open: (cur.open || []).slice() });
    for (const r of backgroundOf(cur, today)) if (!background.some((b) => b.id === r.id && b.aspect === r.aspect)) background.push(r);
    why = 'passed ' + cur.id + ' (' + cur.n + '/' + cur.m + ', conquering in background)';
  }
  // a target whose domain is gone or parked (tools/tower-alive.mjs) gives way at once, logged, and never counts as passed
  if (!why && old.id && isGone(old.id, gone)) { const g = gone[Object.keys(gone).find((h) => isGone(old.id, { [h]: 1 }))]; skipped.push({ id: old.id, at: today, why: old.id + ' is ' + g.status + ': ' + g.why }); why = skipped[skipped.length - 1].why; }
  for (let i = passed.length - 1; i >= 0; i--) if (isGone(passed[i].id, gone)) passed.splice(i, 1);
  const st = old.id && !why ? stallCheck(old, floors, today) : { stalled: false };
  if (st.stalled) { skipped.push({ id: old.id, at: today, why: st.why }); why = st.why; }
  const away = new Set([...skipped.map((x) => x.id), ...passed.map((r) => r.id)]);
  const open = (f) => !f.beaten && !f.cleared && !f.held && !away.has(f.id) && !isGone(f.id, gone) && f.state !== 'passed';
  // a smaller site found or weighed since takes the Tower at once (owner, 2026-11-06: "all sites ever made smallest first"): the target is kept only
  // while it is still the smallest open site in the queue; the one it gives way to is smaller, so the fight never moves up in size
  const keep = old.id && !why && cur && !cur.beaten && !cur.cleared && !cur.gateCleared && !cur.held && (!old.season || (floors.find(open) || {}).id === old.id);
  let next = keep ? old.id : (floors.find(open) || {}).id || null;
  // a season (owner, 2026-11-06: the screen cleared and filled smallest first): the sites the gate already cleared pass again in their turn, the
  // smallest first, in this same run, so the screen fills with what was earned without a giant ever standing on it before a small site; the first
  // site the gate has not cleared becomes the target. At most PASS_RUN a run.
  for (let i = 0; !keep && next && i < PASS_RUN; i++) {
    const f = by.get(next); if (!f || !f.gateCleared) break;
    passed.push({ id: f.id, at: today, n: f.n, m: f.m, open: (f.open || []).slice() }); away.add(f.id);
    for (const r of backgroundOf(f, today)) if (!background.some((b) => b.id === r.id && b.aspect === r.aspect)) background.push(r);
    next = (floors.find(open) || {}).id || null;
  }
  const nf = by.get(next) || {};
  const about = 'The site Verse is taking on. It passes when Verse leads or ties on everything measured, is behind on nothing, meets Verse\'s own bar (fast, mobile, accessible, correct on its main job) and is better on one thing; the rest is conquered in the background. No site holds the Tower more than ' + HOLD_DAYS + ' day (tools/tower-target.mjs).';
  const base = { about, id: next, since: next === old.id ? old.since || today : today, n: next === old.id && st.n !== undefined ? st.n : nf.n || 0, progressAt: next === old.id ? st.progressAt || old.progressAt || today : today };
  if (old.season) base.season = old.season; if (old.archived) base.archived = old.archived;
  return { file: { ...base, ...(passed.length ? { passed } : {}), ...(background.length ? { background } : {}), ...(skipped.length ? { skipped } : {}), ...(why ? { last: { at: today, why } } : old.last ? { last: old.last } : {}) }, why };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // the evidence the site serves (tools/tower-files.mjs assemble: the aggregate with each floor's own file over it), never the bare aggregate:
  // a target worked out from older evidence than the card reads disagreed with the card, so the fight on the screen changed from load to load
  // and after each deploy (owner, 2026-11-06: "the whole tower keeps resetting")
  const old = rd('tower.target.json') || {}, ev = overlay(rd('tower.evidence.json') || { floors: {} }, readFloorDir());
  const args = towerArgs((rd('lap.items.json') || {}).onlySite || [], { ev, fr: rd('tower.frontier.json'), rk: rd('tower.rank.json'), sz: rd('tower.size.json'), tg: { ...old, id: null }, ft: rd('tower.features.json'), gn: rd('tower.gone.json') });
  const unlocked = tower(...args);
  const today = new Date().toISOString().slice(0, 10), { file, why } = advance(old, unlocked.floors, today, readGone());
  if (why) console.log(why);
  if (JSON.stringify(file) !== JSON.stringify(old)) fs.writeFileSync(OUT, JSON.stringify(file, null, 1) + '\n');
  console.log('target: ' + (file.id || 'none') + (file.id === old.id ? ' (kept)' : ' (new)'));
}
