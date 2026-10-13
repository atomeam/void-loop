// lib/refusal.js: every "I cannot" carries what is missing (asked by Void, domains/void.voice.md)
import assert from 'node:assert/strict';
import { refusalOf, refusalLine, kindOf } from '../void-live-deploy/lib/refusal.js';

assert.equal(kindOf('none'), 'knowledge');
assert.equal(kindOf('skill:weather'), 'skill');
assert.equal(kindOf('not-connected'), 'connector');
assert.equal(kindOf('app'), 'app');
assert.equal(kindOf('figure'), 'figure');
assert.equal(kindOf('calc'), 'calc');
assert.equal(kindOf('not built yet'), 'knowledge');
assert.equal(kindOf(undefined), 'unknown');

const r = refusalOf('What is a zorbleflux?', 'none');
assert.equal(r.cannot, true);
assert.equal(r.kind, 'knowledge');
assert.equal(r.target, 'miss:what-is-a-zorbleflux');
assert.equal(r.id, 'cannot:knowledge:what-is-a-zorbleflux');
assert.equal(r.skill, null);
// the same gap asked with different case and punctuation is one id
assert.equal(refusalOf('what is a ZORBLEFLUX', 'none').id, r.id);
// the id is the class and the target, not the sentence
assert.ok(!r.id.includes(' ') && !r.id.includes('?'));

const s = refusalOf('weather on mars', 'skill:weather');
assert.equal(s.kind, 'skill');
assert.equal(s.skill, 'weather');
assert.match(refusalLine(s), /^Missing: the data this skill needs for that ask \(weather\)\. Noted as miss:weather-on-mars\.$/);

assert.equal(refusalOf('', 'none').target, 'miss:nothing'); // never an empty target
console.log('refusal: all passed');
