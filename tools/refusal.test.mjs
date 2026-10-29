// lib/refusal.js: every "I cannot" carries what is missing (asked by Verse, domains/void.voice.md)
import assert from 'node:assert/strict';
import { refusalOf, refusalLine, kindOf, sourcesOf } from '../void-live-deploy/lib/refusal.js';

assert.equal(kindOf('none'), 'knowledge');
assert.equal(kindOf('skill:weather'), 'skill');
assert.equal(kindOf('not-connected'), 'connector');
assert.equal(kindOf('app'), 'app');
assert.equal(kindOf('figure'), 'figure');
assert.equal(kindOf('calc'), 'calc');
assert.equal(kindOf('not built yet'), 'knowledge');
assert.equal(kindOf(undefined), 'unknown');

const r = refusalOf('What is a blorptangle?', 'none');
assert.equal(r.cannot, true);
assert.equal(r.kind, 'knowledge');
assert.equal(r.target, 'miss:what-is-a-blorptangle');
assert.equal(r.id, 'cannot:knowledge:what-is-a-blorptangle');
assert.equal(r.skill, null);
// the same gap asked with different case and punctuation is one id
assert.equal(refusalOf('what is a BLORPTANGLE', 'none').id, r.id);
// the id is the class and the target, not the sentence
assert.ok(!r.id.includes(' ') && !r.id.includes('?'));

const s = refusalOf('weather on mars', 'skill:weather');
assert.equal(s.kind, 'skill');
assert.equal(s.skill, 'weather');
assert.match(refusalLine(s), /^Missing: the data this skill needs for that ask \(weather\)\. Noted as miss:weather-on-mars\.$/);

assert.equal(refusalOf('', 'none').target, 'miss:nothing'); // never an empty target
assert.equal(s.sources_checked, null, 'no lookup ran for a skill gap');

// "no referent exists" and "no source was consulted" are two different gaps (owner, 2026-10-16)
const read = refusalOf('tell me about blorptangle', 'none:wikipedia,wiktionary');
assert.equal(read.kind, 'knowledge'); assert.deepEqual(read.sources_checked, ['wikipedia', 'wiktionary']);
assert.equal(read.id, 'cannot:knowledge:tell-me-about-blorptangle', 'the sources never change the gap\'s id');
assert.match(refusalLine(read), /^Missing: what this is \(no source I can read knows it yet\)\. Looked in Wikipedia and Wiktionary\. Noted as miss:tell-me-about-blorptangle\.$/);
const unread = refusalOf('tell me about blorptangle', 'unreached');
assert.equal(unread.kind, 'lookup'); assert.deepEqual(unread.sources_checked, []);
assert.match(refusalLine(unread), /nothing was looked up/); assert.doesNotMatch(refusalLine(unread), /Looked in/);
assert.equal(kindOf('none:wikipedia'), 'knowledge'); assert.deepEqual(refusalOf('x y', 'none').sources_checked, []);
assert.deepEqual(sourcesOf('none:wikipedia,evil,wikipedia'), ['wikipedia'], 'only known sources, once each');
assert.deepEqual(sourcesOf('none:<script>'), []);
console.log('refusal: all passed');
