// The stranger gate's pure parts. The browser run is tools/stranger-gate.mjs itself.
import assert from 'node:assert/strict';
import { targetsFromFiles, sweepByPath, targetOfPath, rotate, needsHandoff, shortPlay, reasonsOf, reasonsFromJudge, jobsFor, report, judgeKeyName, askJudge, SPEED, MAX } from './stranger-gate.mjs';

const sweep = sweepByPath({ items: [{ id: 'qr', page: '/qr/?text=hi' }, { id: 'weather', page: '/weather' }] });
assert.equal(sweep['/qr/'], 'qr');
assert.equal(sweep['/weather/'], 'weather');

const files = ['void-live-deploy/games/void-breaker/app.js', 'void-live-deploy/qr/index.html', 'void-live-deploy/skills/weather.js', 'void-live-deploy/lib/notes.js', 'README.md'];
const got = targetsFromFiles(files, { sweep, exists: (r) => r === '/notes/' });
assert.deepEqual(got.map((t) => t.kind), ['game', 'tool', 'page', 'card']);
assert.equal(got[1].id, '/qr/');
assert.equal(got[2].path, '/notes/');
assert.equal(got[3].ask, 'weather');
assert.equal(targetsFromFiles(Array.from({ length: 10 }, (_, i) => 'void-live-deploy/games/g' + i + '/app.js')).length, MAX);
assert.equal(targetOfPath('/games/void-breaker', sweep).kind, 'game');
assert.deepEqual(rotate(['a', 'b', 'c'], 1, 2), ['b', 'c']);
assert.deepEqual(rotate(['a', 'b'], 1, 2), ['b', 'a']);

assert.equal(needsHandoff('<meta name="verse-handoff" content="in: text; out: text">', '/x/', {}, true), false);
assert.equal(needsHandoff('<html>', '/x/', { '/x/': { in: ['text'] } }, true), false);
assert.equal(needsHandoff('<html>', '/new/', {}, true), true);
assert.equal(needsHandoff('<html>', '/new/', {}, false), false);

const good = { hook: true, readyMs: 200, startMs: 100, keys: true, touch: true, rises: 8, deadMs: 1000, speedStart: 1, speedEnd: 1, levelStart: 1, levelEnd: 1, failMs: 99999, again: false, audio: true, sounds: 12, fps: 55, errors: 0 };
assert.deepEqual(shortPlay(good), []);
assert.match(shortPlay({ hook: false }).join(' '), /window.__game/);

const ok = { metrics: { errs: { errors: 0 }, flows: { controls: 2, controlsWithEffect: 1 }, art: {}, layout: { scrollX: 0, clipped: 0 }, speedPhone: { dcl: 900, bytes: 80_000, cls: 0.01 } }, details: { text: 'The forecast for today is clear.', brokenLinks: ['#'] } };
assert.deepEqual(reasonsOf({ kind: 'tool', measure: ok, text: ok.details.text }), []);
assert.deepEqual(reasonsOf({ kind: 'page', measure: { fail: 'gated: the Uni screen shows, not the page' }, text: '' }), []);
const slow = { metrics: { errs: { errors: 1 }, flows: { controls: 1, controlsWithEffect: 0 }, art: { placeholders: 1, broken: 1 }, layout: { scrollX: 20, clipped: 1 }, speedPhone: { dcl: SPEED.dclMs + 1, bytes: SPEED.bytes + 1, cls: 0.4 } }, details: { text: 'Acme Corp is the world\'s best. See tools/x.mjs', errors: ['TypeError: nope'], brokenLinks: ['/missing/ 404'] } };
const why = reasonsOf({ kind: 'page', measure: slow, text: slow.details.text, titleMissing: true, handoffMissing: true });
for (const bit of ['error', 'main control', 'placeholder art', 'picture is broken', 'scrolls sideways', 'cut off', 'link goes nowhere', 'phone wait', 'phone download', 'jumps', 'invented name', 'world\'s best', 'no title', 'what it takes', 'source file path']) assert.match(why.join(' | '), new RegExp(bit), bit);

assert.deepEqual(reasonsFromJudge({ looks: { ok: false, why: 'the type is too small' }, claims: { ok: true } }), ['the type is too small']);
assert.deepEqual(reasonsFromJudge(null), []);

const jobs = jobsFor([{ id: '/qr/', kind: 'tool', reasons: ['the main control did nothing'] }, { id: '/ok/', reasons: [] }]);
assert.equal(jobs.length, 1);
assert.equal(jobs[0].target.startsWith('stranger:'), true);
assert.ok(jobs[0].target.length <= 40 && jobs[0].ask.length <= 200);
assert.match(report([]), /nothing a stranger meets/);
assert.match(report([{ id: '/qr/', kind: 'tool', reasons: [] }]), /passed/);
assert.match(report(jobs.map((j) => ({ id: '/qr/', kind: 'tool', reasons: ['the main control did nothing'] }))), /main control/);

assert.equal(judgeKeyName({}), '');
assert.equal(judgeKeyName({ GROQ_API_KEY: 'x'.repeat(12) }), 'GROQ_API_KEY'); // secret-scan: ok
assert.equal(judgeKeyName({ GROQ_API_KEY: 'short' }), '');
let called = false;
const none = await askJudge('judge this', {}, () => { called = true; });
assert.equal(none, '');
assert.equal(called, false);
console.log('stranger gate: ok');
