// Stage pack F, the Opposite Era (owner, 2026-10-18): the blood feud (skills/feud.js), the glitch oracle (skills/oracle.js), the
// crowd engine (skills/crowd.js), the unkeepable (skills/unkeepable.js) and spectators (skills/spectators.js): their routing and
// their pure laws, with numbers. node --test tools/stage-pack-f.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import feud, * as F from '../void-live-deploy/skills/feud.js';
import oracle, * as O from '../void-live-deploy/skills/oracle.js';
import crowd, * as C from '../void-live-deploy/skills/crowd.js';
import unkeepable, * as U from '../void-live-deploy/skills/unkeepable.js';
import spectators, * as S from '../void-live-deploy/skills/spectators.js';

const routes = (skill, yes, no) => { for (const a of yes) assert.ok(skill.match(a.toLowerCase(), a), skill.name + ' takes: ' + a); for (const a of no) assert.ok(!skill.match(a.toLowerCase(), a), skill.name + ' leaves: ' + a); };

test('feud: the asks route, three near misses each do not', () => {
  routes(feud, ['start a blood feud between the clock and the note', 'blood feud between the counter and the timer', 'End the feud!', 'declare a feud between the list and the notepad'],
    ['blood test', 'family feud', 'what is a blood feud', 'bet on the horses', 'end the timer', 'bet the counter on the clock']); // a bet routes only while a feud runs
  assert.deepEqual(F.feudOf('start a blood feud between the clock and the note'), { a: 'clock', b: 'note' });
  assert.deepEqual(F.feudOf('call off the feud'), { end: true });
  assert.deepEqual(F.betOf('bet the counter on the clock'), { stake: 'counter', on: 'clock' });
  assert.equal(F.betOf('bet on the clock'), null);
});
test('feud: a word finds a thing by its name first, then by its kind (the newest), never one already taken', () => {
  const things = { c1: { id: 'c1', kind: 'clock' }, s1: { id: 's1', kind: 'sticky', text: 'milk' }, s2: { id: 's2', kind: 'sticky', text: 'eggs', name: 'shopping' }, t1: { id: 't1', kind: 'timer' } };
  assert.equal(F.findThing('clock', things).id, 'c1'); assert.equal(F.findThing('note', things).id, 's2', 'the newest note');
  assert.equal(F.findThing('shopping', things).id, 's2'); assert.equal(F.findThing('milk', things).id, 's1', 'the words on it');
  assert.equal(F.findThing('note', things, ['s2']).id, 's1'); assert.equal(F.findThing('counter', things), null); assert.equal(F.findThing('', things), null);
  assert.equal(F.labelOf(things.s2), 'shopping'); assert.equal(F.labelOf(things.s1), 'the note'); assert.equal(F.labelOf({ kind: 'pong' }), 'the pong');
});
test('feud: seeded and deterministic, both drain every second, it ends in 5 to 12 seconds, and there is always a loser', () => {
  const a = { id: 'clock_1' }, b = { id: 'sticky_1' };
  const run = () => { const f = F.newFeud(a, b); const log = []; let r; do { r = F.step(f); log.push([f.a.life, f.b.life]); } while (!r.over); return { f, r, log }; };
  const x = run(), y = run();
  assert.deepEqual(x.log, y.log, 'the same pair plays the same feud');
  assert.ok(x.log.length >= 5 && x.log.length <= 12, 'ticks: ' + x.log.length);
  for (let i = 1; i < x.log.length; i++) { assert.ok(x.log[i][0] < x.log[i - 1][0] && x.log[i][1] < x.log[i - 1][1], 'both drain on tick ' + i); }
  assert.ok(['a', 'b'].includes(x.r.winner));
  const other = F.newFeud({ id: 'clock_1' }, { id: 'sticky_2' }); let r2; const l2 = []; do { r2 = F.step(other); l2.push([other.a.life, other.b.life]); } while (!r2.over);
  assert.notDeepEqual(l2, x.log, 'another pair, another feud');
  for (let t = 1; t < 50; t++) { const d0 = F.damageAt(5, t, 0); assert.ok(d0 >= F.DMG_MIN && d0 < F.DMG_MIN + F.DMG_SPAN); assert.equal(d0, F.damageAt(5, t, 0)); }
  const f = F.newFeud(a, b); f.a.life = 1; f.b.life = 1; const r = F.step(f); assert.equal(r.over, true);
  const da = F.damageAt(f.seed, f.tick, 0), db = F.damageAt(f.seed, f.tick, 1); assert.equal(r.winner, db > da ? 'a' : da > db ? 'b' : 'a', 'equal life, both fall: the one that took less that second wins, else the first named');
  const g = F.newFeud(a, b); g.a.life = 5; g.b.life = 1; assert.equal(F.step(g).winner, 'a', 'both fall: more life before wins');
});
test('feud: settling: the loser dissolves, a kept loser is only defeated, a bet dissolves or moves beside the winner', () => {
  const mk = () => ({ c: { id: 'c', kind: 'clock', x: 100, y: 100 }, s: { id: 's', kind: 'sticky', text: 'hi' }, n: { id: 'n', kind: 'counter', x: 10, y: 10 } });
  let th = mk(); let out = F.settle({ a: { id: 'c' }, b: { id: 's' }, bet: null }, th, { over: true, winner: 'a' });
  assert.deepEqual(out.gone, ['s']); assert.ok(!th.s && th.c); assert.match(out.line, /the clock wins the feud; the note dissolves/);
  th = mk(); th.s.keep = true; out = F.settle({ a: { id: 'c' }, b: { id: 's' }, bet: null }, th, { over: true, winner: 'a' });
  assert.deepEqual(out.defeated, ['s']); assert.equal(th.s.defeated, true); assert.match(out.line, /defeated but kept/);
  th = mk(); out = F.settle({ a: { id: 'c' }, b: { id: 's' }, bet: { id: 'n', on: 'c' } }, th, { over: true, winner: 'a' });
  assert.deepEqual(out.moved, ['n']); assert.deepEqual([th.n.x, th.n.y], [136, 172]); assert.match(out.line, /the bet pays/);
  th = mk(); out = F.settle({ a: { id: 'c' }, b: { id: 's' }, bet: { id: 'n', on: 's' } }, th, { over: true, winner: 'a' });
  assert.deepEqual(out.gone, ['s', 'n']); assert.match(out.line, /the bet is lost/);
  th = mk(); out = F.settle({ a: { id: 'c' }, b: { id: 's' }, bet: { id: 'n', on: 's' } }, th, { over: true, winner: null });
  assert.ok(th.c && th.s && th.n); assert.match(out.line, /a draw.*the bet is returned/);
});

test('oracle: the asks route, three near misses each do not; the question is taken whole', () => {
  routes(oracle, ['ask the glitch oracle why is the sky blue', 'glitch oracle: what is rain', 'Ask the glitch oracle, how far is the moon?'],
    ['oracle database', 'the oracle of delphi', 'ask the oracle', 'glitch in the matrix', 'oracle cloud pricing']);
  assert.equal(O.oracleOf('ask the glitch oracle why is the sky blue?'), 'why is the sky blue?');
  assert.equal(O.oracleOf('glitch oracle: what is rain'), 'what is rain');
});
test('oracle: the corruption is seeded, reversible, holds one of each kind, and marks wrong words only by a data attribute', () => {
  const text = 'Sunlight scatters off air molecules, and blue light scatters most of all because its wavelength is short [1].';
  const a = O.corrupt(text, 7), b = O.corrupt(text, 7), c = O.corrupt(text, 8);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
  assert.equal(O.reveal(a), text, 'reveal gives the text back');
  assert.equal(O.reveal(O.corrupt(text)), text, 'with the default seed too');
  const n = O.countOf(a); assert.ok(n.flicker >= 1 && n.redact >= 1 && n.wrong >= 1, JSON.stringify(n));
  for (const s of a) if (s.k === 'wrong') { assert.notEqual(s.w, s.s); assert.ok(s.w.length > 0); }
  const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const h = O.html(a, esc);
  assert.ok(/class="gl-flicker"/.test(h) && /class="gl-redact"/.test(h) && /data-o="w"/.test(h));
  assert.ok(!/class="[^"]*wrong/.test(h), 'a wrong word carries no visible class');
  assert.ok(/class="gl-redact"[^>]*>█+<\/span>/.test(h) && !new RegExp('gl-redact[^>]*>[^<]*' + a.find((s) => s.k === 'redact').s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(h), 'a redacted word shows only blocks');
  const evil = O.html(O.corrupt('<b>bold</b> words here and some more words to fill', 3), esc); assert.ok(!/<b>/.test(evil), 'escaped');
  assert.deepEqual(O.corrupt('', 1), []); assert.equal(O.reveal(O.corrupt('one two', 2)), 'one two');
});

test('crowd: the asks route, three near misses each do not', () => {
  routes(crowd, ['summon the crowd', 'dismiss the crowd', 'bring the crowd in', 'disperse the crowd'], ['crowdfunding', 'crowd control tips', 'how big is the crowd at wembley', 'a crowded train', 'summon a figure']);
  assert.equal(C.crowdOf('Summon the crowd!'), 'summon'); assert.equal(C.crowdOf('send the crowd home'), 'dismiss');
});
test('crowd: the size follows the last minute, the mood follows the last event, and Verse is spelt in points', () => {
  assert.equal(C.sizeFor(0), C.MIN); assert.equal(C.sizeFor(2), C.MIN + 50); assert.equal(C.sizeFor(1000), C.MAX); assert.equal(C.sizeFor(-3), C.MIN);
  assert.equal(C.recent([1000, 10000, 50000, 70000], 65000), 2, 'the one 64 s ago and the one still to come are out');
  assert.equal(C.moodOf({ type: 'added', at: 1000 }, 1500), 'cheer'); assert.equal(C.moodOf({ type: 'removed', at: 1000 }, 3000), 'flee');
  assert.equal(C.moodOf({ type: 'added', at: 1000 }, 5000), 'idle'); assert.equal(C.moodOf({ type: 'drag', at: 1000 }, 1500), 'swarm'); assert.equal(C.moodOf({ type: 'drag', at: 1000 }, 2500), 'idle');
  assert.equal(C.moodOf({ type: 'added', at: 1000 }, 1000 + C.IDLE_MS), 'spell'); assert.equal(C.moodOf(null, 99999999), 'idle'); assert.equal(C.moodOf({ type: 'start', at: 0 }, 500), 'idle');
  const pts = C.spellPoints('Verse'); assert.ok(pts.length > 40 && pts.every((p) => p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1));
  assert.equal(C.spellPoints('V').length, 13); assert.equal(C.spellPoints('1').length, 10);
});
test('crowd: the law: seeded; cheering rises; fleeing leaves the spot; swarming gathers; spelling lands on the word', () => {
  const same = (n) => { const s = C.create(3, n); for (let i = 0; i < 30; i++) C.step(s, 1 / 60, 'idle'); return Array.from(s.x.slice(0, 10)); };
  assert.deepEqual(same(50), same(50)); assert.notDeepEqual(same(50), Array.from(C.create(4, 50).x.slice(0, 10)));
  const cheer = C.create(1, 80); assert.ok(Math.abs(C.measure(cheer).meanVy) < 0.01, 'at rest'); for (let i = 0; i < 20; i++) C.step(cheer, 1 / 60, 'cheer'); assert.ok(C.measure(cheer).meanVy < -0.3, 'rising (those past the top come back from below): ' + C.measure(cheer).meanVy);
  const flee = C.create(1, 80), t = { x: 0.5, y: 0.5 }, d0 = C.measure(C.step(flee, 0, 'flee', t)).meanDist; for (let i = 0; i < 40; i++) C.step(flee, 1 / 60, 'flee', t); assert.ok(C.measure(flee).meanDist > d0 + 0.03, 'fled: ' + d0 + ' -> ' + C.measure(flee).meanDist);
  const swarm = C.create(1, 80), s0 = C.measure(C.step(swarm, 0, 'swarm', { x: 0.2, y: 0.8 })).meanDist; for (let i = 0; i < 120; i++) C.step(swarm, 1 / 60, 'swarm', { x: 0.2, y: 0.8 }); assert.ok(C.measure(swarm).meanDist < s0 * 0.5, 'gathered: ' + s0 + ' -> ' + C.measure(swarm).meanDist);
  const spell = C.create(1, 120); for (let i = 0; i < 400; i++) C.step(spell, 1 / 60, 'spell'); assert.ok(C.measure(spell).spelt > 0.9, 'on the word: ' + C.measure(spell).spelt);
  for (let i = 0; i < spell.n; i++) assert.ok(spell.x[i] >= 0 && spell.x[i] <= 1 && spell.y[i] >= 0 && spell.y[i] <= 1);
  const grown = C.resize(C.create(2, 40), 90); assert.equal(grown.n, 90); assert.equal(grown.x.length, 90); assert.equal(C.resize(grown, 30).n, 30);
});

test('unkeepable: the asks route, three near misses each do not', () => {
  routes(unkeepable, ['make me something unkeepable', 'give me something that cannot be kept', 'something unkeepable', 'conjure an unkeepable thing', 'make something I can\'t keep'],
    ['keep this', 'make me something to eat', 'what does unkeepable mean', 'save this', 'make me a sticky note']);
});
test('unkeepable: it fades over its minute, shatters the same way for the same seed, and knows every way of keeping it', () => {
  assert.equal(U.opacityAt(0), 1); assert.ok(U.opacityAt(30000) > 0.7 && U.opacityAt(30000) < 0.8); assert.equal(U.opacityAt(U.LIFE_MS), 0.06); assert.equal(U.opacityAt(99 * U.LIFE_MS), 0.06);
  assert.deepEqual(U.shardsOf(9), U.shardsOf(9)); assert.notDeepEqual(U.shardsOf(9), U.shardsOf(10)); assert.equal(U.shardsOf(1).length, 14); assert.equal(U.shardsOf(1, 5).length, 5);
  for (const s of U.shardsOf(2)) assert.ok(Number.isFinite(s.dx) && Number.isFinite(s.dy) && s.delay >= 0 && s.delay <= 80);
  assert.equal(U.trapOf({ type: 'copy' }), 'copy'); assert.equal(U.trapOf({ type: 'dragstart' }), 'copy'); assert.equal(U.trapOf({ type: 'keydown', key: 's', ctrlKey: true }), 'save');
  assert.equal(U.trapOf({ type: 'keydown', key: 'C', metaKey: true }), 'copy'); assert.equal(U.trapOf({ type: 'keydown', key: 'p', metaKey: true }), 'save');
  assert.equal(U.trapOf({ type: 'keydown', key: 's' }), null, 'a plain s is typing'); assert.equal(U.trapOf({ type: 'keydown', key: 'a', ctrlKey: true }), null);
  assert.equal(U.trapOf({ type: 'button', name: 'keep' }), 'keep'); assert.equal(U.trapOf({ type: 'button', name: 'save' }), 'save'); assert.equal(U.trapOf(null), null);
  assert.equal(U.phraseOf(3), U.phraseOf(3)); assert.ok(U.phraseOf(1).length > 5); assert.equal(typeof U.phraseOf('x'), 'string');
});

test('spectators: the asks route, three near misses each do not', () => {
  routes(spectators, ['open the stage to spectators', 'close the stage', 'let spectators in', 'close the stage to spectators'], ['spectator sport', 'invite someone', 'share this card', 'open the book', 'close']);
  assert.equal(S.spectateOf('Open my stage for spectators'), 'open'); assert.equal(S.spectateOf('no more spectators'), 'close');
});
test('spectators: the snapshot is words only, leaves out the unkeepable and the ephemeral, packs into a link and unpacks the same', () => {
  const things = { c: { id: 'c', kind: 'clock', x: 10.4, y: 20 }, s: { id: 's', kind: 'sticky', x: 30, y: 40, text: 'milk\nand eggs' }, l: { id: 'l', kind: 'list', x: 1, y: 1, items: [['bread', 1], ['jam', 0]] },
    u: { id: 'u', kind: 'unkeepable', x: 0, y: 0, text: 'secret' }, f: { id: 'f', kind: 'feud', x: 0, y: 0 }, k: { id: 'k', kind: 'kept', x: 5, y: 5, name: 'tip', html: '<h2>tip</h2><p>be kind</p>' }, bad: { id: 'bad', kind: 'Not A Kind!', x: 0, y: 0 } };
  const snap = S.snapshotOf(things, (html) => html.replace(/<[^>]+>/g, ' ').trim());
  assert.deepEqual(snap.map((s) => s.k), ['clock', 'sticky', 'list', 'kept']);
  assert.deepEqual(snap[1], { k: 'sticky', x: 30, y: 40, t: 'milk' }); assert.equal(snap[2].t, 'bread · jam'); assert.equal(snap[0].x, 10); assert.equal(snap[3].t, 'tip');
  assert.ok(!JSON.stringify(snap).includes('secret'), 'the unkeepable is never copied');
  const code = S.pack(snap, 1700000000000), back = S.unpack(code);
  assert.ok(/^[A-Za-z0-9_-]+$/.test(code)); assert.deepEqual(back, { at: 1700000000000, things: snap });
  assert.equal(S.linkOf('https://a-to-mind.com/', code), 'https://a-to-mind.com/?spectate=' + code);
  assert.equal(S.codeFromUrl('https://a-to-mind.com/?spectate=' + code), code); assert.equal(S.codeFromUrl('https://a-to-mind.com/?with=abc'), null); assert.equal(S.codeFromUrl('not a url'), null);
  assert.equal(S.unpack('nope'), null); assert.equal(S.unpack(''), null);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  assert.equal(S.unpack(b64({ v: 1, things: [{ k: 'clock', x: 'x', y: 1 }] })), null, 'a bad place is refused');
  assert.equal(S.unpack(b64({ v: 2, things: [] })), null); assert.equal(S.unpack(b64({ v: 1, things: Array(41).fill({ k: 'clock', x: 1, y: 1 }) })), null);
  assert.deepEqual(S.unpack(b64({ v: 1, at: 5, things: [{ k: 'clock', x: 99999, y: -4, t: '<b>x</b>\u0000y' }] })).things, [{ k: 'clock', x: 4000, y: 0, t: '<b>x</b> y' }], 'clamped, control characters out, markup left for textContent');
  const big = Array.from({ length: 24 }, (_, i) => ({ k: 'sticky', x: i, y: i, t: 'w'.repeat(160) }));
  assert.ok(S.pack(big).length <= S.MAX_CODE && S.unpack(S.pack(big)).things.length === 24 && S.unpack(S.pack(big)).things[0].t.length <= 60, 'a long stage is shortened to fit the link');
  assert.equal(S.snapshotOf(Object.fromEntries(Array.from({ length: 30 }, (_, i) => ['s' + i, { id: 's' + i, kind: 'sticky', x: i, y: i, text: 'n' + i }]))).length, S.MAX_THINGS);
});
test('spectators card: the link is shortened in the middle to what the field holds, and what is shared is named from the snapshot itself', () => {
  const link = 'https://a-to-mind.com/?spectate=' + 'eyJ2IjoxLCJhdCI6MTc5'.repeat(6);
  assert.equal(S.shownLink(link).startsWith('a-to-mind.com/?spectate='), true); assert.equal(S.shownLink('http://x.y/'), 'x.y/');
  const m = S.middle(S.shownLink(link), 30);
  assert.equal(m.length, 30); assert.ok(m.startsWith('a-to-mind.com/?spe') && m.endsWith(link.slice(-11)) && m.includes('…'), m);
  assert.equal(S.middle('short', 30), 'short'); assert.equal(S.middle('abcdefghij', 2).length, 5, 'never under 5'); assert.equal(S.middle(null, 10), '');
  assert.ok(S.middle(S.shownLink(link), S.LINK_MAX).length <= S.LINK_MAX);
  assert.deepEqual(S.thingName({ k: 'sticky', t: 'buy milk and eggs' }), { name: 'Note', words: 'buy milk and eggs' });
  assert.deepEqual(S.thingName({ k: 'clock', t: 'clock' }), { name: 'Clock', words: '' }, 'no word that only repeats the name');
  assert.deepEqual(S.thingName({ k: 'counter', t: 'counter 4' }), { name: 'Counter', words: '4' });
  assert.deepEqual(S.thingName({ k: 'word-cloud', t: '' }), { name: 'Word cloud', words: '' });
  assert.ok(!S.thingName({ k: 'sticky', t: 'a very long note that goes on and on past the chip' }).words.endsWith('…'));
  const snap = Array.from({ length: 10 }, (_, i) => ({ k: i ? 'sticky' : 'clock', x: 0, y: 0, t: i ? 'n' + i : '' }));
  const sum = S.summaryOf(snap);
  assert.equal(sum.line, 'Anyone with this link sees a read-only snapshot of 10 things on your stage.');
  assert.equal(sum.names.length, 8); assert.equal(sum.more, 2); assert.deepEqual(sum.names[0], { name: 'Clock', words: '' }); assert.deepEqual(sum.names[1], { name: 'Note', words: 'n1' });
  assert.equal(S.summaryOf(snap.slice(0, 1)).line, 'Anyone with this link sees a read-only snapshot of 1 thing on your stage.');
  assert.match(S.summaryOf([]).line, /empty right now/); assert.equal(S.summaryOf(null).n, 0);
  // the names come from the link's own snapshot: what a spectator will see is what the card lists
  const back = S.unpack(S.pack(snap.slice(0, 3), 1)); assert.deepEqual(S.summaryOf(back.things).names, S.summaryOf(snap.slice(0, 3)).names);
});
