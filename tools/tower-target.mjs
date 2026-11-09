// The floor Verse is on (void-live-deploy/tower.target.json): it stays the floor until it is assimilated, then the next closest floor takes over
// (docs/TOWER-RULES.md). Run after each gate landing and weighing (tower-gate.yml, tower-size.yml) and by hand.
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
// No timed give-way (docs/TOWER-RULES.md rule 3): the floor Verse is on stays the floor until the gate verifies EVERY aspect
// (lib/tower.js gate().beaten) and its study has nothing missing; then it is assimilated and the next closest floor takes over in the same run.
// Until 2026-11-09 a target gave way after HOLD_DAYS (3 days from 2026-11-03, then 1 day), and a site "passed" with aspects still open; both
// put unverified wins and stub pages on the card. A floor with no progress for RETRY_DAYS is retried (its open aspects re-queued for the gate
// and the build queue), never dropped. The old `passed` and `skipped` lists stay in the file as records.
export const HOLD_DAYS = Infinity;
export const RETRY_DAYS = 1;
export const PASS_RUN = 40;
export const STALL_DAYS = HOLD_DAYS; // the old name
/** the hold check: never stalled (no timed give-way); { stalled: false, n, progressAt, retry } where retry says a floor with no progress for
 *  RETRY_DAYS gets its open aspects re-measured. Pure. */
export function stallCheck(old, floors, today, days = RETRY_DAYS) {
  const f = floors.find((x) => x.id === old.id); if (!f || f.beaten) return { stalled: false };
  const n = f.n || 0, since = old.since || old.progressAt || today, progressAt = !Number.isFinite(+old.n) || n > +old.n ? today : old.progressAt || since;
  const idle = (Date.parse(today) - Date.parse(progressAt)) / 864e5;
  return { stalled: false, n, progressAt, retry: idle >= days };
}
/** the background work a passed site leaves: one row per aspect still open (questions to write for accuracy and completeness, the journeys to
 *  script). Pure. */
export const backgroundOf = (f, today) => (f.open || f.left || []).filter((a) => !(f.lost || []).includes(a)).map((a) => ({ id: f.id, aspect: a, since: today, job: /^journey/.test(a) ? 'script the journey with steps and negative controls' : a === 'accuracy' ? 'write the question and work out its answer (tools/tower-probes.mjs truth)' : a === 'completeness' ? 'list what the best sites in the category show (tools/tower-probes.mjs facts)' : 'measure it in tools/tower-gate.mjs' }));
/** one run: the old target file and the floors (tower() with the assimilated list) to the new file. Pure. */
export function advance(old, floors, today, gone = {}) {
  const assimilated = (old.assimilated || []).slice(), background = (old.background || []).slice(), skipped = (old.skipped || []).slice(-20);
  const by = new Map(floors.map((f) => [f.id, f])), cur = old.id ? by.get(old.id) : null;
  let why = '';
  const take = (f) => { assimilated.push({ id: f.id, at: today, n: f.n, m: f.m }); };
  if (cur && (cur.beaten || cur.gateBeaten) && !assimilated.some((r) => r.id === cur.id)) { take(cur); why = 'assimilated ' + cur.id + ' (' + cur.m + ' of ' + cur.m + ' aspects verified)'; }
  // a floor whose domain is gone or parked (tools/tower-alive.mjs), or a non-site, is not a floor: logged, never counted, and the next one takes over
  const settled = (old.settled || []).slice();
  for (const [h, g] of Object.entries(gone)) if (g && g.status === 'non-site' && !settled.some((x) => x.id === h)) settled.push({ id: h, at: today, as: 'non-site', kind: g.kind || 'a non-site', why: g.why });
  if (!why && old.id && isGone(old.id, gone)) { const g = gone[Object.keys(gone).find((h) => isGone(old.id, { [h]: 1 }))]; skipped.push({ id: old.id, at: today, why: g.status === 'non-site' ? 'settled ' + old.id + ' as a non-site (' + (g.kind || 'nothing on it to use') + '): ' + g.why : old.id + ' is ' + g.status + ': ' + g.why }); why = skipped[skipped.length - 1].why; }
  // a target that is no floor any more (a stub or unstudied site the old smallest-first queue picked) is replaced by the closest real floor
  if (!why && old.id && !cur) { skipped.push({ id: old.id, at: today, why: old.id + ' is not a floor: not a studied, real site (docs/TOWER-RULES.md rule 1)' }); why = skipped[skipped.length - 1].why; }
  // a gone site never counts: it leaves the assimilated list and the old passed record
  const passed = (old.passed || []).filter((r) => !isGone(r.id, gone));
  for (let i = assimilated.length - 1; i >= 0; i--) if (isGone(assimilated[i].id, gone)) assimilated.splice(i, 1);
  const st = old.id && !why ? stallCheck(old, floors, today) : { stalled: false };
  const away = new Set([...assimilated.map((r) => r.id), ...settled.map((x) => x.id)]);
  const open = (f) => !f.beaten && !f.held && !away.has(f.id) && !isGone(f.id, gone);
  const keep = old.id && !why && cur && open(cur);
  let next = keep ? old.id : (floors.find((f) => f.state === 'current' && open(f)) || floors.find(open) || {}).id || null;
  // floors the gate already verified on every aspect are assimilated in their turn, in this same run (at most PASS_RUN)
  for (let i = 0; !keep && next && i < PASS_RUN; i++) {
    const f = by.get(next); if (!f || !f.gateBeaten) break;
    take(f); away.add(f.id); next = (floors.find(open) || {}).id || null;
  }
  // a retry (no progress for RETRY_DAYS): the open aspects go back to the gate and the build queue, the floor stays
  if (keep && st.retry && cur) for (const r of backgroundOf(cur, today)) if (!background.some((b) => b.id === r.id && b.aspect === r.aspect)) background.push({ ...r, job: 'retry: ' + r.job });
  const nf = by.get(next) || {};
  const about = 'The floor Verse is on. It is assimilated only when the gate verifies every aspect against the live site and its feature study has nothing missing; until then it stays the floor and low-confidence aspects are retried (docs/TOWER-RULES.md, tools/tower-target.mjs).';
  const base = { about, id: next, since: next === old.id ? old.since || today : today, n: next === old.id && st.n !== undefined ? st.n : nf.n || 0, progressAt: next === old.id ? st.progressAt || old.progressAt || today : today };
  if (old.season) base.season = old.season; if (old.archived) base.archived = old.archived;
  return { file: { ...base, assimilated, ...(passed.length ? { passed } : {}), ...(background.length ? { background } : {}), ...(skipped.length ? { skipped } : {}), ...(settled.length ? { settled: settled.slice(-40) } : {}), ...(why ? { last: { at: today, why } } : old.last ? { last: old.last } : {}) }, why };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // the evidence the site serves (tools/tower-files.mjs assemble: the aggregate with each floor's own file over it), never the bare aggregate:
  // a target worked out from older evidence than the card reads disagreed with the card, so the fight on the screen changed from load to load
  // and after each deploy (owner, 2026-11-06: "the whole tower keeps resetting")
  const old = rd('tower.target.json') || {}, ev = overlay(rd('tower.evidence.json') || { floors: {} }, readFloorDir());
  const args = towerArgs((rd('lap.items.json') || {}).onlySite || [], { ev, fr: rd('tower.frontier.json'), rk: rd('tower.rank.json'), sz: rd('tower.size.json'), tg: { assimilated: [], ...old, id: null }, ft: rd('tower.features.json'), gn: rd('tower.gone.json'), pa: rd('parity.json') });
  const unlocked = tower(...args);
  const today = new Date().toISOString().slice(0, 10), { file, why } = advance(old, unlocked.floors, today, readGone());
  if (why) console.log(why);
  if (JSON.stringify(file) !== JSON.stringify(old)) fs.writeFileSync(OUT, JSON.stringify(file, null, 1) + '\n');
  console.log('target: ' + (file.id || 'none') + (file.id === old.id ? ' (kept)' : ' (new)'));
}
