import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../void-live-deploy/lib/idea-core.js';

const lists = {
  page: [{ id: '/arcade/', name: 'Arcade' }, { id: '/films/', name: 'Verse Films' }, { id: '/films/', name: 'dupe' }],
  game: [{ id: 'snake', name: 'snake', family: 'games' }, { id: 'pong', name: 'pong', family: 'games' }],
  skill: [{ id: 'joke', name: 'joke', family: 'words' }, { id: 'vat', name: 'vat', family: 'numbers' }, { id: 'client-brief', name: 'client brief', family: 'self' }],
  card: [{ id: 'movie-card.js', name: 'movie card' }],
};
const inv = c.inventory(lists);

test('inventory counts each thing once, by kind', () => {
  assert.equal(inv.total, 8);
  assert.deepEqual(inv.counts, { page: 2, game: 2, skill: 3, card: 1 });
});

test('signals keep a topic only when 3+ people typed it, and never the asks themselves', () => {
  const s = c.signals({ misses: [{ ask: 'snake high score', count: 2 }, { ask: 'snake speed', count: 1 }, { ask: 'my secret plan', count: 1 }], pages: [{ k: '/', n: 9 }, { k: '/arcade/', n: 4 }] }, inv.items);
  assert.deepEqual(s.wanted.map((w) => w.topic), ['snake']);
  assert.equal(s.wanted[0].near, 'snake');
  assert.deepEqual(s.stay, [{ path: '/arcade/', views: 4 }]);
  assert.ok(!JSON.stringify(s).includes('secret plan'));
});

test('lenses fit the thing: no versus on a calculator, no ideas on business or internal skills', () => {
  const versus = c.LENSES.find((l) => l.id === 'versus');
  assert.ok(c.fits(versus, { kind: 'game', id: 'snake' }));
  assert.ok(!c.fits(versus, { kind: 'skill', family: 'numbers', id: 'vat' }));
  const ideas = c.generate(inv, { wanted: [], stay: [] }, { day: '2026-11-20', per: 30 });
  assert.ok(ideas.every((i) => !(i.targets || []).includes('client-brief')));
  assert.ok(ideas.filter((i) => i.lens === 'versus').every((i) => ['snake', 'pong'].includes(i.targets[0])));
  assert.deepEqual(c.generate(inv, { wanted: [], stay: [] }, { day: 'x' }).map((i) => i.slug), c.generate(inv, { wanted: [], stay: [] }, { day: 'x' }).map((i) => i.slug));
});

test('dedupe drops what exists, what an older list has, what was already picked, and twins', () => {
  const cands = [{ gen: 'seed', title: 'Arcade', slug: 'arcade' }, { gen: 'signal', title: 'a daily word puzzle with a streak', slug: 'a' },
    { gen: 'improve', title: 'Make snake feel alive', slug: 'make-snake' }, { gen: 'improve', title: 'Make snake feel alive', slug: 'make-snake' }, { gen: 'mashup', title: 'old pick', slug: 'old-pick' }];
  const { keep, dropped } = c.dedupe(cands, inv, { known: ['daily word puzzle with a streak'], board: { history: { 'old-pick': { status: 'shipped' } } } });
  assert.deepEqual(keep.map((k) => k.slug), ['make-snake']);
  assert.deepEqual(dropped, { exists: 1, listed: 1, picked: 1, twin: 1 });
});

test('taste: fun and growing what exists score above a business tool or a new page', () => {
  const fun = c.score({ gen: 'improve', lens: 'secret', title: 'Hide a secret in snake', targets: ['snake'], prior: { fun: 5, use: 2, wow: 5, ease: 4 } });
  const biz = c.score({ gen: 'seed', title: 'client onboarding pack on a new page', prior: { fun: 3, use: 3, wow: 2, ease: 3 } });
  assert.ok(fun.total > biz.total + 15, fun.total + ' vs ' + biz.total);
  assert.equal(c.score({ gen: 'x', title: 't', prior: {} }, { x: 1.4 }).total, Math.round(c.score({ gen: 'x', title: 't', prior: {} }).total * 1.4));
});

test('tournament and picks: varied, ranked, at most one business idea', () => {
  const mk = (i, gen, t, fun) => c.score({ gen, slug: 's' + i, title: t, targets: ['t' + i], prior: { fun, use: 3, wow: 3, ease: 3 } });
  const ranked = c.tournament([mk(1, 'improve', 'a game', 5), mk(2, 'improve', 'b game', 4), mk(3, 'seed', 'client pack', 2), mk(4, 'seed', 'client intake', 2), mk(5, 'mashup', 'c puzzle', 4)]);
  assert.equal(ranked[0].slug, 's1');
  const p = c.picks(ranked, 4);
  assert.equal(p.length, 4);
  assert.equal(p.filter((x) => /client/.test(x.title)).length, 1);
});

test('measure and learn: used ideas grow, unused old ones are reworked (never deleted), generators reweight', () => {
  const now = Date.parse('2026-12-20T00:00:00Z');
  const h = c.measure({ a: { gen: 'improve', status: 'shipped', shippedAt: '2026-12-01' }, b: { gen: 'mashup', status: 'shipped', shippedAt: '2026-11-25' }, d: { gen: 'seed', status: 'shipped', shippedAt: '2026-12-15' }, e: { status: 'picked' } },
    [{ id: 'idea-a', days: 4 }, { id: 'idea-b', days: 1 }], now);
  assert.deepEqual([h.a.status, h.b.status, h.d.status, h.e.status], ['grow', 'rework', 'shipped', 'picked']);
  assert.deepEqual(c.learn(h), { improve: 1.4, mashup: 0.7, seed: 1 });
});

test('a take idea: parsed off the take, grows an existing thing when one fits, starts only above the bar', () => {
  const t = c.splitTake('Pluto lost planet status in 2006.\nIDEA: game: a planet-sorting game where you drag worlds into orbit');
  assert.equal(t.take, 'Pluto lost planet status in 2006.');
  assert.deepEqual(t.idea, { kind: 'game', title: 'a planet-sorting game where you drag worlds into orbit' });
  assert.equal(c.splitTake('Just a take.').idea, null);
  assert.equal(c.splitTake('A take.\nIDEA: nonsense').take, 'A take.');
  assert.ok(c.judgeTake(t.idea, 'Pluto').start);
  assert.equal(c.judgeTake({ kind: 'tool', title: 'client status pack for agencies' }, 'x').start, false);
  assert.equal(c.judgeTake({ kind: 'trick', title: 'snake game secret speed run mode' }, 'x', ['snake game']).extend, 'snake game');
  assert.equal(c.judgeTake(t.idea, 'Pluto', [], [t.idea && c.slug(t.idea.title)]).start, false);
});

test('a want for the will names the gate and the use hook', () => {
  const w = c.wantOf({ ...c.score({ gen: 'improve', slug: 'x-y', title: 'T', targets: ['snake'], prior: {} }), wins: 2 });
  assert.equal(w.kind, 'idea engine');
  assert.match(w.why, /ideaUsed\('x-y'\)/);
  assert.match(w.why, /stranger test/);
});
