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
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const old = rd('tower.target.json') || {}, ev = rd('tower.evidence.json') || {};
  const unlocked = tower((rd('lap.items.json') || {}).onlySite || [], ev.floors || {}, rd('tower.frontier.json'), null, rd('tower.rank.json'), rd('tower.size.json'), null);
  const id = nextTarget({ lock: old.id, floors: unlocked.floors });
  if (id && id !== old.id) fs.writeFileSync(OUT, JSON.stringify({ about: 'The site Verse is assimilating. It stays the target until it is beaten; then the next smallest site takes over (tools/tower-target.mjs).', id, since: new Date().toISOString().slice(0, 10) }, null, 1) + '\n');
  console.log('target: ' + (id || 'none') + (id === old.id ? ' (kept)' : ' (new)'));
}
