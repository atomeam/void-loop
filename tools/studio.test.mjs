// The studio (lib/studio.js, functions/api/studio.js): its rules, and the route with a FAKE D1 and a stand-in Workers AI that answers like the
// real models do (base64, { image }, a stream; the judge's JSON; a partner video's { state, result: { video } }). Run: node --test tools/studio.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { IMAGE_MODELS, VIDEO_MODELS } from '../void-live-deploy/lib/models.js';
import * as S from '../void-live-deploy/lib/studio.js';
import * as studio from '../void-live-deploy/functions/api/studio.js';

function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ bind: (...b) => stmt(sql, b), run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; }, first: async () => db.prepare(sql).get(...a) || null, all: async () => ({ results: db.prepare(sql).all(...a) }) });
  return { prepare: (sql) => stmt(sql), batch: async (list) => Promise.all(list.map((s) => s.run())) };
}
// a real 640 x 480 JPEG header (SOI, APP0, SOF0) padded to a plausible size, and a real PNG header of 1024 x 1024
const jpeg = (w, h) => { const b = Buffer.alloc(9000); Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3]).copy(b); return b.toString('base64'); };
const png = (w, h) => { const b = Buffer.alloc(9000); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, w >>> 24, (w >> 16) & 255, (w >> 8) & 255, w & 255, h >>> 24, (h >> 16) & 255, (h >> 8) & 255, h & 255]).copy(b); return b.toString('base64'); };
const KEY = 'owner-key-for-tests-only'; // secret-scan: ok (a made-up key for the test)

test('every image model has a price and a way to be asked; the video models have prices', () => {
  for (const slug of Object.keys(IMAGE_MODELS)) {
    assert.ok(Object.hasOwn(S.NEURONS, slug), slug + ' has a price');
    assert.ok(S.neuronsOf(slug, [1024, 1024]) >= 0 && S.neuronsOf(slug, [1024, 1024]) < 5000, slug);
    const a = S.paintAskOf(slug, 'a cat', [768, 1152], 3); assert.ok(a.form || a.json, slug);
  }
  assert.equal(S.neuronsOf('klein-4b', [1024, 1024]), 110); // 4 tiles x 26.05 + the input
  assert.ok(S.neuronsOf('klein-9b', [1024, 1024]) > S.neuronsOf('klein-4b', [1024, 1024]));
  for (const m of Object.keys(VIDEO_MODELS)) assert.ok(Number.isFinite(S.videoCostOf(m, 6, '720p')), m);
  assert.equal(S.videoCostOf('p-video', 5, '720p', true), 0.025);
  assert.equal(S.videoCostOf('nope', 5), Infinity);
});

test('the painter is asked in its own form', () => {
  assert.deepEqual(S.paintAskOf('klein-4b', 'a cat', [1024, 768], 5), { form: { prompt: 'a cat', width: '1024', height: '768', seed: '5' } });
  assert.equal(S.paintAskOf('flux-2-dev', 'a cat', [512, 512], 5).form.steps, '20');
  const lucid = S.paintAskOf('lucid-origin', 'a cat', [1024, 768], 5).json;
  assert.deepEqual([lucid.width, lucid.height, lucid.num_steps, lucid.guidance], [1024, 768, 20, 4.5]);
  const schnell = S.paintAskOf('schnell', 'a cat', [1024, 768], 5).json;
  assert.equal(schnell.width, undefined); assert.ok(schnell.steps <= 8);
  assert.equal(S.paintAskOf('nope', 'x', [1, 1], 1), null);
});

test('the judge is read strictly, and the score weighs what is there over how it looks', () => {
  const j = S.judgeOf('Sure! ```json\n{"checks":["yes","yes","no","Yes, clearly","no"],"flaws":8,"look":6,"worst":"the snow looks flat"}\n```', 5);
  assert.deepEqual(j.checks, [true, true, false, true, false]);
  assert.equal(j.match, 0.6); assert.equal(j.flaws, 8); assert.equal(j.worst, 'the snow looks flat');
  assert.equal(S.judgeOf('{"checks":[],"flaws":5,"look":5}', 3), null);
  assert.equal(S.judgeOf('no json here', 3), null);
  assert.equal(S.judgeOf('{"checks":["yes"],"flaws":"x","look":5}', 1), null);
  assert.equal(S.scoreOf({ match: 1, flaws: 10, look: 10 }), 100);
  assert.equal(S.scoreOf({ match: 0.6, flaws: 8, look: 6 }), 65);
  assert.ok(S.scoreOf({ match: 1, flaws: 5, look: 5 }) > S.scoreOf({ match: 0.4, flaws: 10, look: 10 }), 'what was asked counts most');
  assert.equal(S.scoreOf({ match: 1, flaws: 10, look: 10 }, [512, 512], [1024, 1024]), 25, 'a quarter of the asked pixels');
  assert.match(S.judgePrompt('a fox', ['a fox', 'snow']), /1\. a fox\n2\. snow/);
});

test('a picture is read from its own bytes: kind and size', () => {
  assert.deepEqual(S.sizeOf(jpeg(640, 480)), [640, 480]);
  assert.deepEqual(S.sizeOf('data:image/png;base64,' + png(1024, 1024)), [1024, 1024]);
  assert.equal(S.sizeOf('bm90IGFuIGltYWdl'), null);
  assert.match(S.pictureOf(jpeg(10, 10)), /^data:image\/jpeg;base64,/);
  assert.match(S.pictureOf(png(10, 10)), /^data:image\/png;base64,/);
  assert.equal(S.pictureOf('abc'), '');
  assert.equal(S.pictureOf('<script>' + 'A'.repeat(5000)), '');
});

test('the bench plan spends cheapest first and never past its cap; the champion is the best the day can pay for', () => {
  const { plan, neurons } = S.planOf(Object.keys(IMAGE_MODELS), ['fox', 'sign', 'nope'], [1024, 1024], 3000);
  assert.ok(neurons <= 3000);
  assert.equal(plan[0].model, 'sdxl-lightning'); // free (beta) first
  assert.ok(plan.every((p) => p.bench === 'fox' || p.bench === 'sign'));
  assert.ok(!plan.some((p) => p.model === 'klein-9b' && p.bench === 'sign') || neurons <= 3000);
  const rows = [];
  for (const b of ['fox', 'hands', 'sign', 'astronaut']) { rows.push({ model: 'klein-4b', bench: b, score: 70, ms: 3000 }, { model: 'schnell', bench: b, score: 69, ms: 1500 }, { model: 'lucid-origin', bench: b, score: 90, ms: 9000 }); }
  rows.push({ model: 'phoenix-1', bench: 'fox', score: 99, ms: 1 }, { model: 'gone', bench: 'fox', score: 100, ms: 1 });
  const board = S.boardOf(rows);
  assert.equal(board[0].model, 'phoenix-1'); assert.ok(!board.some((e) => e.model === 'gone'));
  assert.equal(S.championOf(board, { maxNeurons: 5000 }), 'lucid-origin', 'phoenix has one prompt only');
  assert.equal(S.championOf(board, { maxNeurons: 400 }), 'schnell', 'within the tie and cheaper than klein-4b');
  assert.equal(S.championOf([], {}), 'klein-4b');
});

test('a clip is asked for inside what its model takes, and scored on its frames, its motion and whether it holds together', () => {
  const a = S.videoAskOf('p-video', { seconds: 99, resolution: '4k', aspect: '2:1' });
  assert.deepEqual([a.model, a.seconds, a.res, a.aspect, a.draft], ['p-video', 10, '720p', '16:9', true]);
  assert.equal(S.videoAskOf('ltx-fast', { seconds: 1 }).seconds, 6);
  assert.equal(S.videoAskOf('nope').model, 'p-video');
  const pin = S.videoInputOf(a, 'a fox', 'data:image/png;base64,AAAA');
  assert.equal(pin.image, 'data:image/png;base64,AAAA'); assert.equal(pin.disable_safety_filter, false);
  const lin = S.videoInputOf(S.videoAskOf('ltx-fast', { aspect: '9:16' }), 'a fox', 'data:image/png;base64,AAAA');
  assert.equal(lin.resolution, '720x1280'); assert.equal(lin.image_uri, undefined, 'ltx takes only an https first frame');
  assert.equal(S.videoUrlOf({ state: 'Completed', result: { video: 'https://x.example/a.mp4' } }), 'https://x.example/a.mp4');
  assert.equal(S.videoUrlOf({ result: { video: 'javascript:alert(1)' } }), '');
  const f = { match: 1, flaws: 8, look: 7 };
  assert.ok(S.videoScoreOf([f, f], 0.1, true) > S.videoScoreOf([f, f], 0, true), 'a clip that does not move is a still');
  assert.ok(S.videoScoreOf([f, f], 0.1, true) > S.videoScoreOf([f, f], 0.1, false));
  assert.equal(S.videoScoreOf([], 0.1, true), 0);
  assert.equal(S.steadyOf('{"steady": "yes", "why": "same fox"}'), true); assert.equal(S.steadyOf('nothing'), null);
});

const req = (body, key = KEY) => new Request('https://a-to-mind.com/api/studio', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify(body) });
function world(over = {}) {
  studio.resetReady(); const calls = [];
  const AI = { run: async (model, input) => {
    calls.push({ model, input });
    if (/gemma/.test(model)) return { response: '{"checks":["yes","yes","yes","no","yes"],"flaws":7,"look":6,"worst":"soft focus"}' };
    if (model === VIDEO_MODELS['p-video']) return over.video ? over.video(input) : { state: 'Completed', result: { video: 'https://videos.example/clip.mp4' } };
    if (model === IMAGE_MODELS['phoenix-1'].id) return new Response(Buffer.from(jpeg(1024, 1024), 'base64')).body; // a stream
    if (model === IMAGE_MODELS['sdxl-lightning'].id) return new Uint8Array(Buffer.from(png(1024, 1024), 'base64')); // bytes
    if (model === IMAGE_MODELS['lucid-origin'].id) throw new Error('3036: account limited');
    return { image: jpeg(1024, 1024) };
  } };
  return { env: { DB: d1(), READ_TOKEN: KEY, AI, ...over.env }, calls };
}

test('the route: strangers get nothing; the bench paints, judges and keeps numbers; the board picks a painter', async () => {
  const { env, calls } = world();
  assert.equal((await studio.onRequestPost({ request: req({ op: 'bench' }, 'wrong'), env })).status, 401);
  assert.equal(calls.length, 0);
  const r = await (await studio.onRequestPost({ request: req({ op: 'bench', prompts: ['fox'], models: ['klein-4b', 'phoenix-1', 'sdxl-lightning', 'lucid-origin'], cap: 6000, images: true }), env })).json();
  assert.equal(r.ok, true); assert.equal(r.runs.length, 4);
  const by = Object.fromEntries(r.runs.map((x) => [x.model, x]));
  assert.equal(by['klein-4b'].score, 73.5); assert.deepEqual([by['klein-4b'].w, by['klein-4b'].h], [1024, 1024]); assert.match(by['klein-4b'].img, /^data:image\/jpeg/);
  assert.match(by['phoenix-1'].img, /^data:image\/jpeg/, 'a stream is read'); assert.match(by['sdxl-lightning'].img, /^data:image\/png/, 'bytes are read');
  assert.match(by['lucid-origin'].error, /account limited/, 'a model that fails says why, and the rest go on');
  const judged = calls.filter((c) => /gemma/.test(c.model));
  assert.equal(judged.length, 3); assert.match(judged[0].input.messages[0].content[0].text, /red fox/);
  const g = await (await studio.onRequestGet({ env })).json();
  assert.equal(g.ok, true); assert.equal(g.board.length, 3); assert.ok(!JSON.stringify(g).includes('data:image'));
  assert.equal(g.champion, 'klein-4b', 'one prompt is not enough to switch');
});

test('the route: a clip inside the dollar cap, the model\'s own error when it fails, and the cap holds', async () => {
  let { env } = world();
  const ok = await (await studio.onRequestPost({ request: req({ op: 'video', prompt: 'a fox in snow', seconds: 5 }), env })).json();
  assert.equal(ok.state, 'video'); assert.equal(ok.url, 'https://videos.example/clip.mp4'); assert.equal(ok.usd, 0.025);
  ({ env } = world({ env: { OWNER_VIDEO_DAILY_USD: '0.03' } }));
  await studio.onRequestPost({ request: req({ op: 'video', prompt: 'a fox in snow', seconds: 5 }), env });
  const capped = await (await studio.onRequestPost({ request: req({ op: 'video', prompt: 'a fox in snow', seconds: 5 }), env })).json();
  assert.equal(capped.state, 'resting'); assert.equal(capped.why, 'cap');
  ({ env } = world({ video: () => { throw new Error('7003: no credits on the account'); } }));
  const failed = await (await studio.onRequestPost({ request: req({ op: 'video', prompt: 'a fox' }), env })).json();
  assert.equal(failed.state, 'failed'); assert.match(failed.why, /no credits/);
  const again = await (await studio.onRequestPost({ request: req({ op: 'video', prompt: 'a fox' }), env })).json();
  assert.equal(again.state, 'failed', 'a failed clip costs nothing, so the cap is not touched');
  assert.equal((await (await studio.onRequestPost({ request: req({ op: 'video', prompt: '   ' }), env })).json()).state, 'refused');
});
