// tools/site-teach.mjs on fakes, and every taught wording in skills/aliases.json still lands on a skill that takes its meaning.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fromTitle, teachable, taught, keyOf, loadSkills, ALIASES } from './site-teach.mjs';
assert.deepEqual(fromTitle('site-test: teach Verse "yo calculator" (means "calculator", skill:calc): refused'), { ask: 'yo calculator', means: 'calculator', skill: 'calc' });
assert.equal(fromTitle('site-test: fix: "x" console'), null);
const skills = [{ name: 'calc', match: (l) => /calculator/.test(l) && !/yo/.test(l) }, { name: 'clock', match: (l) => /time/.test(l) }];
assert.equal(teachable({ ask: 'yo calculator', means: 'calculator', skill: 'calc' }, skills), '');
assert.match(teachable({ ask: 'what time', means: 'calculator', skill: 'calc' }, skills), /already taken by clock/);
assert.match(teachable({ ask: 'yo calc', means: 'time', skill: 'calc' }, skills), /not taken by calc/);
assert.match(teachable({ ask: '<b>x</b>', means: 'calculator', skill: 'calc' }, skills), /plain/);
assert.match(teachable({ ask: 'yo calculator', means: 'calculator', skill: 'calc' }, skills, { 'yo calculator': 'calculator' }), /already/);
const t = taught({ ask: 'Yo Calculator?', means: 'calculator', skill: 'calc' }, {}, { cases: [{ ask: 'a' }], teach: [{ ask: 'yo calculator' }] });
assert.deepEqual(t.aliases, { 'yo calculator': 'calculator' }); assert.equal(t.suite.cases.length, 2); assert.deepEqual(t.suite.teach, []);
// the real list: each taught wording's meaning is taken by a skill, and no skill takes the wording itself
const real = JSON.parse(readFileSync(ALIASES, 'utf8')), all = await loadSkills();
const first = (a) => all.find((s) => { try { return s.match(a.toLowerCase(), a); } catch (_) { return false; } });
for (const [k, v] of Object.entries(real)) { assert.equal(k, keyOf(k)); assert.ok(first(v), 'taught "' + k + '" means "' + v + '", which no skill takes'); assert.ok(!first(k), '"' + k + '" is taken directly now; drop the alias'); }
console.log('site-teach: ' + (9 + Object.keys(real).length) + ' checks passed');
