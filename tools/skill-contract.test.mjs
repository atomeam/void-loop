// Skill contract for skills no other test named (tools/untested.mjs): each one takes its own examples and leaves its near misses, the
// promise the router (skills/index.json) and the book (skills/guide.json) are built on. Run: node --test tools/skill-contract.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const SKILLS = ['skills/home.js', 'skills/walls.js', 'skills/room.js', 'skills/sorry.js', 'skills/ovulation.js', 'skills/period.js', 'skills/chess.js',
  'skills/pregnancy.js', 'skills/mancala.js', 'skills/constellation.js'];
for (const path of SKILLS) {
  test(path + ' takes its examples and leaves its near misses', async () => {
    const skill = (await import('../void-live-deploy/' + path)).default;
    assert.equal(typeof skill.match, 'function'); assert.equal(typeof skill.run, 'function');
    assert.ok(skill.examples && skill.examples.length, 'has examples');
    for (const a of skill.examples) assert.ok(skill.match(a.toLowerCase(), a), 'takes "' + a + '"');
    for (const a of skill.nearMisses || []) assert.ok(!skill.match(a.toLowerCase(), a), 'leaves "' + a + '"');
  });
}
