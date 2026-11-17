// adventure (skills/adventure.js + lib/adventure.js, books in void-live-deploy/data/adventures/): branching stories
// with inventory and flag gates, multiple endings, seeded runs and shareable run codes. Pure engine plus routing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sk from '../void-live-deploy/skills/adventure.js';
import * as A from '../void-live-deploy/lib/adventure.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BOOK_IDS = ['chrono-signal', 'obsidian-keep', 'neon-harbour'];
const books = Object.fromEntries(BOOK_IDS.map((id) => [id, JSON.parse(readFileSync(join(root, 'void-live-deploy/data/adventures/' + id + '.json'), 'utf8'))]));
const book = books['chrono-signal'];

test('the shipped book is valid: every choice leads somewhere, every node ends or branches', () => {
  assert.deepEqual(A.validateBook(book), []);
  assert.ok(A.validateBook(null).length);
  assert.ok(A.validateBook({ id: 'x', title: 'X', start: 'nope', nodes: {} }).some((e) => /start/.test(e)));
  assert.ok(A.validateBook({ id: 'x', title: 'X', start: 'a', nodes: { a: { prose: 'hi', choices: [{ text: 'go', to: 'lost' }] } } }).some((e) => /nowhere/.test(e)));
});

test('gates hold and effects land: the torch opens the hatch, the keycard breaks the loop', () => {
  let run = { ...A.createRun(book.id, 7), node: book.start };
  assert.equal(A.availableChoices(book, run).length, 3);
  run = A.choose(book, run, 1).run; // trace the shaft
  assert.equal(run.node, 'trace');
  const toCoords = A.availableChoices(book, run).find((c) => c.to === 'coords');
  run = A.choose(book, run, toCoords.i).run;
  assert.ok(run.pack.includes('plasma_torch'));
  const cross = A.availableChoices(book, run).find((c) => c.to === 'cross');
  assert.ok(cross.open, 'the torch opens the fused hatch');
  // without the keycard the master clock stays shut
  let r2 = { ...A.createRun(book.id, 7), node: 'voice' };
  const breaking = A.availableChoices(book, r2).find((c) => c.to === 'break');
  assert.ok(!breaking.open && /signal_key/.test(breaking.need), 'locked, and it says what is missing: ' + breaking.need);
  assert.equal(A.choose(book, r2, breaking.i).ok, false);
});

test('every shipped book is valid, reachable, gated and properly ended', () => {
  for (const [id, b] of Object.entries(books)) {
    assert.deepEqual(A.validateBook(b), [], id + ' validates');
    assert.ok(Object.keys(b.nodes).length >= 8, id + ' has a real arc');
    // every node is reachable from the start and every ending is reachable, gates aside
    const seen = new Set([b.start]), q = [b.start];
    while (q.length) for (const c of (A.getNode(b, q.pop()).choices || [])) if (!seen.has(c.to)) { seen.add(c.to); q.push(c.to); }
    assert.deepEqual([...seen].sort(), Object.keys(b.nodes).sort(), id + ': no orphan nodes');
    const endings = Object.entries(b.nodes).filter(([, n]) => n.ending);
    assert.ok(endings.length >= 2, id + ' has multiple endings');
    assert.ok(endings.every(([, n]) => (n.choices || []).length === 0), id + ': endings end');
    const gated = Object.values(b.nodes).flatMap((n) => n.choices || []).filter((c) => c.needs);
    assert.ok(gated.length >= 2, id + ' gates choices on the pack or flags');
  }
});

test('the new books play through to an ending on first-open choices', () => {
  const walk = (b) => {
    let run = { ...A.createRun(b.id, 11), node: b.start };
    const seen = new Set([b.start]);
    for (let i = 0; i < 40 && !A.getNode(b, run.node).ending; i++) {
      const open = A.availableChoices(b, run).filter((c) => c.open);
      assert.ok(open.length, b.id + ' never dead-ends at ' + run.node);
      const next = open.find((c) => !seen.has(c.to)) || open[0];
      seen.add(next.to);
      run = A.choose(b, run, next.i).run;
    }
    return run;
  };
  for (const id of ['obsidian-keep', 'neon-harbour']) {
    const run = walk(books[id]);
    assert.ok(A.getNode(books[id], run.node).ending, id + ' reaches an ending');
    assert.ok(A.runFromCode(books[id], A.runCode(run)), id + ' replays from its code');
  }
});
test('endings end: three fates, the path remembered, codes replay and share', () => {
  let run = { ...A.createRun(book.id, 7), node: 'dock' };
  run = A.choose(book, run, 0).run; // signal
  run = A.choose(book, run, 0).run; // voice (heard_warning set by the choice)
  assert.ok(run.flags.heard_warning);
  run = A.choose(book, run, 1).run; // keep the loop
  assert.equal(run.node, 'keep');
  assert.equal(A.getNode(book, 'keep').ending.kind, 'mystery');
  assert.deepEqual(A.availableChoices(book, run), []);
  const code = A.runCode(run);
  const replay = A.runFromCode(book, code);
  assert.deepEqual(replay, run, 'a run code replays the same run');
  assert.equal(A.runFromCode(book, 'nope'), null);
  assert.equal(A.omenFor('dock', 7), A.omenFor('dock', 7), 'same seed, same omen');
});

test('routing: the shelf and its book are taken, other stories are left', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const a of ['cyoa', 'continue my adventure', 'adventure book', 'open the chrono signal', 'play adventure', 'play the adventure game', 'interactive fiction', 'chrono-signal', 'obsidian-keep', 'neon-harbour', 'start the obsidian keep', 'start the neon harbour']) assert.ok(sk.match(a, a), a);
  for (const a of ['adventure time', 'the adventure of the hero', 'chess adventure', 'what is an adventure', 'define adventure', 'adventure', 'watch adventure', 'adventure trailer']) assert.ok(!sk.match(a, a), a);
  assert.equal(A.adventureAsk('play adventure').id, 'chrono-signal');
  assert.equal(A.adventureAsk('chrono-signal').id, 'chrono-signal');
  assert.equal(A.adventureAsk('obsidian-keep').id, 'obsidian-keep');
  assert.equal(A.adventureAsk('the neon harbour').id, 'neon-harbour');
  assert.equal(A.adventureAsk('interactive fiction').id, 'chrono-signal');
  assert.equal(A.adventureAsk('adventure time'), null);
  assert.equal(A.adventureAsk('what is an adventure'), null);
  assert.equal(A.adventureAsk('watch adventure'), null);
  assert.equal(A.adventureAsk('adventure'), null, 'bare adventure belongs to the games hub');
});
