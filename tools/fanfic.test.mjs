// /fanfic/: lib/fanfic.js (which boards are fandom boards, word count, reading time, cutting a story into posts the boards take, the writing
// streak, the period filter, paging, unread marks, the share link, fandom codes, the device signature, and how a thread reads as a story) and the
// page itself (posts only through the boards, nothing seeded, dark only).
// Run: node --test tools/fanfic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import * as F from '../void-live-deploy/lib/fanfic.js';
import { LIMITS, cleanText, excerpt } from '../void-live-deploy/lib/boards.js';
import zlib from 'node:zlib';

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
  const none = F.cleanDetails({});
  assert.deepEqual(F.readSummary(F.withSummary('Two lines about it.', 'The story.')), { summary: 'Two lines about it.', text: 'The story.', details: none });
  assert.deepEqual(F.readSummary('No summary here.'), { summary: '', text: 'No summary here.', details: none });
  assert.deepEqual(F.readChapter(F.chapterHead(3, 'The Bridge') + 'Text.'), { n: 3, title: 'The Bridge', more: false, done: false, text: 'Text.' });
  assert.deepEqual(F.readChapter(F.chapterHead(3, '', true) + 'More.'), { n: 3, title: '', more: true, done: false, text: 'More.' });
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
  assert.deepEqual(F.rowFigures(s), ['3 chapters', '7 words', '2 reviews'], 'a catalog row counts the whole story, not the opening post');
  const starred = F.storyOf(op, [{ no: 8, at: 310, name: 'Reader', trip: '', body: F.reviewBody('Good.', 4) }, { no: 9, at: 320, name: 'Ink', trip: '!AAAAAAAAAA', body: F.reviewBody('Mine.', 1) }]);
  assert.deepEqual(F.rowFigures(starred), ['1 chapter', '3 words', '2 reviews', '★ 4'], 'the writer\'s own stars do not count');
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
  assert.deepEqual([...new Set(calls.map((c) => c.split(' ')[0]))], ['API', 'HITS'], 'stories through the boards API, read counts through the hits API, nothing else');
  assert.match(js, /API = '\/api\/boards'/); assert.match(js, /HITS = '\/api\/fanfic-hits'/);
  assert.ok(!fs.existsSync(path.join(root, 'functions', 'api', 'fanfic.js')), 'no endpoint of its own');
  // the one function under /fanfic/ is the read-only feed: it reads the boards' own GET handler and takes no post
  assert.deepEqual(fs.readdirSync(path.join(root, 'functions', 'fanfic')), ['rss.js']);
  const feed = read('functions', 'fanfic', 'rss.js');
  assert.ok(!/onRequest(?:Post|Put|Delete|Patch)?\b(?!Get)/.test(feed.replace(/onRequestGet/g, '')) && !/fetch\(/.test(feed) && /from '\.\.\/api\/boards\/\[\[path\]\]\.js'/.test(feed), 'the feed only reads the boards');
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

test('the page asks the server again for every file of its module before it imports it, so a deploy never runs old code under a new page', async () => {
  const { graphOf } = await import('./preload.mjs');
  const html = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8');
  const list = JSON.parse(html.match(/const CODE = (\[[^\]]*\]);/)[1].replace(/'/g, '"'));
  assert.deepEqual(list, graphOf('<script type="module">import "/fanfic/app.js";</script>'), 'the list is the module and its static imports, in order');
  assert.match(html, /CODE\.map\(\(u\) => fetch\(u, \{ cache: 'no-cache' \}\)\.catch\(\(\) => \{\}\)\)\)\.then\(\(\) => import\('\/fanfic\/app\.js'\)\)/, 'the import waits for the fresh copies; an offline fetch error still imports');
  assert.match(html, /addEventListener\('load', \(\) => \{ Promise\.all\(CODE/, 'after the load event, so the page speed is not touched');
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
  assert.equal(DE.de('3 chapters'), '3 Kapitel'); assert.equal(DE.de('1,204 words'), '1,204 Wörter'); assert.equal(DE.de('1 review'), '1 Rezension(en)');
  assert.equal(DE.de('A line nobody wrote here'), 'A line nobody wrote here', 'unknown text stays as it is');
  assert.equal(DE.deTitle('Writing Room · Fan fiction · Verse'), 'Schreibzimmer · Fanfiction · Verse');
  assert.equal(DE.langOf('?lang=de', 'en', 'en-US'), 'de'); assert.equal(DE.langOf('', 'en', 'de-DE'), 'en', 'the device\'s pick over the browser');
  assert.equal(DE.langOf('', '', 'de-AT'), 'de'); assert.equal(DE.langOf('', '', 'en-GB'), 'en');
  for (const v of Object.values(DE.DICT)) assert.ok(!Object.prototype.hasOwnProperty.call(DE.DICT, v) || DE.DICT[v] === v, 'no German word is itself a key: ' + v);
  const app = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  for (const m of ["a.translate = false", "pen.translate = false", "prose.translate = false", "body.translate = false"]) assert.ok(app.includes(m), m);
});

test('every view that holds a text hands it to the translator and the word counter: the story, the Writing Room and the post form', () => {
  const app = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  assert.match(app, /handing = id === 'room' \? \(\) => draft\(\)\.text : id === 'post' \? \(\) => \$\('stForm'\)\.elements\.text\.value : null/, 'the room and the post form hand their text');
  assert.match(app, /handing = \(\) => \(c \? c\.text : ''\)/, 'the story hands the chapter being read');
  assert.match(app, /mountRelated\(\$\('related'\), '\/fanfic\/', hand\)/, 'through the shared row (lib/toolkit.js)');
});

test('story details: a known rating, at most 3 known genres, at most 6 characters and known warnings, written above the summary and read back', () => {
  const d = F.cleanDetails({ rating: 'teen', genres: 'romance, Mystery, Nonsense, Drama, Horror', characters: 'Ana, Bo, ana, ' + 'x'.repeat(60) + ', C, D, E, F', warnings: ['violence', 'Spoilers'] });
  assert.deepEqual(d.rating, 'Teen'); assert.deepEqual(d.genres, ['Drama', 'Mystery', 'Romance'], 'the list order, unknown dropped, 3 at most');
  assert.equal(d.characters.length, 6); assert.deepEqual(d.characters.slice(0, 2), ['Ana', 'Bo']); assert.equal(d.characters[2].length, 40, 'a name is one line of 40 at most');
  assert.deepEqual(d.warnings, ['Violence']); assert.equal(F.cleanDetails({ rating: 'Explicit' }).rating, '', 'an unknown rating is none');
  const body = F.withSummary('About it.', 'The story.', { rating: 'Mature', genres: ['Angst'], characters: 'Ana', warnings: ['Dark themes'] });
  assert.equal(body, 'Warnings: Dark themes\nGenres: Angst\nCharacters: Ana\nRated: Mature\nSummary: About it.\n\nThe story.', 'the rating last, so names end at a label');
  assert.deepEqual(F.readSummary(body), { summary: 'About it.', text: 'The story.', details: { rating: 'Mature', genres: ['Angst'], characters: ['Ana'], warnings: ['Dark themes'], status: '', series: '', part: 0 } });
  assert.deepEqual(F.readSummary(F.withSummary('', 'Just text.', { rating: 'General' })), { summary: '', text: 'Just text.', details: { ...F.cleanDetails({}), rating: 'General' } });
  assert.equal(F.withSummary('About it.', 'The story.', {}), F.withSummary('About it.', 'The story.'), 'no details, the body is as before');
  const posts = F.chapterPosts(1, '', Array.from({ length: 14 }, (_, i) => 'Para ' + i + ' ' + 'word '.repeat(150).trim()).join('\n\n'), 'S.', { rating: 'Teen', genres: ['Drama'], characters: 'Ana', warnings: ['Violence'] });
  assert.ok(posts[0].startsWith('Warnings: Violence\n'));
  // a board's catalog gives each post as one line of at most 300 characters (lib/boards.js excerpt): the details read back from that too
  const most = { rating: 'Mature', genres: ['Hurt/Comfort', 'Sci-fi', 'Adventure'], characters: Array.from({ length: 6 }, (_, i) => 'Name' + i + ' ' + 'y'.repeat(30)).join(','), warnings: F.WARNINGS };
  const full = F.cleanDetails(most); assert.ok(full.characters.join(', ').length <= F.DETAIL_LIMITS.line && full.characters.length >= 3, 'at most 136 characters of names');
  const flat = excerpt(F.withSummary('About it.', 'The story goes on and on. '.repeat(20), most), 300);
  assert.deepEqual(F.readSummary(flat).details, full, 'every detail fits in the 300 a catalog keeps');
  assert.deepEqual(F.readSummary(excerpt(body, 300)).details, F.readSummary(body).details);
  assert.deepEqual(F.readSummary('Characters: Ana and then the story').details.characters, [], 'names with no label after them are not guessed');
  assert.equal(F.readSummary('Rated: Teen and then the story').text, 'and then the story');
  for (const p of posts) { assert.ok(p.split('\n').length <= LIMITS.lines); assert.equal(cleanText(p, LIMITS.body, LIMITS.lines), p); }
  const row = F.topicOf({ no: 1, at: 1, sub: 'T', body }, { code: 'ficx', title: 'X' });
  assert.deepEqual([row.rating, row.genres, row.characters, row.warnings, row.summary], ['Mature', ['Angst'], ['Ana'], ['Dark themes'], 'About it.']);
  assert.equal(F.detailsLine(row), 'Warnings: Dark themes · Rated Mature · Angst · Characters: Ana'); assert.equal(F.detailsLine({}), '');
});

test('the catalog filters by rating, genres, characters, warnings and title letter, and sorts four ways', () => {
  const t = (no, title, extra = {}) => ({ no, title, at: no, bumped: 10 - no, replies: no % 3, rating: '', genres: [], characters: [], warnings: [], ...extra });
  const list = [t(1, 'Zebra', { rating: 'Teen', genres: ['Romance', 'Drama'], characters: ['Zoë Hart'] }), t(2, 'apple', { rating: 'General', genres: ['Romance'] }),
    t(3, '“Élan”', { warnings: ['Violence'], characters: ['Bo'] }), t(4, '42 Days', { rating: 'Teen' })];
  const nos = (a) => a.map((x) => x.no);
  assert.deepEqual(nos(F.filterStories(list, {})), [1, 2, 3, 4]);
  assert.deepEqual(nos(F.filterStories(list, { rating: 'Teen' })), [1, 4]);
  assert.deepEqual(nos(F.filterStories(list, { genres: ['Romance'] })), [1, 2]); assert.deepEqual(nos(F.filterStories(list, { genres: ['Romance', 'Drama'] })), [1], 'every genre asked for');
  assert.deepEqual(nos(F.filterStories(list, { characters: 'zoe' })), [1], 'part of a name, case and accents ignored');
  assert.deepEqual(nos(F.filterStories(list, { noWarnings: true })), [1, 2, 4]);
  assert.deepEqual(nos(F.filterStories(list, { letter: 'e' })), [3]); assert.deepEqual(nos(F.filterStories(list, { letter: '#' })), [4]);
  assert.deepEqual([F.letterOf('apple'), F.letterOf('“Élan”'), F.letterOf('42 Days'), F.letterOf('')], ['A', 'E', '#', '#']);
  assert.deepEqual(nos(F.sortStories(list, 'recent')), [1, 2, 3, 4]); assert.deepEqual(nos(F.sortStories(list, 'newest')), [4, 3, 2, 1]);
  assert.deepEqual(nos(F.sortStories(list, 'title')), [4, 2, 3, 1]); assert.deepEqual(nos(F.sortStories(list, 'replies')), [2, 1, 4, 3], 'stable on ties');
  assert.deepEqual(nos(F.sortStories(list, 'nonsense')), nos(F.sortStories(list, 'recent')));
  assert.deepEqual(Object.keys(F.SORTS), ['recent', 'newest', 'title', 'replies']);
});

test('the index shows the filters, the sort and the A to Z bar, and the post form asks for a rating', () => {
  const html = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8');
  for (const id of ['fSort', 'fRated', 'fChars', 'fGenres', 'fNoWarn', 'fAz', 'stGenres', 'stWarnings', 'storyDetails']) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(html, /<select name="rating" required/);
  const de = fs.readFileSync(path.join(root, 'lib', 'fanfic-de.js'), 'utf8');
  for (const s of ['Titles A to Z', 'Hide stories with warnings', ...Object.values(F.SORTS), ...F.GENRES, ...F.WARNINGS]) assert.ok(de.includes("'" + s + "'") || de.includes(' ' + s.replace(/[^A-Za-z]/g, '') + ':'), 'German for ' + s);
});

test('the Authors list counts each pen name and mark once, A to Z, and Random story picks from the list', () => {
  const t = (no, author, trip, bumped, title = 'T' + no) => ({ no, author, trip, bumped, at: bumped, title, rating: '', genres: [], characters: [], warnings: [] });
  const list = [t(1, 'zed', 'aa', 5), t(2, 'Ána', '', 9), t(3, 'zed', 'aa', 7), t(4, 'zed', 'bb', 1), t(5, 'Bo', '', 2)];
  const w = F.authorsOf(list);
  assert.deepEqual(w.map((a) => [a.author, a.trip, a.stories, a.last]), [['Ána', '', 1, 9], ['Bo', '', 1, 2], ['zed', 'aa', 2, 7], ['zed', 'bb', 1, 1]]);
  assert.deepEqual(F.authorsOf([]), []);
  assert.equal(F.authorKey(list[0]), 'zed!aa'); assert.equal(F.authorKey(list[1]), 'Ána'); assert.equal(F.authorKey({}), 'Anonymous');
  assert.deepEqual(F.filterStories(list, { by: 'zed!aa' }).map((x) => x.no), [1, 3], 'one writer, not a namesake');
  assert.equal(F.randomOf([], () => 0.5), null); assert.equal(F.randomOf(null), null);
  assert.equal(F.randomOf(list, () => 0).no, 1); assert.equal(F.randomOf(list, () => 0.999999).no, 5); assert.equal(F.randomOf(list, () => 1).no, 5, 'never past the end');
});

test('the archive has Authors, Help and Random story, with the help desk as a pinned notice', () => {
  const html = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8'), app = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  for (const id of ['authors', 'random', 'n-help', 'authorRows', 'fBy', 'fByAll']) assert.match(html, new RegExp('id="' + id + '"'), id);
  for (const h of ['?v=authors', '?notice=help', '?v=random']) assert.ok(html.includes('href="/fanfic/' + h + '"'), h);
  assert.match(app, /\['help', 'Help desk: questions and answers'\]/);
  const de = fs.readFileSync(path.join(root, 'lib', 'fanfic-de.js'), 'utf8');
  for (const s of ['Random story', 'Help desk: questions and answers', 'Show every author', 'Authors A to Z']) assert.ok(de.includes("'" + s + "'"), 'German for ' + s);
});

test('the archive home features one story with why, never an 18+ or locked one, and shows nothing with no story', async () => {
  const { featuredOf } = await import('../void-live-deploy/lib/fanfic.js');
  assert.equal(featuredOf([]), null);
  assert.equal(featuredOf([{ no: 1, nsfw: true, replies: 9 }, { no: 2, locked: true, replies: 9 }]), null, 'no 18+ or locked story is featured');
  const a = { no: 1, replies: 3, bumped: 5 }, b = { no: 2, replies: 7, bumped: 1 }, c = { no: 3, replies: 1, bumped: 9, status: 'Complete' }, x = { no: 4, replies: 99, nsfw: true };
  assert.deepEqual(featuredOf([a, b, x]), { t: b, why: 'The story with the most replies.' });
  assert.deepEqual(featuredOf([a, b, c, x]), { t: c, why: 'The complete story with the most replies.' }, 'a complete story comes first');
  assert.equal(featuredOf([{ no: 5, replies: 0, bumped: 1 }, { no: 6, replies: 0, bumped: 2 }]).t.no, 6, 'with no replies, the newest');
  const html = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8');
  assert.match(html, /<div class="glass feat" id="featured" aria-labelledby="featH" hidden>/, 'the panel starts hidden: an empty archive shows no empty panel');
  // the story link gets its address with its title (app.js drawFeatured): a link with an address and no name is an unnamed control to a screen
  // reader and to the tower gate's wider-use look (2026-10-29: the gate read 10.5 of 11 while it had one)
  assert.match(html, /<a class="t" id="featLink" data-go translate="no"><\/a>/, 'the empty featured link has no address');
  const DE = await import('../void-live-deploy/lib/fanfic-de.js');
  for (const s of ['Featured story', 'Why it is featured:', 'The story with the most replies.', 'The complete story with the most replies (none have replies yet, so the newest).']) assert.notEqual(DE.de(s), s, 'German for ' + s);
});

test('the archive has site news, pinned first on the story lists, with a dated news archive in English and German', async () => {
  const html = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8'), app = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  assert.match(app, /const NOTICES = \[\['news', 'Site news and the news archive'\],/, 'site news is the first pinned notice');
  assert.ok(html.includes('href="/fanfic/?notice=news" data-go>News</a>'), 'the footer links the news');
  const art = /<article class="notice" id="n-news" hidden>([\s\S]*?)<\/article>/.exec(html);
  assert.ok(art, 'the news page');
  assert.match(art[1], />News archive</, 'the news archive heading');
  for (const m of art[1].matchAll(/<time datetime="([^"]+)">/g)) assert.match(m[1], /^\d{4}-\d{2}-\d{2}$/, 'each day carries its date');
  const DE = await import('../void-live-deploy/lib/fanfic-de.js');
  // every text the news page shows, cut at its tags, has German
  const texts = art[1].replace(/<[^>]+>/g, '\n').split('\n').map((x) => x.trim()).filter((x) => /[A-Za-z]{3}/.test(x) && x !== 'RSS');
  assert.ok(texts.length > 10);
  for (const x of texts) assert.notEqual(DE.de(x), x, 'German for ' + x);
});

test('the archive has terms, disclaimer and credits pages, linked from the footer and not pinned on the story lists', async () => {
  const html = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8'), app = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  for (const id of ['terms', 'disclaimer', 'credits']) {
    assert.match(html, new RegExp('<article class="notice" id="n-' + id + '" hidden>'), id + ' page');
    assert.ok(html.includes('href="/fanfic/?notice=' + id + '" data-go>'), id + ' footer link');
  }
  assert.match(app, /const SITE_PAGES = \[\['terms', 'Terms of use'\], \['disclaimer', 'Disclaimer'\], \['credits', 'Credits'\]\];/);
  assert.match(app, /rows\.replaceChildren\(\.\.\.NOTICES\.map\(noticeRow\)\)/, 'only the notices are pinned');
  assert.match(app, /NOTICES\.concat\(SITE_PAGES\)/, 'the router opens the site pages');
  assert.ok(html.includes('href="mailto:atom@a-to-mind.com">atom@a-to-mind.com</a> with the link to the post'), 'takedowns go to the address the board rules give');
  const DE = await import('../void-live-deploy/lib/fanfic-de.js');
  for (const s of ['Terms of use', 'Disclaimer', 'Credits', 'Terms', 'Verse charges nothing to read or to post.']) assert.notEqual(DE.de(s), s, 'German for ' + s);
});

test('the feed lists the newest stories first, links each story, escapes what readers wrote and leaves adult fandoms out', async () => {
  const t = (no, bumped, extra = {}) => ({ board: 'ficx', fandom: 'X & Y', no, title: 'T' + no, author: 'a', summary: 's', bumped, at: bumped, ...extra });
  const rss = F.storiesRss([t(1, 1e12), t(2, 2e12, { title: '<b>"Q"</b>', author: 'P&Q' }), t(3, 3e12, { nsfw: true })], 'https://x.test');
  assert.match(rss, /^<\?xml version="1.0" encoding="UTF-8"\?><rss version="2.0"/);
  assert.ok(rss.indexOf('ficx/2') < rss.indexOf('ficx/1'), 'newest first');
  assert.ok(!rss.includes('ficx/3'), 'no adult fandom in a shared feed');
  assert.ok(rss.includes('<link>https://x.test/fanfic/?f=ficx&amp;s=2</link>'));
  assert.ok(rss.includes('&lt;b&gt;&quot;Q&quot;&lt;/b&gt; (X &amp; Y)') && rss.includes('<dc:creator>P&amp;Q</dc:creator>'));
  assert.ok(!/<item>/.test(F.storiesRss([], 'https://x.test')), 'an empty archive is a feed with no items');
  assert.equal((F.storiesRss(Array.from({ length: 80 }, (_, i) => t(i + 1, i + 1)), '').match(/<item>/g) || []).length, 50);
  const html = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8');
  assert.match(html, /<link rel="alternate" type="application\/rss\+xml"[^>]*href="\/fanfic\/rss">/);
  assert.match(html, /Most recent[\s\S]*RSS/);
  const { onRequestGet } = await import('../void-live-deploy/functions/fanfic/rss.js');
  const r = await onRequestGet({ env: {}, request: new Request('https://a-to-mind.com/fanfic/rss') });
  assert.equal(r.headers.get('content-type'), 'application/rss+xml; charset=utf-8');
  assert.ok(!/<item>/.test(await r.text()), 'no boards here: an empty feed, never an error');
});

test('a story is in progress or complete: said on chapter 1, or by a later chapter that ends it, signed with the story\'s mark', () => {
  const op = (body, trip = 'aa') => ({ no: 1, at: 1, sub: 'S', name: 'n', trip, body });
  const first = F.chapterPosts(1, '', 'One.', 'Sum.', { rating: 'Teen', status: 'in progress' })[0];
  assert.match(first, /^Status: In progress\n/);
  assert.equal(F.readSummary(first).details.status, 'In progress');
  assert.equal(F.cleanDetails({ status: 'finished' }).status, '', 'an unknown status is none');
  const last = F.chapterPosts(2, 'End', 'Two.', '', null, true);
  assert.equal(last[0], 'Chapter 2: End\n\nStatus: Complete\n\nTwo.');
  assert.deepEqual(F.readChapter(last[0]), { n: 2, title: 'End', more: false, done: true, text: 'Two.' });
  assert.equal(F.storyOf(op(first), [{ no: 2, at: 2, trip: 'aa', body: last[0] }]).details.status, 'Complete');
  assert.equal(F.storyOf(op(first), [{ no: 2, at: 2, trip: 'zz', body: last[0] }]).details.status, 'In progress', 'a review cannot finish the story');
  assert.equal(F.storyOf(op(first), [{ no: 2, at: 2, trip: 'aa', body: F.chapterPosts(2, '', 'Two.')[0] }]).chapters[1].text, 'Two.');
  // the catalog's flat excerpt (newlines made spaces) keeps the status
  const flat = F.topicOf({ no: 1, body: first.replace(/\n+/g, ' '), name: 'n', trip: 'aa' }, { code: 'ficx', title: 'X' });
  assert.equal(flat.status, 'In progress'); assert.equal(flat.rating, 'Teen');
  assert.equal(F.detailsLine({ status: 'Complete', rating: 'Teen' }), 'Complete · Rated Teen');
  const most = { status: 'In progress', rating: 'Mature', genres: ['Hurt/Comfort', 'Friendship', 'Adventure'], warnings: F.WARNINGS, characters: ['a', 'b', 'c', 'd', 'e'].map((x) => x.repeat(40)).join(',') };
  const lines = F.detailLines(most).trim(); assert.ok(lines.length <= 300, 'the longest details fit the catalog excerpt: ' + lines.length);
  assert.equal(F.topicOf({ no: 1, body: (lines + '\n\nSummary: s\n\nText').replace(/\s+/g, ' ').slice(0, 300), name: 'n' }, { code: 'ficx', title: 'X' }).rating, 'Mature');
  const list = [{ ...flat }, { ...flat, no: 2, status: 'Complete' }, { ...flat, no: 3, status: '', series: '', part: 0 }];
  assert.deepEqual(F.filterStories(list, { status: 'Complete' }).map((t) => t.no), [2]);
  assert.deepEqual(F.filterStories(list, { status: 'In progress' }).map((t) => t.no), [1]);
  const hits = [{ board: 'ficx', thread: 1, trip: 'aa', body: last[0] }, { board: 'ficx', thread: 3, trip: 'bb', body: last[0] }, { board: 'ficx', thread: 1, trip: 'aa', body: 'Status: Complete' }, { board: 'ficx', thread: 3, trip: 'aa', body: 'Chapter 2, continued Status: Complete' }];
  assert.deepEqual(F.finishedLater(list, hits).map((t) => t.status), ['Complete', 'Complete', ''], 'only a chapter signed with the story\'s mark finishes it');
  const flatHit = [{ board: 'ficx', thread: 3, trip: 'aa', body: 'Chapter 2: The End Status: Complete Two.' }];
  assert.deepEqual(F.finishedLater(list, flatHit).map((t) => t.status), ['In progress', 'Complete', 'Complete'], 'a search excerpt (one line) counts too');
});

test('a review can give 1 to 5 stars: the story averages them, the writer\'s own and none-given leave the average alone, and stars never make a chapter', () => {
  assert.equal(F.reviewBody('Loved it.', 4), 'Stars: 4 of 5\n\nLoved it.');
  assert.equal(F.reviewBody('Loved it.', '0'), 'Loved it.'); assert.equal(F.reviewBody('x', 9), 'x'); assert.equal(F.reviewBody('x', 'abc'), 'x');
  assert.deepEqual(F.readReview('Stars: 4 of 5\n\nLoved it.'), { stars: 4, text: 'Loved it.' });
  assert.deepEqual(F.readReview('Stars: 4 of 5 Loved it.'), { stars: 0, text: 'Stars: 4 of 5 Loved it.' }, 'only the line the form writes counts');
  assert.deepEqual(F.readReview('Plain words.'), { stars: 0, text: 'Plain words.' });
  assert.deepEqual(F.starsOf([]), { avg: 0, n: 0 });
  const op = { no: 1, at: 1, sub: 'S', name: 'Ink', trip: 'aa', body: 'One.' };
  const posts = [{ no: 2, at: 2, trip: '', body: F.reviewBody('Good.', 5) }, { no: 3, at: 3, trip: '', body: F.reviewBody('Fine.', 4) }, { no: 4, at: 4, trip: '', body: 'No stars here.' },
    { no: 5, at: 5, trip: 'aa', body: F.reviewBody('My own.', 1) }, { no: 6, at: 6, trip: 'zz', body: F.reviewBody(F.chapterHead(2) + 'Fake.', 2) }];
  const s = F.storyOf(op, posts);
  assert.equal(s.chapters.length, 1, 'a review with stars is never a chapter');
  assert.equal(s.reviews.length, 5);
  assert.deepEqual(s.stars, { avg: 3.7, n: 3 }, 'the writer\'s own stars do not count; (5 + 4 + 2) / 3 = 3.7');
});

test('a series: a name and a part on chapter 1, read back from the post and from the catalog excerpt, listed per writer and read in part order', () => {
  assert.deepEqual([F.cleanDetails({ series: 'Long Road' }).series, F.cleanDetails({ series: 'Long Road', part: 0 }).part, F.cleanDetails({ series: 'Long Road', part: 1000 }).part, F.cleanDetails({ part: 2 }).part], ['', 0, 0, 0], 'a series needs both a name and a part from 1 to 999');
  const d = { series: 'The Long, Long Road', part: 2, rating: 'Teen', status: 'In progress', characters: 'Ana, Bo' };
  const body = F.withSummary('About it.', 'The story.', d);
  assert.ok(body.startsWith('Series: The Long, Long Road, part 2\nStatus: In progress\n'), body);
  const back = F.readSummary(body).details; assert.equal(back.series, 'The Long, Long Road'); assert.equal(back.part, 2);
  const flat = F.topicOf({ no: 1, body: body.replace(/\s+/g, ' ').slice(0, 300), name: 'Ink', trip: 'aa', at: 5 }, { code: 'ficx', title: 'X' });
  assert.deepEqual([flat.series, flat.part, flat.status, flat.rating, flat.characters], ['The Long, Long Road', 2, 'In progress', 'Teen', ['Ana', 'Bo']], 'the one-line catalog excerpt keeps the series');
  assert.equal(F.detailsLine(back), 'Part 2 of The Long, Long Road · In progress · Rated Teen · Characters: Ana, Bo');
  // the longest details, a series too, still fit the catalog's 300 characters: the series takes its room from the character names
  const most = { series: 'S'.repeat(40), part: 999, status: 'In progress', rating: 'Mature', genres: ['Hurt/Comfort', 'Friendship', 'Adventure'], warnings: F.WARNINGS, characters: ['a', 'b', 'c', 'd', 'e'].map((x) => x.repeat(40)).join(',') };
  const lines = F.detailLines(most).trim(); assert.ok(lines.length <= 300, 'fits: ' + lines.length);
  assert.equal(F.topicOf({ no: 1, body: (lines + '\n\nSummary: s\n\nText').replace(/\s+/g, ' ').slice(0, 300), name: 'n' }, { code: 'ficx', title: 'X' }).part, 999);
  const t = (no, author, trip, series, part, at) => ({ no, author, trip, series, part, at, bumped: at, title: 'T' + no });
  const list = [t(1, 'Ink', 'aa', 'Long Road', 2, 10), t(2, 'Ink', 'aa', 'long road', 1, 20), t(3, 'Ink', 'zz', 'Long Road', 1, 30), t(4, 'Ink', 'aa', '', 0, 40)];
  const all = F.seriesOf(list);
  assert.equal(all.length, 2, 'a namesake writing a series of the same name is a series of its own');
  assert.deepEqual(all.map((x) => [x.name, x.parts, x.last]), [['Long Road', 2, 20], ['Long Road', 1, 30]]);
  assert.deepEqual(F.inPartOrder(F.filterStories(list, { series: all[0].key })).map((x) => x.no), [2, 1], 'one series, part 1 first');
  assert.equal(F.seriesKey(list[3]), '', 'a story in no series has no key');
});

test('a rec list keeps up to 25 stories once each, in the reader\'s order, and its link holds the whole list', () => {
  let r = F.recsWith({ name: 'Slow burns' }, 'ficabc', 3); r = F.recsWith(r, 'ficabc', 9); r = F.recsWith(r, 'FICABC', 3);
  assert.deepEqual(r.items.map((x) => x.s), [3, 9], 'a story already there keeps its place');
  r.items[0].note = 'The best\nslow burn';
  const back = F.readRecs('#' + F.recsHash(r));
  assert.deepEqual(back, { name: 'Slow burns', items: [{ f: 'ficabc', s: 3, note: 'The best slow burn' }, { f: 'ficabc', s: 9, note: '' }] }, 'the link reads back the same list, notes one line');
  assert.deepEqual(F.recsMoved(r, 0, 1).items.map((x) => x.s), [9, 3]); assert.deepEqual(F.recsMoved(r, 0, -1).items.map((x) => x.s), [3, 9], 'the top stays the top');
  assert.deepEqual(F.recsWith(r, 'ficabc', 3, true).items.map((x) => x.s), [9], 'taken off');
  let full = {}; for (let i = 1; i <= 30; i++) full = F.recsWith(full, 'ficx', i);
  assert.equal(full.items.length, F.RECS_LIMITS.items, 'never more than 25');
  assert.deepEqual(F.cleanRecs({ items: [{ f: 'fic x', s: 1 }, { f: 'ficx', s: 0 }, { f: 'ficx', s: 'a' }] }).items, [], 'a code or number that cannot be a story is dropped');
  for (const bad of ['', '#room=abc', '#recs=!!', '#recs=e30', '#recs=' + Buffer.from('not json').toString('base64url')]) assert.equal(F.readRecs(bad), null, bad);
});

test('a writing challenge: a prompt and a last day, read back whole or from the catalog excerpt; entries are signed by each story\'s writer, winners by the one who set it', () => {
  const body = F.challengeBody('  Write a ghost story in 500 words.\n\nNo crossovers.  ', '2026-11-30');
  assert.equal(body, 'Writing challenge\nCloses: 2026-11-30\n\nWrite a ghost story in 500 words.\n\nNo crossovers.');
  assert.deepEqual(F.readChallenge(body), { closes: '2026-11-30', prompt: 'Write a ghost story in 500 words.\n\nNo crossovers.' });
  assert.deepEqual(F.readChallenge(body.replace(/\s+/g, ' ')), { closes: '2026-11-30', prompt: 'Write a ghost story in 500 words. No crossovers.' }, 'the one-line catalog excerpt reads the same');
  assert.deepEqual(F.readChallenge(F.challengeBody('Any length', '2026-02-30')), { closes: '', prompt: 'Any length' }, 'a day that is not on the calendar is no last day');
  for (const not of ['', 'Summary: Writing challenge', 'Writing challenges are fun', 'Entry: ficx/1']) assert.equal(F.readChallenge(not), null, not);
  const at = (day) => new Date(day + 'T12:00:00').getTime();
  assert.ok(F.challengeOpen({ closes: '2026-11-30' }, at('2026-11-30')) && !F.challengeOpen({ closes: '2026-11-30' }, at('2026-12-01')) && F.challengeOpen({ closes: '' }, at('2099-01-01')));
  const row = F.challengeOf({ no: 7, sub: 'Ghosts', body: body.replace(/\s+/g, ' '), name: 'Host', trip: 'hh', replies: 3, at: 5 }, { code: 'ficx', title: 'X' });
  assert.deepEqual([row.board, row.no, row.title, row.author, row.trip, row.closes, row.replies], ['ficx', 7, 'Ghosts', 'Host', 'hh', '2026-11-30', 3]);
  assert.equal(F.challengeOf({ no: 8, body: 'Summary: a story' }, { code: 'ficx', title: 'X' }), null, 'a story is not a challenge');

  const topics = [{ board: 'ficx', no: 1, trip: 'aa', title: 'One' }, { board: 'ficx', no: 2, trip: 'bb', title: 'Two' }, { board: 'ficy', no: 3, trip: '', title: 'Unsigned' }];
  assert.equal(F.entryBody('ficx', 1), 'Entry: ficx/1'); assert.deepEqual(F.readEntry(' Entry: ficx/1 '), { board: 'ficx', no: 1 }); assert.equal(F.readEntry('Entry: ficx/1 please'), null);
  const posts = [
    { body: 'Entry: ficx/1', trip: 'aa', at: at('2026-11-10') },
    { body: 'Entry: ficx/2', trip: 'aa', at: at('2026-11-11') },    // not the writer of story 2: does not count
    { body: 'Entry: ficx/1', trip: 'aa', at: at('2026-11-12') },    // the same story twice: once
    { body: 'Entry: ficy/3', trip: '', at: at('2026-11-12') },      // a story with no mark cannot be entered
    { body: 'Entry: ficx/9', trip: 'aa', at: at('2026-11-12') },    // no such story
    { body: 'Entry: ficx/2', trip: 'bb', at: at('2026-11-30') },    // the last day counts
    { body: 'Entry: ficx/2', trip: 'bb', at: at('2026-12-01'), hidden: true },
  ];
  const entries = F.entriesOf(posts, topics, '2026-11-30');
  assert.deepEqual(entries.map((t) => [t.no, t.entered]), [[1, at('2026-11-10')], [2, at('2026-11-30')]]);
  assert.deepEqual(F.entriesOf([{ body: 'Entry: ficx/2', trip: 'bb', at: at('2026-12-01') }], topics, '2026-11-30'), [], 'an entry after the last day does not count');
  assert.deepEqual(F.entriesOf([{ body: 'Entry: ficx/2', trip: 'bb', at: at('2030-01-01') }], topics, '').map((t) => t.no), [2], 'no last day: always open');

  assert.equal(F.winnerBody('ficx', 2), 'Winner: ficx/2');
  const picks = [
    { body: 'Winner: ficx/2', trip: 'hh', at: at('2026-11-30') },   // before the challenge closed: does not count
    { body: 'Winner: ficx/2', trip: 'aa', at: at('2026-12-02') },   // not the one who set it
    { body: 'Winner: ficx/2', trip: 'hh', at: at('2026-12-02') },
    { body: 'Winner: ficx/2', trip: 'hh', at: at('2026-12-03') },   // once
    { body: 'Winner: ficy/3', trip: 'hh', at: at('2026-12-03') },   // not an entry
    { body: 'Winner: ficx/1', trip: 'hh', at: at('2026-12-03') },
  ];
  assert.deepEqual(F.winnersOf(picks, entries, 'hh', '2026-11-30').map((t) => t.no), [2, 1], 'first place first');
  assert.deepEqual(F.winnersOf(picks, entries, '', '2026-11-30'), [], 'a challenge set with no mark has no winners');
});

test('a typed fandom name: the one here already in any case, else a new code that is free; blank or codeless names open nothing', () => {
  const fic = [{ code: 'ficdune', title: 'Dune' }], taken = new Set(['ficdune', 'ficstartre']);
  assert.deepEqual(F.fandomFor('  DUNE ', fic, taken), { title: 'Dune', code: 'ficdune', existing: true });
  assert.deepEqual(F.fandomFor('Star Trek', fic, taken), { title: 'Star Trek', code: 'ficstartr2', existing: false }, 'a taken code gets a number');
  assert.deepEqual(F.fandomFor('Tom #1', fic, new Set()), { title: 'Tom 1', code: 'fictom1', existing: false }, 'one line, no #, as the post form takes names');
  assert.equal(F.fandomFor('   ', fic, taken), null);
  const app = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  assert.equal((app.match(/F\.fandomFor\(/g) || []).length, 1, 'both forms open a fandom through one helper (openFandom)');
  assert.equal((app.match(/await openFandom\(form, /g) || []).length, 2, 'Start a fandom and the post form');
});

// ---- a chapter from a file (the post form's "Open a file") ----
/** a zip of { name: text } entries, deflated, as Word writes a .docx (central directory and all), for the file tests. */
function zipOf(entries) {
  const local = [], central = []; let at = 0;
  for (const [name, text] of Object.entries(entries)) {
    const raw = Buffer.from(text), data = zlib.deflateRawSync(raw), nm = Buffer.from(name), crc = zlib.crc32(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(at, 42);
    local.push(h, nm, data); central.push(c, nm); at += 30 + nm.length + data.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(central.length / 2, 8); e.writeUInt16LE(central.length / 2, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(at, 16);
  return Buffer.concat([...local, cd, e]);
}
const DOCX_XML = '<?xml version="1.0"?><w:document xmlns:w="x"><w:body><w:p><w:r><w:t>The ship left</w:t></w:r><w:r><w:t xml:space="preserve"> the dock &amp; nobody waved.</w:t></w:r></w:p>'
  + '<w:p><w:r><w:t>Line one</w:t><w:br/><w:t>line two</w:t></w:r></w:p><w:p></w:p><w:p><w:r><w:t>The end.</w:t></w:r></w:p></w:body></w:document>';
const inflate = (b) => zlib.inflateRawSync(b);

test('a .docx opens as its text: each paragraph a paragraph, a line break a line, entities read, no markup', async () => {
  const t = await F.fileText('Shore Leave.docx', zipOf({ '[Content_Types].xml': '<Types/>', 'word/document.xml': DOCX_XML }), inflate);
  assert.equal(t, 'The ship left the dock & nobody waved.\n\nLine one\nline two\n\nThe end.');
  assert.equal(F.docxText(DOCX_XML), t);
});

test('a .txt opens as it is (line ends made plain, a byte order mark dropped); .md too', async () => {
  const enc = (s) => new TextEncoder().encode(s);
  assert.equal(await F.fileText('a.txt', enc('\ufeffOne.\r\n\r\n\r\n\r\nTwo.   \r\n')), 'One.\n\nTwo.');
  assert.equal(await F.fileText('a.md', enc('# Title\n\nText.')), '# Title\n\nText.');
});

test('an .html page opens as text: blocks are paragraphs, scripts and styles gone, entities read, nothing of the markup kept', async () => {
  const html = '<!doctype html><html><head><title>x</title><style>p{}</style></head><body><script>alert(1)</script><h1>Shore&nbsp;Leave</h1><p>It was <b>late</b>&hellip;</p><p>One<br>two &lt;3 &#8212; &#x2019;</p><!-- note --></body></html>';
  const t = await F.fileText('story.html', new TextEncoder().encode(html));
  assert.equal(t, 'Shore Leave\n\nIt was late\u2026\n\nOne\ntwo <3 \u2014 \u2019');
  assert.doesNotMatch(t, /alert|style|<b>/);
  assert.equal(F.htmlText('<p>a</p><p>b</p>'), 'a\n\nb');
});

test('a file with no text this form can read gives nothing: a binary file, a zip that is not a .docx, a broken zip, a file over the limit', async () => {
  assert.equal(await F.fileText('old.doc', new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 1])), '');
  assert.equal(await F.fileText('a.zip', zipOf({ 'readme.txt': 'hello' }), inflate), '');
  assert.equal(await F.fileText('a.docx', new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3]), inflate), '');
  assert.equal(await F.fileText('big.txt', new Uint8Array(F.FILE_MAX + 1).fill(65)), '');
  assert.equal(await F.zipEntry(zipOf({ 'word/document.xml': 'x' }), 'word/other.xml', inflate), null);
});

test('a title from a file name: its words, the type and the dashes gone', () => {
  assert.equal(F.titleOfFile('shore_leave-draft.docx'), 'shore leave draft');
  assert.equal(F.titleOfFile('Chapter One.txt'), 'Chapter One');
  assert.equal(F.titleOfFile(''), '');
});

test('the post form opens a file and shows a preview, both on this device: the file input takes the types fileText reads, Preview draws with the story page\'s own paras()', () => {
  const html = fs.readFileSync(path.join(root, 'fanfic', 'index.html'), 'utf8'), app = fs.readFileSync(path.join(root, 'fanfic', 'app.js'), 'utf8');
  for (const id of ['stOpen', 'stFile', 'stUndo', 'stPrev', 'stPreview']) assert.match(html, new RegExp('id="' + id + '"'), id);
  assert.match(app, /file\.accept = F\.FILE_TYPES/);
  assert.match(app, /paras\(box\.value, prose\)/, 'the preview is drawn as a story page draws a chapter');
  assert.match(app, /new DecompressionStream\('deflate-raw'\)/);
  assert.doesNotMatch(app.slice(app.indexOf('function fileAndPreview'), app.indexOf('async function viewPost')), /fetch\(|api\(/, 'opening a file sends nothing');
});
