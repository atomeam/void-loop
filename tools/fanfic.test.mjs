// /fanfic/: lib/fanfic.js (which boards are fandom boards, word count, reading time, cutting a story into posts the boards take, the writing
// streak, the period filter, paging, unread marks, the share link, fandom codes, the device signature, and how a thread reads as a story) and the
// page itself (posts only through the boards, nothing seeded, dark only).
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

test('file names, fandom codes, pen names and the device signature', () => {
  assert.equal(F.fileName('The Long Way Round!'), 'the-long-way-round.txt'); assert.equal(F.fileName(''), 'story.txt');
  assert.equal(F.ficCode('Harry Potter'), 'ficharrypo');
  assert.equal(F.ficCode('Harry Potter', new Set(['ficharrypo'])), 'ficharryp2', 'a taken code gets a number');
  assert.match(F.ficCode('日本語'), /^fic[a-z0-9]*$/);
  assert.equal(F.penName('  Ink # Quill  '), 'Ink  Quill'.replace('  ', ' '), 'no # so nobody types tripcode syntax');
  assert.equal(F.penName(''), '');
  assert.equal(F.signedName('Ink', 'abc'), 'Ink#abc'); assert.equal(F.signedName('', 'abc'), 'Anonymous#abc'); assert.equal(F.signedName('Ink', ''), 'Ink');
  const sec = F.newSecret(); assert.match(sec, /^[0-9a-f]{32}$/); assert.notEqual(sec, F.newSecret());
});

test('a summary and chapter lines read back as they were written', () => {
  assert.deepEqual(F.readSummary(F.withSummary('Two lines about it.', 'The story.')), { summary: 'Two lines about it.', text: 'The story.' });
  assert.deepEqual(F.readSummary('No summary here.'), { summary: '', text: 'No summary here.' });
  assert.deepEqual(F.readChapter(F.chapterHead(3, 'The Bridge') + 'Text.'), { n: 3, title: 'The Bridge', more: false, text: 'Text.' });
  assert.deepEqual(F.readChapter(F.chapterHead(3, '', true) + 'More.'), { n: 3, title: '', more: true, text: 'More.' });
  assert.equal(F.readChapter('Just a review.'), null);
  const para = 'word '.repeat(150).trim(), long = Array.from({ length: 14 }, (_, i) => 'Para ' + i + ' ' + para).join('\n\n');
  const one = F.chapterPosts(1, '', long, 'A summary.'), two = F.chapterPosts(2, 'Next', long);
  assert.ok(one.length > 1 && two.length > 1);
  assert.ok(one[0].startsWith('Summary: A summary.\n\n') && !F.readChapter(one[0]), 'chapter 1 opens the thread with its summary');
  assert.ok(two[0].startsWith('Chapter 2: Next\n\n') && two.slice(1).every((p) => p.startsWith('Chapter 2, continued\n\n')));
  for (const p of [...one, ...two]) { assert.ok(Array.from(p).length <= LIMITS.body); assert.ok(p.split('\n').length <= LIMITS.lines); assert.equal(cleanText(p, LIMITS.body, LIMITS.lines), p); }
});

test('a story is its signed chapters; every other reply, a forged chapter too, is a review', () => {
  const op = { no: 1, at: 100, bumped: 400, sub: 'The Long Way', name: 'Ink', trip: '!AAAAAAAAAA', body: F.withSummary('About it.', 'One two three.') };
  const posts = [op,
    { no: 2, at: 200, name: 'Ink', trip: '!AAAAAAAAAA', body: F.chapterHead(2, 'Bridge') + 'Four five.' },
    { no: 3, at: 210, name: 'Ink', trip: '!AAAAAAAAAA', body: F.chapterHead(2, '', true) + 'Six.' },
    { no: 4, at: 250, name: 'Reader', trip: '', body: 'Loved it.' },
    { no: 5, at: 260, name: 'Ink', trip: '!BBBBBBBBBB', body: F.chapterHead(3, 'Fake') + 'Not the author.' },
    { no: 6, at: 270, hidden: true },
    { no: 7, at: 300, name: 'Ink', trip: '!AAAAAAAAAA', body: F.chapterHead(3, 'End') + 'Seven.' }];
  const s = F.storyOf(op, posts);
  assert.equal(s.title, 'The Long Way'); assert.equal(s.summary, 'About it.'); assert.equal(s.author, 'Ink');
  assert.deepEqual(s.chapters.map((c) => [c.n, c.title, c.text, c.nos]), [[1, '', 'One two three.', [1]], [2, 'Bridge', 'Four five.\n\nSix.', [2, 3]], [3, 'End', 'Seven.', [7]]]);
  assert.deepEqual(s.reviews.map((p) => p.no), [4, 5], 'a chapter line under another mark is a review');
  assert.equal(s.words, 7); assert.equal(s.published, 100); assert.equal(s.updated, 300);
  const plain = F.storyOf({ ...op, trip: '' }, [{ no: 2, at: 200, name: 'Ink', trip: '', body: F.chapterHead(2) + 'x' }]);
  assert.equal(plain.chapters.length, 1, 'an unsigned story has chapter 1 only'); assert.equal(plain.reviews.length, 1);
  const row = F.topicOf({ ...op, replies: 6 }, { code: 'ficink', title: 'Ink', nsfw: false });
  assert.deepEqual([row.board, row.fandom, row.no, row.title, row.replies, row.bumped], ['ficink', 'Ink', 1, 'The Long Way', 6, 400]);
  assert.deepEqual(F.statsOf([{}, {}], [row, { ...row, no: 2, replies: 0 }]), { fandoms: 2, stories: 2, posts: 8, authors: 1 });
});

test('the page shows only real posts, posts only through the boards, and is dark only', () => {
  const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');
  const html = read('fanfic', 'index.html'), js = read('fanfic', 'app.js'), lib = read('lib', 'fanfic.js');
  const calls = [...js.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1].trim());
  assert.deepEqual([...new Set(calls)], ['API + qs'], 'one fetch, to the boards API');
  assert.match(js, /API = '\/api\/boards'/);
  assert.ok(!fs.existsSync(path.join(root, 'functions', 'api', 'fanfic.js')) && !fs.existsSync(path.join(root, 'functions', 'fanfic')), 'no endpoint of its own');
  assert.match(html, /An open room for stories\. Post your first thread to begin\./);
  assert.match(html, /Archive Descriptions &amp; Stories/);
  for (const s of ['Writing Room', 'Search', 'Writing Glossary', 'How to format chapters', 'Report spam or abuse here', 'Writing rules &amp; guidelines'])
    assert.ok(html.includes(s), 'the page has ' + s);
  for (const s of ['Mark all read', 'How to format chapters', 'Report spam or abuse here', 'Writing rules & guidelines']) assert.ok(js.includes(s), 'the script has ' + s);
  assert.deepEqual(Object.values(F.PERIODS), ['All topics', 'Today', 'This week']);
  for (const th of ['Topics', 'Replies', 'Author', 'Last post']) assert.ok(html.includes('>' + th + '</th>'), 'the topic list has ' + th);
  assert.ok(!/<tr>\s*<td/.test(html) && !/<li>[^<]*<a[^>]*\?f=/.test(html), 'no topic rows written into the page');
  for (const raw of [/\bsage\b/i, /Author code/i, /\btripcode\b/i, /\boptions\b/i]) assert.ok(!raw.test(html), 'no raw board field: ' + raw);
  assert.match(html, /<meta name="color-scheme" content="dark">/); assert.ok(!/prefers-color-scheme:\s*light|color-scheme:\s*light/.test(html), 'dark only');
  assert.ok(!/lorem ipsum|sample story|test story|example story/i.test(html + js + lib), 'nothing seeded');
  const headers = read('_headers'), block = headers.slice(headers.indexOf('/fanfic/*'));
  assert.ok(block.split('\n\n')[0].includes('https://challenges.cloudflare.com'), 'the archive may load the boards\' Turnstile check');
});

test('the stage card (skills/fanfic.js) answers the page\'s own stage ask, lists only fan-fiction boards and links back to /fanfic/', async () => {
  const { default: skill, fandomLines } = await import('../void-live-deploy/skills/fanfic.js');
  const { CARD_ASK } = await import('../void-live-deploy/lib/toolkit.js');
  const { PAGE_PATHS } = await import('../void-live-deploy/lib/card-frame.js');
  for (const ask of [CARD_ASK['/fanfic/'], 'fanfic archive', 'post a fanfic', 'open the fan fiction archive']) assert.ok(skill.match(ask.toLowerCase(), ask), ask);
  for (const ask of ['write a story about a dragon', 'image boards', 'fan of the knicks']) assert.ok(!skill.match(ask.toLowerCase(), ask), ask);
  assert.equal(PAGE_PATHS['/fanfic/'], 'Fan fiction');
  const lines = fandomLines([{ code: 'g', title: 'Random', last: 9 }, { code: 'ficdw', title: 'Doctor Who', last: 2 }, { code: 'ficx', title: 'Adult fandom', nsfw: true, last: 5 }]);
  assert.deepEqual(lines, [{ href: '/fanfic/?f=ficx', text: 'Adult fandom (18+)' }, { href: '/fanfic/?f=ficdw', text: 'Doctor Who' }]);
  assert.deepEqual(fandomLines(null), [], 'nothing posted: no lines, so the card says there are none yet');
});

test('the page opens offline: the service worker shells /fanfic/ at install and keeps its app.js like other page code', () => {
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8'); assert.match(sw, /const TOOLS = \[[^\]]*'\/fanfic\/'/);
  const code = /const pageCode = \(p\) => ([^\n]+);\n/.exec(sw); assert.ok(code, 'pageCode is one line'); const pageCode = new Function('p', 'return ' + code[1]);
  assert.equal(pageCode('/fanfic/app.js'), true); assert.equal(pageCode('/fanfic/index.html'), false); assert.equal(pageCode('/pdf/merge/app.js'), true, 'the other pages keep theirs');
});

test('the index list: find narrows it by title, fandom and pen name, and the CSV export is safe in a spreadsheet', async () => {
  const list = [{ board: 'ficdw', fandom: 'Doctor Who', title: 'The Café at the End', author: 'Rose', no: 4, replies: 2, bumped: Date.UTC(2026, 9, 29) },
    { board: 'ficx', fandom: 'Adult fandom', title: '=HYPERLINK("x")', author: 'Ann, "Q"', no: 9, nsfw: true, replies: 0, bumped: 0 }];
  assert.deepEqual(F.findIn(list, 'cafe doctor').map((t) => t.no), [4], 'every word, accents ignored');
  assert.deepEqual(F.findIn(list, 'ann').map((t) => t.no), [9]); assert.equal(F.findIn(list, '  ').length, 2); assert.equal(F.findIn(list, 'zebra').length, 0);
  const csv = F.storiesCsv(list, 'https://a-to-mind.com').split('\r\n');
  assert.equal(csv[0], 'Title,Fandom,Author,Replies,Rating,Last post,Link');
  assert.equal(csv[1], 'The Café at the End,Doctor Who,Rose,2,All ages,2026-10-29T00:00:00.000Z,https://a-to-mind.com/fanfic/?f=ficdw&s=4');
  assert.equal(csv[2], '"\'=HYPERLINK(""x"")",Adult fandom,"Ann, ""Q""",0,18+,,https://a-to-mind.com/fanfic/?f=ficx&s=9', 'a formula is made text; quotes and commas are escaped');
  const page = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8'), app = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  assert.match(page, /<input type="search" id="find"/); assert.match(page, />Copy link</); assert.match(page, />Export list \(\.csv\)</);
  assert.match(app, /u\.set\('find', v\)/, 'what was typed goes in the address, so the link restores it');
  assert.match(page, /<details class="keys"><summary>Keyboard shortcuts<\/summary>/); assert.match(page, /aria-keyshortcuts="\/"/);
});

test('German: the archive\'s own words change, what readers wrote never does', async () => {
  const DE = await import('../void-live-deploy/lib/fanfic-de.js');
  assert.equal(DE.de('Mark all read'), 'Alle als gelesen markieren'); assert.equal(DE.de('  Post story '), '  Geschichte veröffentlichen ', 'spaces kept');
  assert.equal(DE.de('Chapter 3 of 7'), 'Kapitel 3 von 7'); assert.equal(DE.de('Page 2 of 5'), 'Seite 2 von 5'); assert.equal(DE.de('Reviews (4)'), 'Rezensionen (4)');
  assert.equal(DE.de('A line nobody wrote here'), 'A line nobody wrote here', 'unknown text stays as it is');
  assert.equal(DE.deTitle('Writing Room · Fan fiction · Verse'), 'Schreibzimmer · Fanfiction · Verse');
  assert.equal(DE.langOf('?lang=de', 'en', 'en-US'), 'de'); assert.equal(DE.langOf('', 'en', 'de-DE'), 'en', 'the device\'s pick over the browser');
  assert.equal(DE.langOf('', '', 'de-AT'), 'de'); assert.equal(DE.langOf('', '', 'en-GB'), 'en');
  for (const v of Object.values(DE.DICT)) assert.ok(!Object.prototype.hasOwnProperty.call(DE.DICT, v) || DE.DICT[v] === v, 'no German word is itself a key: ' + v);
  const app = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  for (const m of ["a.translate = false", "pen.translate = false", "prose.translate = false", "body.translate = false"]) assert.ok(app.includes(m), m);
});
