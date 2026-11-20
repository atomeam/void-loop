// The stranger test's pure parts (void-live-deploy/lib/stranger.js): sign-offs, the order of work, purpose, claims, leaks, verdicts, jobs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fingerprint, signedOff, pickNext, purposeShape, claimsOf, rawLeaks, rivalCheck, readJudge, judgePrompt, verdict, record, regressed, jobFor, INVENT_AFTER } from '../void-live-deploy/lib/stranger.js';

const F = JSON.parse(fs.readFileSync(new URL('./fixtures/stranger/films.json', import.meta.url), 'utf8'));

// the 'Scene' film: a fill-in-the-blank template (the nba film is the same lines with the topic swapped) and one dry encyclopedia line
const scene = purposeShape(F.scene, [F.nba, F.good]);
assert.equal(scene.ok, false);
assert.deepEqual(scene.template, [F.nba.id]);
assert.match(scene.why.join(' '), /template/); assert.match(scene.why.join(' '), /one dry encyclopedia line/);
// a film with real content and its own lines passes the shape
assert.equal(purposeShape(F.good, [F.scene, F.nba]).ok, true);
// the same topic is never its own twin
assert.equal(purposeShape(F.nba, [{ ...F.nba, id: 'x' }]).template.length, 0);
// the Scene film fails the whole test even when the model is out: purpose fails on the measure alone
const v = verdict({ works: { ok: true }, looks: { ok: null }, claims: { ok: null }, names: { ok: null }, rival: { ok: null }, purpose: { ok: scene.ok, why: scene.why.join('; ') } });
assert.equal(v.pass, false); assert.equal(v.fail, true); assert.deepEqual(v.failed, ['purpose']);

// claims: links and the site's own addresses, ready to be opened
assert.deepEqual(claimsOf('Make any video free a-to-mind.com'), ['https://a-to-mind.com']);
assert.deepEqual(claimsOf('see https://a-to-mind.com/films/. and a-to-mind.com/games/'), ['https://a-to-mind.com/films/', 'https://a-to-mind.com/games/']);

// leaks are measured, not words: a stack trace, a template hole, a source path, a raw hash
assert.deepEqual(rawLeaks('Score: NaN'), ['a template hole (undefined, NaN or {{ }})']);
assert.equal(rawLeaks('at run (tools/x.mjs:3:9)').length >= 1, true);
assert.deepEqual(rawLeaks('id 0123456789abcdef0123456789abcdef'), ['a long raw id or hash']);
assert.deepEqual(rawLeaks('A normal sentence about the moon.'), []);

// the rival check never names the rival
assert.equal(rivalCheck('/flights/', { '/flights/': 40 }).ok, false);
assert.doesNotMatch(rivalCheck('/flights/', { '/flights/': 40 }).detail, /\.com|google|kayak/i);
assert.equal(rivalCheck('/flights/', { '/flights/': 10 }).ok, true);
assert.equal(rivalCheck('/x/', {}).ok, null);

// the judge's answer
const j = readJudge('ok {"looks":{"ok":false,"why":"robot voice"},"claims":{"ok":true},"names":"yes","purpose":{"ok":false,"why":"hype around one line"},"standard_name":"Movie news"}');
assert.equal(j.looks.ok, false); assert.equal(j.claims.ok, true); assert.equal(j.names.ok, true); assert.equal(j.standardName, 'Movie news');
assert.equal(readJudge('no json'), null);
assert.match(judgePrompt(F.scene), /Scene is a 2026 Indian Tamil-language film/);

// sign-offs: an unchanged passing item is never checked again; a change brings it back
const item = { id: '/coin-flip/', kind: 'tool', hash: fingerprint('<html>v1</html>') };
const pass = verdict(Object.fromEntries(['works', 'looks', 'claims', 'names', 'rival', 'purpose'].map((k) => [k, { ok: true }])));
let led = record({}, item, pass, '2026-11-20T00:00:00Z');
assert.equal(signedOff(led, item.id, item.hash), true);
assert.equal(pickNext([item], led).length, 0);
const changed = { ...item, hash: fingerprint('<html>v2</html>') };
assert.equal(pickNext([changed], led).length, 1);
// a signed-off item that changes and now fails is a regression
assert.equal(regressed(led.items[item.id], changed, v), true);

// order: the lowest score first, never-scored after
const a = { id: 'a', hash: '1' }, b = { id: 'b', hash: '2' }, c = { id: 'c', hash: '3' };
const l2 = { items: { a: { score: 70, hash: 'x', at: '2026-11-19' }, b: { score: 20, hash: 'y', at: '2026-11-19' } } };
assert.deepEqual(pickNext([c, a, b], l2).map((x) => x.id), ['b', 'a', 'c']);

// jobs: a first failure is an improve job; the same check failing again after that is an invent job with a spec, a prototype and a measure
const it2 = { id: '20261110-news-scene', kind: 'video', hash: 'h' }, itp = { ...it2, kind: 'page' };
let led2 = record({}, it2, v);
assert.equal(jobFor({ ...it2, kind: 'page' }, v, {}).type, 'stranger-improve');
// a rendered film cannot be patched: a purpose failure is an invent job at once, with where to start
const now1 = jobFor(it2, v, {}); assert.equal(now1.type, 'stranger-invent'); assert.match(now1.invent.spec, /template-overlap score under 20%/);
for (let i = 1; i < INVENT_AFTER; i++) led2 = record(led2, it2, v);
const inv = jobFor(it2, v, led2.items[it2.id]); assert.equal(jobFor(itp, v, led2.items[it2.id]).type, 'stranger-invent');
assert.equal(inv.type, 'stranger-invent'); assert.equal(inv.invent.key, 'video:purpose'); assert.ok(inv.invent.spec && inv.invent.prototype && inv.invent.measure.bar === 100);
assert.equal(jobFor(it2, pass, {}), null);
console.log('stranger: ok');
