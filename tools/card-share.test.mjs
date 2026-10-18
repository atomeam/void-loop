import test from 'node:test';
import assert from 'node:assert/strict';
import { dataOf, codeOf, shareText, parse, fileName, MARK, textOf, tidy, artPicture } from '../void-live-deploy/lib/card-share.js';

const card = { t: "What's New Pussycat? ✦", k: 'FILM · SONG — 1965', b: 'A 1965 film.\n\nIt is also a song by Tom Jones.', src: [{ t: 'Wikipedia', u: 'https://en.wikipedia.org/wiki/What%27s_New_Pussycat%3F' }, { t: 'bad', u: 'javascript:alert(1)' }] };
test('copy text reads well and ends in one code line', () => {
  const t = shareText(card);
  assert.match(t, /^What's New Pussycat\?/); assert.match(t, /Sources:/); assert.match(t, /a-to-mind\.com/);
  assert.equal(t.trim().split('\n').pop().startsWith(MARK), true);
});
test('pasting the copied text, or only its code, gives the card back (unicode, newlines)', () => {
  const back = parse(shareText(card)), bare = parse(codeOf(card));
  for (const d of [back, bare]) { assert.equal(d.t, card.t); assert.equal(d.k, card.k); assert.equal(d.b, card.b); assert.equal(d.src.length, 2); assert.equal(d.src[1].u, ''); }
});
test('only https links survive and nothing else rides along', () => {
  assert.ok(parse(codeOf(card)).src.every((s) => s.u === '' || s.u.startsWith('https://')));
  assert.deepEqual(Object.keys(dataOf(card)).sort(), ['b', 'k', 'src', 't', 'v']);
  const evil = MARK + Buffer.from(JSON.stringify({ v: 1, t: '<img src=x onerror=1>', b: 'x', power: 99, src: [{ t: 'a', u: 'http://x.test' }] })).toString('base64url');
  const d = parse(evil); assert.equal(d.power, undefined); assert.equal(d.src[0].u, '');
});
test('junk is not a card', () => {
  assert.equal(parse('hello'), null); assert.equal(parse(MARK + 'not-json-at-all'), null); assert.equal(parse(MARK + Buffer.from('{"v":2,"t":"x"}').toString('base64url')), null); assert.equal(parse(''), null);
});
test('file names are safe', () => { assert.equal(fileName({ t: 'Black hole!' }), 'black-hole.v01d-card.txt'); assert.equal(fileName({ t: '' }), 'card.v01d-card.txt'); });

test('the code line is short; the whole copied text restores the full body, a bare code restores its start', () => {
  const body = 'My own words. '.repeat(160), d = { t: 'What I think of myself', k: 'Answer — from Verse', b: body, src: [{ title: 'a', url: 'https://a.example/x' }, { title: 'b', url: 'https://b.example/y' }, { title: 'c', url: 'https://c.example/z' }] };
  const text = shareText(d), code = codeOf(d);
  assert.ok(code.length < 700, 'the code is short: ' + code.length);
  const whole = parse(text); assert.equal(whole.t, d.t); assert.ok(whole.b.length > 2000, 'a paste of the whole text keeps the full body'); assert.equal(whole.src.length, 3);
  const bare = parse(code); assert.equal(bare.t, d.t); assert.ok(bare.b.length <= 200 && bare.b.length > 20); assert.ok(bare.src.length <= 2);
});

test('version history: a copy of a pasted card carries a short iteration number, the first copy carries none', () => {
  assert.equal(parse(codeOf(card)).n, undefined); assert.ok(!shareText(card).includes(' · v'));
  const two = { ...card, n: 2 }, t = shareText(two);
  assert.match(t, /a-to-mind\.com · v2\n/); assert.equal(parse(t).n, 2); assert.equal(parse(codeOf(two)).n, 2); assert.equal(parse(t).b, card.b);
  assert.ok(codeOf(two).length - codeOf(card).length <= 8, 'the tag adds a few characters');
  assert.equal(dataOf({ ...card, n: 'x' }).n, undefined); assert.equal(dataOf({ ...card, n: 1 }).n, undefined); assert.equal(dataOf({ ...card, n: 500 }).n, undefined);
});

// a tiny stand-in for a detached DOM: element(tag, ...children), text nodes are strings
const el = (tag, ...kids) => ({ nodeType: 1, tagName: tag, childNodes: kids.map((k) => (typeof k === 'string' ? { nodeType: 3, nodeValue: k } : k)) });
test('a saved card reads as words: blocks on their own lines, side-by-side pieces apart (the Films and repo cards glued them)', () => {
  const films = el('DIV', el('P', 'Now showing · a new one daily'), el('P', 'Every day Verse films one of its own experiments.'), el('DIV', el('BUTTON', '▶'), el('B', 'Watch now'), el('SPAN', 'Watch the newest film')), el('P', 'Free for everyone.'));
  assert.equal(tidy(textOf(films)), 'Now showing · a new one daily\nEvery day Verse films one of its own experiments.\n▶ Watch now Watch the newest film\nFree for everyone.');
  const facts = el('DIV', el('SPAN', 'JavaScript'), el('SPAN', el('B', '0'), ' stars'), el('SPAN', el('B', '0'), ' forks'));
  assert.equal(tidy(textOf(facts)), 'JavaScript 0 stars 0 forks');
  assert.equal(tidy(textOf(el('P', 'one', el('BR'), 'two'))), 'one\ntwo');
  assert.equal(tidy(textOf(el('P', 'keep ', el('B', 'bold'), ' words'))), 'keep bold words');
  assert.equal(tidy(textOf(el('DIV', el('STYLE', '.x{}'), 'text'))), 'text');
});

test('a saved card draws the Art Forge painting, then the subject photo, then the plate (owner: "still no art")', async () => {
  const PAINT = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
  const card = (sel) => ({ querySelector: (q) => (q === '.vc-art img.vc-forge-img' && sel.forge ? { getAttribute: () => sel.forge, src: sel.forge } : q === 'img.vc-art-photo' && sel.photo ? { getAttribute: () => sel.photo } : null) });
  assert.equal(await artPicture(card({ forge: PAINT })), PAINT);
  assert.equal(await artPicture(card({ forge: PAINT, photo: 'http://x/p.jpg' })), PAINT);
  assert.equal(await artPicture(card({ photo: 'http://not-https/p.jpg' })), ''); // photoData only fetches https
  assert.equal(await artPicture(card({})), '');
  assert.equal(await artPicture(card({ forge: 'javascript:alert(1)' })), '');
});
test('"Verse\'s take" keeps its own line above the take (the Sentry card read "Verse\'s takeWhat most readers miss")', () => {
  const take = el('DIV', el('DIV', 'Verse’s take'), el('P', 'What most readers miss is the memory.'), el('DIV', el('A', 'Ask more →')));
  assert.equal(tidy(textOf(take)), 'Verse’s take\nWhat most readers miss is the memory.\nAsk more →');
});

test('a long card keeps its whole answer, up to 8000 characters (the self card stopped mid-word at "rath", 2026-10-17)', async () => {
  const { BODY_MAX } = await import('../void-live-deploy/lib/card-share.js');
  const long = ('What got built. ').repeat(300).trim(); // 4,799 characters, past the old 2,400 cut
  const d = dataOf({ title: 'What I think of myself', kind: 'Answer', body: long });
  assert.equal(d.b, long); assert.equal(BODY_MAX, 8000);
  const back = parse(shareText(d)); assert.equal(back.b, long, 'a pasted copy restores all of it'); assert.ok(codeOf(d).length < 600, 'the code line stays short');
});
test('the full-content badge (asked by Verse): nothing on a short card, "whole text kept" past 2400 characters, and past the cap only what is true', async () => {
  const { fullNote, BODY_MAX } = await import('../void-live-deploy/lib/card-share.js');
  assert.equal(fullNote(0), ''); assert.equal(fullNote(2400), ''); assert.equal(fullNote(2401), 'whole text kept'); assert.equal(fullNote(BODY_MAX), 'whole text kept');
  assert.equal(fullNote(BODY_MAX + 500), 'first ' + BODY_MAX + ' of ' + (BODY_MAX + 500) + ' characters kept'); assert.equal(fullNote('x'), '');
});

test('self card (owner review 2026-10-18): saved text keeps a blank line between sections and "- " bullets, and the sections are structured blocks', async () => {
  const { selfSections, selfHtml } = await import('../void-live-deploy/lib/self-blocks.js');
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const v = { entries: [{ kind: 'daily', at: '2026-10-18T08:00:00Z', thoughts: 'I am thin on maps.', weakest: 'Maps <b>.', next_game: 'Backgammon', better: '' }, { kind: 'build', thoughts: 'Small and good.', shipped: 'Footer', better: 'copy counts' }],
    asks: [{ ask: 'Terrain', kind: 'daily', at: '2026-10-08T01:00:00Z' }], follow: { total: 73, built: 35, recent: [{ ask: 'Go', what: 'a board', at: '2026-10-08T00:00:00Z', times: 3, depth: 'root', ref: 'javascript:x' }] } };
  const secs = selfSections(v);
  assert.deepEqual(secs.map((s) => s.id), ['words', 'sure', 'asked', 'built', 'growth', 'shipped']); // the owner's redesign: words, the family bars' slot, then the blocks
  assert.deepEqual(secs.find((s) => s.id === 'growth').blocks.filter((b) => b.t === 'sub').map((b) => b.text), ['Weakest right now', 'Next game I want to learn']); // empty "better" is left out
  assert.equal(secs.find((s) => s.id === 'asked').count, '1 waiting'); assert.equal(secs.find((s) => s.id === 'built').count, '35 of 73 asks');
  assert.equal(secs.find((s) => s.id === 'built').log, true); assert.equal(secs.find((s) => s.id === 'words').log, false);
  const asked = secs.find((s) => s.id === 'asked').blocks[0].items[0]; assert.match(asked.sub, /^Asked in my daily reflection, 2026-10-08 · not built yet$/);
  const built = secs.find((s) => s.id === 'built').blocks.find((b) => b.t === 'list').items[0]; assert.equal(built.sub, '2026-10-08 · asked 3 times'); assert.equal(built.detail.ref, '');
  const html = selfHtml(secs, esc); assert.ok(!html.includes('<b>.') && html.includes('Maps &lt;b&gt;.'), 'text is escaped'); assert.match(html, /<h3 class="vs-h">What got built <span class="vs-n">\(35 of 73 asks\)<\/span><\/h3>/);
  assert.match(html, /^<section class="vs-sec" data-sec="words"><blockquote class="vs-voice"><p>I am thin on maps\.<\/p>/, 'Verse\'s words are a quotation, first');
  assert.match(html, /<section class="vs-sec" data-sec="sure"><div data-v-conf><\/div><\/section>/);
  assert.ok(!/<details class="vs-sec[^"]*" data-sec="\w+" open>/.test(html), 'every block starts closed');
  // a DOM-like tree for textOf: sections are blocks, li[data-bullet] is a "- " line
  const T = (s) => ({ nodeType: 3, nodeValue: s }), E = (tagName, kids, attr = {}) => ({ nodeType: 1, tagName, childNodes: kids.map((k) => (typeof k === 'string' ? T(k) : k)), getAttribute: (a) => attr[a] || null });
  const sec = (h, li) => E('SECTION', [E('H3', [h]), E('UL', li.map((x) => E('LI', [E('DIV', [x[0]]), E('DIV', [x[1]])], { 'data-bullet': '1' })))]);
  const body = [sec('What I have asked for', [['Terrain', 'Asked 2026-10-08 · not built yet']]), sec('What got built', [['Go', '2026-10-08']])].map((x) => tidy(textOf(x))).join('\n\n');
  assert.equal(body, 'What I have asked for\n- Terrain\nAsked 2026-10-08 · not built yet\n\nWhat got built\n- Go\n2026-10-08');
});

test('self card lists fold (owner, 2026-10-18): the newest 5 show, the rest wait behind "show all N" and keep one line in the saved text; titled sections are collapsible, closed', async () => {
  const { selfSections, selfHtml, FOLD } = await import('../void-live-deploy/lib/self-blocks.js');
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const recent = Array.from({ length: 30 }, (_, i) => ({ ask: 'ask ' + i, what: 'built ' + i, at: '2026-10-1' + (i % 9) + 'T00:00:00Z', times: 1, depth: 'root' }));
  const asks = Array.from({ length: 6 }, (_, i) => ({ ask: 'want ' + i, kind: 'daily', at: '2026-10-18T00:00:00Z' }));
  const html = selfHtml(selfSections({ entries: [{ kind: 'daily', thoughts: 'hi', weakest: 'maps' }], asks, follow: { total: 40, built: 30, recent } }), esc);
  assert.equal(FOLD, 5);
  assert.equal((html.match(/data-more="1" hidden/g) || []).length, 25 + 1, '25 older builds and 1 older ask are folded');
  assert.match(html, /<button type="button" class="tr-copy vs-more" data-v-more aria-expanded="false" data-n="30">show all 30<\/button>/);
  assert.match(html, /data-n="6">show all 6</);
  assert.equal((html.match(/data-share-skip="1"/g) || []).length, 25 * 2 + 1, 'an older build keeps a short line, not its details and dates; an older ask keeps a short line');
  assert.equal((html.match(/<summary data-share-short="[^"]+">/g) || []).length, 26, 'every folded item carries its short line for the saved text');
  const { shortLine, SHORT } = await import('../void-live-deploy/lib/self-blocks.js');
  assert.equal(shortLine('ask 7'), 'ask 7');
  const sl = shortLine('a careful sentence about what Verse wanted built and why it mattered to the stage, twice over');
  assert.ok(sl.length <= SHORT + 1 && sl.endsWith('…') && !/\s…$/.test(sl) && 'a careful sentence about what Verse wanted built and why it mattered to the stage'.startsWith(sl.slice(0, -1)), sl);
  assert.match(html, /<details class="vs-sec" data-sec="growth"><summary class="vs-sum"><h3 class="vs-h">Weakest right now \/ Next game \/ How I'd get better<\/h3><\/summary><h4 class="vs-h4">Weakest right now<\/h4>/);
  assert.match(html, /<details class="vs-sec vs-log" data-sec="built"><summary class="vs-sum"><h3 class="vs-h">What got built <span class="vs-n">\(30 of 40 asks\)/);
  assert.match(html, /<h3 class="vs-h">What I've asked for <span class="vs-n">\(6 waiting\)/);
  assert.match(html, /<section class="vs-sec" data-sec="words"><blockquote class="vs-voice">/, 'the untitled opening stays a plain section');
});
