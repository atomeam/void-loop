// /fanfic/: lib/fanfic.js (which boards are fandom boards, word count, reading time, cutting a story into posts the boards take, the writing
// streak, the period filter, paging, unread marks, the share link) and the page itself (no write of its own, nothing seeded).
// Run: node --test tools/fanfic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as F from '../void-live-deploy/lib/fanfic.js';
import { LIMITS, cleanText } from '../void-live-deploy/lib/boards.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy');
const DAY = 864e5;

test('a fandom board is one whose code starts with fic or whose line or title says fan fiction', () => {
  assert.ok(F.isFicBoard({ code: 'ficpotter', title: 'Potter', about: '' }));
  assert.ok(F.isFicBoard({ code: 'hp', title: 'HP', about: 'Fan fiction: the wizarding world' }));
  assert.ok(F.isFicBoard({ code: 'anime', title: 'Anime fanfic', about: '' }));
  assert.ok(!F.isFicBoard({ code: 'tech', title: 'Technology', about: 'Computers and phones' }));
  assert.ok(!F.isFicBoard({ code: 'g', title: 'Fantastic gear', about: 'fanatic gear talk' }));
  assert.ok(!F.isFicBoard(null));
});

test('words and reading time', () => {
  assert.equal(F.words(''), 0);
  assert.equal(F.words("Harry didn't look back — the well-worn path, 12 steps."), 9);
  assert.equal(F.words('日本語'), 3);
  assert.equal(F.readMinutes(0), 0); assert.equal(F.readMinutes(1), 1); assert.equal(F.readMinutes(230), 1); assert.equal(F.readMinutes(231), 2);
  assert.equal(F.readLabel(0), 'nothing yet'); assert.equal(F.readLabel(50), 'under a minute'); assert.equal(F.readLabel(2300), 'about 10 min read');
});

test('a story is cut into parts the boards keep whole, at paragraph breaks, losing no words', () => {
  assert.deepEqual(F.splitParts('   '), []);
  assert.deepEqual(F.splitParts('One short chapter.'), ['One short chapter.']);
  const para = 'word '.repeat(150).trim(); // 749 characters
  const story = Array.from({ length: 14 }, (_, i) => 'Para ' + i + ' ' + para).join('\n\n');
  const parts = F.splitParts(story);
  assert.ok(parts.length >= 3);
  for (const p of parts) {
    assert.ok(Array.from(p).length <= LIMITS.body, 'a part fits in one post');
    assert.ok(p.split('\n').length <= LIMITS.lines, 'a part fits the line limit');
    assert.equal(cleanText(p, LIMITS.body, LIMITS.lines), p, 'the boards keep the part as it is');
    assert.ok(/^Para \d+ /.test(p), 'each part starts at a paragraph');
  }
  assert.equal(F.words(parts.join('\n\n')), F.words(story), 'no word is lost');
  const lines = Array.from({ length: 300 }, (_, i) => 'line ' + i).join('\n');
  for (const p of F.splitParts(lines)) assert.ok(p.split('\n').length <= LIMITS.lines);
  assert.equal(F.words(F.splitParts(lines).join('\n')), 600);
  const long = 'x'.repeat(9000); // one word longer than a post is cut, not lost
  assert.equal(F.splitParts(long).join(''), long);
});

test('the writing streak counts days in a row, alive until a day is missed', () => {
  const now = new Date(2026, 9, 29, 15).getTime(), d = (n) => F.dayOf(now - n * DAY);
  assert.equal(F.streak({}, now), 0);
  assert.equal(F.streak({ [d(0)]: 10, [d(1)]: 5, [d(2)]: 1, [d(4)]: 9 }, now), 3);
  assert.equal(F.streak({ [d(1)]: 5, [d(2)]: 1 }, now), 2, 'nothing yet today keeps yesterday\'s streak');
  assert.equal(F.streak({ [d(2)]: 5 }, now), 0);
  const kept = F.trimDays({ [d(0)]: 3, [d(500)]: 4, [d(3)]: 0 }, now);
  assert.deepEqual(Object.keys(kept), [d(0)]);
});

test('period filter, paging and unread marks', () => {
  const now = new Date(2026, 9, 29, 15).getTime();
  const ts = [{ board: 'fic', no: 1, bumped: now - 3600e3 }, { board: 'fic', no: 2, bumped: now - 3 * DAY }, { board: 'fic', no: 3, bumped: now - 30 * DAY }];
  assert.deepEqual(F.inPeriod(ts, 'today', now).map((t) => t.no), [1]);
  assert.deepEqual(F.inPeriod(ts, 'week', now).map((t) => t.no), [1, 2]);
  assert.equal(F.inPeriod(ts, 'all', now).length, 3);
  const many = Array.from({ length: 45 }, (_, i) => i);
  assert.deepEqual(F.pageOf(many, 1), { items: many.slice(0, 20), page: 1, pages: 3 });
  assert.equal(F.pageOf(many, 9).page, 3); assert.equal(F.pageOf(many, 9).items.length, 5);
  assert.equal(F.pageOf([], 4).pages, 1);
  assert.ok(F.unread(ts[0], { all: 0, seen: {} }));
  assert.ok(!F.unread(ts[0], { all: now, seen: {} }), 'mark all read');
  assert.ok(!F.unread(ts[1], { all: 0, seen: { 'fic/2': ts[1].bumped } }), 'read on this device');
  assert.ok(F.unread(ts[1], { all: 0, seen: { 'fic/2': ts[1].bumped - 1 } }), 'a newer post shows it again');
});

test('a share link holds the draft itself and reads back the same, any language', () => {
  const d = { title: 'Ünder the Sea 🌊', text: 'Line one\n\n日本語 and "quotes" & <tags>' };
  const h = F.shareHash(d);
  assert.match(h, /^room=[A-Za-z0-9_-]+$/);
  assert.deepEqual(F.readShare('#' + h), d);
  assert.equal(F.readShare('#room=!!!'), null); assert.equal(F.readShare('#p12'), null); assert.equal(F.readShare(''), null);
  assert.equal(F.readShare('#room=' + Buffer.from('{"t":1}').toString('base64url')), null, 'no text, no draft');
});

test('file names and the hand-off to a board', () => {
  assert.equal(F.fileName('The Long Way Round!'), 'the-long-way-round.txt'); assert.equal(F.fileName(''), 'story.txt');
  const now = Date.now(), h = F.handoff('ficpotter', 'A title', 'Some words.', now);
  assert.deepEqual({ ...h }, { b: 'ficpotter', sub: 'A title', parts: ['Some words.'], i: 0, t: 0, at: now });
  assert.ok(F.liveHandoff(h, now + 1000));
  assert.equal(F.liveHandoff(h, now + F.HANDOFF_TTL + 1), null, 'an old story never fills a form');
  assert.equal(F.liveHandoff({ ...h, i: 1 }, now), null, 'all parts posted');
});

test('the page reads the boards and writes nothing of its own; nothing is seeded', () => {
  const html = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8'), js = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  assert.ok(!/method\s*:\s*['"](?:POST|PUT|DELETE|PATCH)/i.test(js), 'no write from /fanfic/');
  assert.ok(!fs.existsSync(path.join(root, 'functions', 'api', 'fanfic.js')) && !fs.existsSync(path.join(root, 'functions', 'fanfic')), 'no endpoint of its own');
  assert.match(html, /An open room for stories\. Post your first thread to begin\./);
  for (const s of ['Writing Room', 'Search', 'Writing Glossary', 'How to format chapters', 'Report spam or abuse here', 'Writing rules and guidelines', 'Mark all read', 'This week', 'Today', 'All topics'])
    assert.ok(html.includes(s), 'the page has ' + s);
  for (const th of ['Topics', 'Replies', 'Author', 'Last post']) assert.ok(html.includes('>' + th + '</th>'), 'the topic list has ' + th);
  assert.ok(!/<tr>\s*<td/.test(html), 'no topic rows written into the page');
  const boards = fs.readFileSync(path.join(root, 'boards', 'app.js'), 'utf8');
  assert.ok(boards.includes("'a2m.void.fanfic.post.v1'") && F.HANDOFF === 'a2m.void.fanfic.post.v1', 'the boards read the same hand-off key');
});
