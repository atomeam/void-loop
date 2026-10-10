// A world that keeps living while you are away (domains/void.frontier.md item 4): advance(things, ms) in skills/scripts.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, awayText, CONDITIONS, AWAY_MAX_MS } from '../void-live-deploy/skills/scripts.js';
import { foldWorld } from '../void-live-deploy/skills/figures3d.js';
import { DatabaseSync } from 'node:sqlite';
import * as actionsApi from '../void-live-deploy/functions/api/actions.js';
import { cleanScene, describe as describeScene, recordScene, KIND, MAX_CHANGES, MEMBER_KEEP } from '../void-live-deploy/lib/scene-advance.js';
import { ensureTables, newSession } from '../void-live-deploy/lib/void-me.js';

const HOUR = 36e5;
// a cloud with a flower beneath it (rain lands on what is within 70px sideways and 260px below), a block of ice apart
const stage = () => [
  { id: 'c1', kindOf: 'cloud', x: 100, y: 100, seed: 11 },
  { id: 'f1', kindOf: 'flower', x: 110, y: 250, seed: 22 },
  { id: 'i1', kindOf: 'ice', x: 700, y: 400, seed: 33 },
];
const byId = (r, id) => r.things.find((t) => t.id === id);

test('advance: three natures change visibly over one simulated hour', () => {
  const r = advance(stage(), HOUR);
  assert.ok(r.changes.some((c) => c.id === 'c1' && c.what === 'rained'), 'the cloud rained');
  assert.ok(byId(r, 'f1').nature.grow > 0.5, 'the flower under the rain grew: ' + byId(r, 'f1').nature.grow);
  assert.equal(byId(r, 'i1').nature.gone, true, 'ice above freezing melted away in an hour');
  assert.deepEqual(r.changes.map((c) => c.what).sort(), ['grew', 'melted away', 'rained']);
});

test('advance: a flower with no rain over it does not grow', () => {
  const r = advance([{ id: 'f', kindOf: 'flower', x: 0, y: 0, seed: 1 }, { id: 'c', kindOf: 'cloud', x: 600, y: 100, seed: 2 }], HOUR);
  assert.equal(byId(r, 'f').nature.grow, 0);
  assert.ok(!r.changes.some((c) => c.id === 'f'));
});

test('advance: zero ms (or under no time at all) changes nothing', () => {
  const things = stage();
  const r = advance(things, 0);
  assert.deepEqual(r.things, things);
  assert.deepEqual(r.changes, []);
  assert.equal(r.note, '');
  assert.deepEqual(advance(things, -5).things, things, 'negative time is no time');
  assert.equal(advance(things, NaN).note, '');
  assert.equal(things[0].nature, undefined, 'the input is never touched');
});

test('advance: the note names what changed, and nothing else', () => {
  const r = advance(stage(), HOUR);
  assert.match(r.note, /^While you were away \(1 hour\): /);
  assert.match(r.note, /the cloud rained/);
  assert.match(r.note, /the flower grew/);
  assert.match(r.note, /the ice melted away/);
  assert.ok(r.note.endsWith('.'));
  assert.equal(r.note.split('\n').length, 1, 'one line');
  assert.equal(advance([{ id: 'f', kindOf: 'flower', x: 0, y: 0 }], HOUR).note, '', 'a quiet flower leaves no note');
  assert.equal(advance([{ id: 'z', kindOf: 'zombie', x: 0, y: 0 }], HOUR).note, '', 'things without conditions are left as they were');
  assert.match(advance([{ id: 'a', kindOf: 'ice', x: 0, y: 0 }, { id: 'b', kindOf: 'ice', x: 900, y: 0 }], HOUR).note, /2 ices melted away/);
});

test('advance: the same things and ms give identical results twice, and a different seed only changes the pace', () => {
  const a = advance(stage(), HOUR), b = advance(stage(), HOUR);
  assert.deepEqual(a, b);
  const part = advance([{ id: 'i', kindOf: 'ice', x: 0, y: 0, seed: 1 }], 20 * 1000).things[0].nature.melt;
  const part2 = advance([{ id: 'i', kindOf: 'ice', x: 0, y: 0, seed: 987654 }], 20 * 1000).things[0].nature.melt;
  assert.notEqual(part, part2, 'a seed gives each thing its own pace');
  assert.ok(Math.abs(part - part2) / Math.max(part, part2) < 0.25, 'but only a slight one: ' + part + ' vs ' + part2);
});

test('advance: it continues a thing from the state it was left in, and splits into the same story', () => {
  const half = advance(stage(), HOUR / 2);
  const rest = advance(half.things, HOUR / 2);
  const whole = advance(stage(), HOUR);
  assert.equal(byId(rest, 'i1').nature.gone, byId(whole, 'i1').nature.gone);
  assert.equal(byId(rest, 'f1').nature.grow, 1, 'two half-hours grow the flower as one hour does');
  assert.equal(byId(whole, 'f1').nature.grow, 1);
});

test('advance: time is capped at a day and short absences are named in minutes', () => {
  const day = advance(stage(), AWAY_MAX_MS), year = advance(stage(), 365 * 24 * HOUR);
  assert.deepEqual(day, year);
  assert.equal(awayText(5 * 6e4), '5 min');
  assert.equal(awayText(HOUR), '1 hour');
  assert.equal(awayText(3 * HOUR), '3 hours');
  assert.equal(awayText(72 * HOUR), '3 days');
  assert.ok(CONDITIONS.cloud && CONDITIONS.flower && CONDITIONS.ice);
});

// ---- reactions over time: the NATURES that are reactions play out between the things that are there ----
const at = (r, id) => byId(r, id).at;
const near = (p, q, d = 30) => Math.hypot(p.x - q.x, p.y - q.y) <= d;

test('advance: a zombie walks to a brain and eats it, and the note says so', () => {
  const r = advance([{ id: 'z', kindOf: 'zombie', x: 100, y: 300, seed: 5 }, { id: 'b', kindOf: 'brain', x: 700, y: 320, seed: 6 }], HOUR);
  assert.equal(byId(r, 'b').gone, true, 'the brain was eaten');
  assert.ok(near(at(r, 'z'), { x: 700, y: 320 }, 2), 'the zombie stands where the brain was: ' + JSON.stringify(at(r, 'z')));
  assert.ok(!byId(r, 'z').gone);
  assert.deepEqual(r.changes, [{ id: 'z', kind: 'zombie', what: 'found', with: 'brain' }]);
  assert.equal(r.note, 'While you were away (1 hour): the zombie found the brain.');
});

test('advance: it takes the time it takes: a slow zombie is partway after a minute, there after ten', () => {
  const zb = (z, b) => [{ id: 'z', kindOf: 'zombie', x: z, y: 300, seed: 5 }, { id: 'b', kindOf: 'brain', x: b, y: 300, seed: 6 }];
  const minute = advance(zb(100, 1100), 60e3);
  assert.notEqual(byId(minute, 'b').gone, true, 'a minute is not enough for a thousand pixels at a zombie\'s pace');
  const x1 = at(minute, 'z').x;
  assert.ok(x1 > 100 && x1 < 1100, 'it is on its way: ' + x1);
  assert.equal(minute.note, '', 'nothing happened yet to tell');
  assert.equal(byId(advance(zb(100, 1100), 10 * 60e3), 'b').gone, true);
});

test('advance: a dog goes for a bone, a cat for a fish, a mouse for cheese', () => {
  for (const [a, b, id] of [['dog', 'bone', 'd'], ['cat', 'fish', 'c'], ['mouse', 'cheese', 'm'], ['rabbit', 'carrot', 'r'], ['monkey', 'banana', 'k']]) {
    const r = advance([{ id, kindOf: a, x: 50, y: 50, seed: 2 }, { id: 'f', kindOf: b, x: 500, y: 400, seed: 3 }], HOUR);
    assert.equal(byId(r, 'f').gone, true, a + ' ate the ' + b);
    assert.equal(r.note, 'While you were away (1 hour): the ' + a + ' found the ' + b + '.', a);
  }
});

test('advance: a cat catches a mouse that runs from it; neither is lost', () => {
  const r = advance([{ id: 'c', kindOf: 'cat', x: 100, y: 100, seed: 1 }, { id: 'm', kindOf: 'mouse', x: 500, y: 300, seed: 2 }], HOUR);
  assert.ok(!byId(r, 'c').gone && !byId(r, 'm').gone, 'a chase is not a meal');
  assert.equal(r.note, 'While you were away (1 hour): the cat caught the mouse.');
  assert.ok(near(at(r, 'c'), at(r, 'm'), 60), 'the cat ended beside the mouse: ' + JSON.stringify([at(r, 'c'), at(r, 'm')]));
  for (const t of r.things) assert.ok(t.at.x >= 0 && t.at.x <= 1200 && t.at.y >= 0 && t.at.y <= 700, 'on the stage: ' + JSON.stringify(t.at));
});

test('advance: a cat runs from a dog, and the dog gets the cat', () => {
  const r = advance([{ id: 'c', kindOf: 'cat', x: 300, y: 300, seed: 1 }, { id: 'd', kindOf: 'dog', x: 600, y: 300, seed: 2 }], HOUR);
  assert.equal(r.note, 'While you were away (1 hour): the dog caught the cat.');
});

test('advance: with nothing to go for, a creature stays where it was left, and a thing is never its own goal', () => {
  const r = advance([{ id: 'z', kindOf: 'zombie', x: 100, y: 300, seed: 5 }, { id: 'c', kindOf: 'cat', x: 400, y: 100, seed: 5 }], HOUR);
  assert.deepEqual(r.changes, []);
  assert.equal(r.note, '');
  assert.equal(at(r, 'z'), undefined, 'it did not move, so no new place is claimed');
});

test('advance: last place: a figure that wandered is taken from where it was, not from its card', () => {
  const stay = advance([{ id: 'z', kindOf: 'zombie', x: 0, y: 0, at: { x: 800, y: 320 }, seed: 5 }, { id: 'b', kindOf: 'brain', x: 0, y: 0, at: { x: 810, y: 320 }, seed: 6 }], 10 * 60e3);
  assert.equal(byId(stay, 'b').gone, true, 'they were side by side where they stood, so it was found at once');
  assert.ok(near(at(stay, 'z'), { x: 810, y: 320 }, 2));
  // from the card positions alone (a thousand pixels apart) the same ten minutes would not have been enough for a zombie
  const far = advance([{ id: 'z', kindOf: 'zombie', x: 0, y: 0, seed: 5 }, { id: 'b', kindOf: 'brain', x: 1190, y: 690, seed: 6 }], 60e3);
  assert.notEqual(byId(far, 'b').gone, true);
});

test('advance: reactions are deterministic and the day cap holds', () => {
  const s = () => [{ id: 'c', kindOf: 'cat', x: 100, y: 100, seed: 1 }, { id: 'm', kindOf: 'mouse', x: 500, y: 300, seed: 2 }, { id: 'z', kindOf: 'zombie', x: 20, y: 20, seed: 9 }, { id: 'b', kindOf: 'brain', x: 900, y: 600, seed: 8 }];
  assert.deepEqual(advance(s(), HOUR), advance(s(), HOUR));
  assert.deepEqual(advance(s(), AWAY_MAX_MS), advance(s(), 400 * 24 * HOUR));
  assert.deepEqual(advance(s(), 0).things, s());
  const withStage = advance([{ id: 'z', kindOf: 'zombie', x: 10, y: 10, seed: 5 }, { id: 'b', kindOf: 'brain', x: 390, y: 10, seed: 6 }], HOUR, { bounds: { w: 400, h: 200 } });
  assert.equal(byId(withStage, 'b').gone, true);
});

test('last place survives a page that never hid: the scene\'s own save folds each figure\'s place and conditions onto its thing', () => {
  const things = { a: { id: 'a', kind: 'figure', kindOf: 'zombie', x: 0, y: 0 }, b: { id: 'b', kind: 'figure', kindOf: 'cloud', x: 0, y: 0 }, n: { id: 'n', kind: 'note' } };
  const wrote = foldWorld(things, { a: { x: 412, y: 233, nature: null, adv: null }, b: { x: 90, y: 60, nature: { water: 0.5, falling: null, storm: false }, adv: null }, gone: { x: 1, y: 1 } });
  assert.equal(wrote, 2, 'only figures that are on the stage are written, and nothing else is invented');
  assert.deepEqual(things.a.at, { x: 412, y: 233 });
  assert.deepEqual(things.b.at, { x: 90, y: 60 });
  assert.equal(things.b.nature.water, 0.5);
  assert.equal(things.a.nature, undefined, 'a figure with no conditions gets none');
  assert.equal(things.n.at, undefined);
  // the next advance() starts from that place, not from the card
  const r = advance([{ ...things.a, seed: 5 }, { id: 'br', kindOf: 'brain', x: 0, y: 0, at: { x: 420, y: 233 }, seed: 6 }], 60e3);
  assert.equal(byId(r, 'br').gone, true, 'it was beside the brain where it last stood');
});

test('last place: a thing advance() has just moved keeps advance\'s place until the 3D layer has taken it', () => {
  const things = { a: { id: 'a', kind: 'figure', kindOf: 'zombie', x: 0, y: 0, at: { x: 700, y: 300 }, adv: 111 } };
  assert.equal(foldWorld(things, { a: { x: 10, y: 10, nature: null, adv: null } }), 0, 'the layer still has its old random spot');
  assert.deepEqual(things.a.at, { x: 700, y: 300 });
  assert.equal(foldWorld(things, { a: { x: 702, y: 301, nature: null, adv: 111 } }), 1, 'once the layer has taken it, its own place is the truth again');
  assert.deepEqual(things.a.at, { x: 702, y: 301 });
});

// ---- asked by Void: "Connect 'frontier #4' to the 'automations' and 'actions' skills": what advance() did is one execution record, in the asker's scope ----
const TOKEN = 'owner-token-for-tests-1234567890';
function d1() {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql, a = []) => ({ sql, a, bind: (...b) => stmt(sql, b),
    run: async () => { const r = db.prepare(sql).run(...a); return { meta: { changes: Number(r.changes) } }; },
    all: async () => ({ results: db.prepare(sql).all(...a) }), first: async (col) => { const r = db.prepare(sql).get(...a) || null; return col ? (r ? r[col] : null) : r; } });
  return { prepare: (sql) => stmt(sql), batch: async (l) => { for (const q of l) db.prepare(q.sql).run(...q.a); return []; }, raw: db };
}
const records = (env) => env.DB.raw.prepare('SELECT * FROM void_actions ORDER BY started').all();
async function account(env, userId, tier) {
  await ensureTables(env);
  const { token, stmt } = await newSession(env, userId); await stmt.run();
  if (tier) await env.DB.prepare('INSERT INTO void_accounts (user_id, tier, sale_id, subscription_id, updated) VALUES (?, ?, ?, NULL, ?)').bind(userId, tier, 'sale-' + userId, new Date().toISOString()).run();
  return token;
}
const post = (env, auth, body) => actionsApi.onRequestPost({ env, request: new Request('https://x/api/actions', { method: 'POST', headers: auth ? { authorization: 'Bearer ' + auth } : {}, body: JSON.stringify(body) }) });
const get = (env, auth, q = '') => actionsApi.onRequestGet({ env, request: new Request('https://x/api/actions' + q, { headers: auth ? { authorization: 'Bearer ' + auth } : {} }) });
// three real changes, from a real advance()
const THREE = () => advance([{ id: 'c', kindOf: 'cloud', x: 300, y: 100, seed: 1 }, { id: 'f', kindOf: 'flower', x: 310, y: 250, seed: 2 }, { id: 'z', kindOf: 'zombie', x: 100, y: 300, seed: 3 }, { id: 'b', kindOf: 'brain', x: 500, y: 300, seed: 4 }], HOUR);

test('scene.advance: a run with three changes writes one record with the three listed, in the owner\'s scope', async () => {
  const run = THREE();
  assert.equal(run.changes.length, 3);
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const res = await post(env, TOKEN, { op: 'scene', note: run.note, changes: run.changes });
  assert.equal(res.status, 200);
  const rows = records(env);
  assert.equal(rows.length, 1, 'one record for the whole run, not one per change');
  assert.equal(rows[0].kind, KIND); assert.equal(rows[0].owner, 'owner'); assert.equal(rows[0].ref, 'stage'); assert.equal(rows[0].state, 'done');
  assert.match(rows[0].result, /\[3: cloud rained; flower grew; zombie found brain\]$/);
  assert.ok(rows[0].result.startsWith(run.note), 'the record carries the note\'s own text');
  assert.equal(JSON.parse(await res.clone().text()).id, rows[0].id);
});

test('scene.advance: a paid member\'s record is theirs alone: they read it, nobody else does, a free account and a stranger write nothing', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  const ann = await account(env, 'annAnnAnnAnnAnnAnnAnn', 'paid'), bob = await account(env, 'bobBobBobBobBobBobBob', 'paid'), free = await account(env, 'freeFreeFreeFreeFreeFr', 'free');
  const run = THREE(), body = { op: 'scene', note: run.note, changes: run.changes };
  assert.equal((await post(env, ann, body)).status, 200);
  assert.equal((await post(env, free, body)).status, 403, 'a free account is told this is for paid members');
  assert.equal((await post(env, 'x'.repeat(43), body)).status, 401, 'a made-up session');
  assert.equal((await post(env, null, body)).status, 401, 'a stranger with nothing');
  assert.equal(records(env).length, 1, 'only the paid member\'s run was written');
  assert.equal(records(env)[0].owner, 'member:annAnnAnnAnnAnnAnnAnn');
  const annSees = (await (await get(env, ann)).json()).actions, bobSees = (await (await get(env, bob)).json()).actions, ownerSees = (await (await get(env, TOKEN)).json()).actions;
  assert.equal(annSees.length, 1); assert.equal(annSees[0].kind, KIND);
  assert.equal(bobSees.length, 0, 'another member sees nothing of it');
  assert.equal(ownerSees.length, 1, 'the owner sees every record');
  assert.equal((await get(env, free)).status, 403); assert.equal((await get(env, null)).status, 401);
  // a member cannot read the owner\'s other records through the owner filter, nor write any other kind of record
  await post(env, TOKEN, { op: 'begin', kind: 'extension.click', ref: 'x' });
  assert.equal((await (await get(env, ann, '?owner=owner')).json()).actions.every((r) => r.owner === 'member:annAnnAnnAnnAnnAnnAnn'), true);
  assert.equal((await post(env, ann, { op: 'begin', kind: 'extension.click' })).status, 401, 'only the scene door is open to a member');
});

test('scene.advance: nothing to say is not a record, a record a minute at most, words are only the known ones, a member keeps the newest few', async () => {
  const env = { READ_TOKEN: TOKEN, DB: d1() };
  assert.equal((await post(env, TOKEN, { op: 'scene', note: 'x', changes: [] })).status, 400);
  assert.equal((await post(env, TOKEN, { op: 'scene', note: 'x', changes: [{ kind: 'cloud', what: 'exploded' }, { kind: 'Cloud!', what: 'rained' }, { kind: 'cloud', what: 'rained', with: '<script>' }] })).status, 400, 'free text never becomes a change');
  const ok = { op: 'scene', note: 'While you were away (1 hour): the cloud rained.', changes: [{ kind: 'cloud', what: 'rained' }] };
  assert.equal((await post(env, TOKEN, ok)).status, 200);
  assert.equal((await post(env, TOKEN, ok)).status, 429, 'a second record inside the minute is refused');
  assert.equal(records(env).length, 1);
  const s = cleanScene({ note: 'n'.repeat(500) + '\n\u0000', changes: Array.from({ length: 60 }, () => ({ kind: 'cat', what: 'caught', with: 'mouse' })) });
  assert.equal(s.changes.length, MAX_CHANGES); assert.equal(s.note.length, 200); assert.ok(!/[\u0000-\u001f]/.test(s.note));
  assert.ok(describeScene(s).length <= 500 && describeScene(s).endsWith(']'), 'short enough for a record, still closed: ' + describeScene(s).length);
  // a member's old scene records are trimmed to MEMBER_KEEP, other people's and other kinds untouched
  const ann = await account(env, 'annAnnAnnAnnAnnAnnAnn', 'paid');
  for (let i = 0; i < MEMBER_KEEP + 5; i++) env.DB.raw.prepare("INSERT INTO void_actions (id, owner, kind, ref, state, result, error, started, finished) VALUES (?, 'member:annAnnAnnAnnAnnAnnAnn', ?, 'stage', 'done', 'old', NULL, ?, ?)").run('old-' + i, KIND, '2026-01-01T00:' + String(i % 60).padStart(2, '0') + ':' + String(Math.floor(i / 60)).padStart(2, '0') + 'Z', '2026-01-01T00:00:00Z');
  assert.equal((await post(env, ann, ok)).status, 200);
  const mine = records(env).filter((r) => r.owner === 'member:annAnnAnnAnnAnnAnnAnn');
  assert.equal(mine.length, MEMBER_KEEP);
  assert.equal(records(env).filter((r) => r.owner === 'owner').length, 1, 'the owner\'s record is untouched');
});
