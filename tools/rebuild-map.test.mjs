// The map (skills/rebuild-map.js) tells the truth about what is built: every skill a row names exists in skills/, the game
// count is the game rack's, and no row still says "not started" or "queued" for something that is live. The map went three
// weeks out of date before anything checked it (the growth card listed it as the one skill nothing checked, 2026-10-14).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url)), skills = path.resolve(here, '../void-live-deploy/skills');
const map = await import('../void-live-deploy/skills/rebuild-map.js'), { GAMES } = await import('../void-live-deploy/skills/rack.js');
const { MAP } = map, skill = map.default;
assert.equal(MAP.length, 13);
for (const r of MAP) {
  for (const m of r.s.matchAll(/\b([a-z][a-z-]*?) (?:and ([a-z][a-z-]*) )?skills?\b/g)) for (const n of [m[1], m[2]].filter(Boolean))
    assert.ok(fs.existsSync(path.join(skills, n + '.js')), 'row ' + r.n + ' names a "' + n + '" skill that is not in skills/');
  assert.doesNotMatch(r.s, /not started|queued/, 'row ' + r.n + ' still says "' + r.s + '"');
}
const games = MAP.find((r) => r.p === 'Player Two').s.match(/(\d+) games/);
assert.ok(games && Number(games[1]) === GAMES.length, 'Player Two says ' + (games && games[1]) + ' games; the rack has ' + GAMES.length);
for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), a);
for (const a of ['show me the map of paris', 'map of france']) assert.ok(!skill.match(a, a), a);
console.log('rebuild-map: ok');
