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
  for (const d of [back, bare]) { assert.equal(d.t, card.t); assert.equal(d.k, card.k); assert.equal(d.b, card.b); assert.equal(d.src.length, 1, 'the source with no link is dropped'); assert.match(d.src[0].u, /^https:/); }
});
test('only https links survive and nothing else rides along', () => {
  assert.ok(parse(codeOf(card)).src.every((s) => s.u === '' || s.u.startsWith('https://')));
  assert.deepEqual(Object.keys(dataOf(card)).sort(), ['b', 'k', 'src', 't', 'v']);
  const evil = MARK + Buffer.from(JSON.stringify({ v: 1, t: '<img src=x onerror=1>', b: 'x', power: 99, src: [{ t: 'a', u: 'http://x.test' }] })).toString('base64url');
  const d = parse(evil); assert.equal(d.power, undefined); assert.deepEqual(d.src, [], 'an http link is not a source');
});
test('junk is not a card', () => {
  assert.equal(parse('hello'), null); assert.equal(parse(MARK + 'not-json-at-all'), null); assert.equal(parse(MARK + Buffer.from('{"v":2,"t":"x"}').toString('base64url')), null); assert.equal(parse(''), null);
});
test('file names are safe', () => { assert.equal(fileName({ t: 'Black hole!' }), 'black-hole.verse-card.txt'); assert.equal(fileName({ t: '' }), 'card.verse-card.txt'); });

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
  assert.equal(d.b, long); assert.ok(BODY_MAX >= 1e6);
  const back = parse(shareText(d)); assert.equal(back.b, long, 'a pasted copy restores all of it'); assert.ok(codeOf(d).length < 600, 'the code line stays short');
});
test('the full-content badge (asked by Verse): nothing on a short card, "whole text kept" past 2400 characters, and past the cap only what is true', async () => {
  const { fullNote, BODY_MAX } = await import('../void-live-deploy/lib/card-share.js');
  assert.equal(fullNote(0), ''); assert.equal(fullNote(2400), ''); assert.equal(fullNote(2401), 'whole text kept'); assert.equal(fullNote(BODY_MAX), 'whole text kept');
  assert.equal(fullNote(724820), 'whole text kept'); assert.ok(BODY_MAX >= 724820, 'no cut-off'); assert.equal(fullNote('x'), '');
});

test('self card (owner review 2026-10-18): saved text keeps a blank line between sections and "- " bullets, and the sections are structured blocks', async () => {
  const { selfSections, selfHtml } = await import('../void-live-deploy/lib/self-blocks.js');
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const v = { entries: [{ kind: 'daily', at: '2026-10-18T08:00:00Z', thoughts: 'I am thin on maps.', weakest: 'Maps <b>.', next_game: 'Backgammon', better: '' }, { kind: 'build', thoughts: 'Small and good.', shipped: 'Footer', better: 'copy counts' }],
    asks: [{ ask: 'Terrain', kind: 'daily', at: '2026-10-08T01:00:00Z' }], follow: { total: 73, built: 35, recent: [{ ask: 'Go', what: 'a board', at: '2026-10-08T00:00:00Z', times: 3, depth: 'root', ref: 'javascript:x' }] } };
  const secs = selfSections(v);
  assert.deepEqual(secs.map((s) => s.id), ['words', 'sure', 'asked', 'built', 'growth', 'shipped']); // the owner's redesign: words, the family bars' slot, then the blocks
  assert.deepEqual(secs.find((s) => s.id === 'growth').blocks.filter((b) => b.t === 'sub').map((b) => b.text), ['Weakest operational area', 'Next targeted capability']); // empty "better" is left out
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
  assert.equal((html.match(/data-share-short/g) || []).length, 0, 'a folded item saves its whole line, never a cut one (owner, 2026-10-22: no cut-off anywhere)');
  const { shortLine, SHORT } = await import('../void-live-deploy/lib/self-blocks.js');
  assert.equal(shortLine('ask 7'), 'ask 7');
  const sl = shortLine('a careful sentence about what Verse wanted built and why it mattered to the stage, twice over');
  assert.ok(sl.length <= SHORT + 1 && sl.endsWith('…') && !/\s…$/.test(sl) && 'a careful sentence about what Verse wanted built and why it mattered to the stage'.startsWith(sl.slice(0, -1)), sl);
  assert.match(html, /<details class="vs-sec" data-sec="growth"><summary class="vs-sum"><h3 class="vs-h">Weakest operational area \/ Next capability \/ What should change<\/h3><\/summary><h4 class="vs-h4">Weakest operational area<\/h4>/);
  assert.match(html, /<details class="vs-sec vs-log" data-sec="built"><summary class="vs-sum"><h3 class="vs-h">What got built <span class="vs-n">\(30 of 40 asks\)/);
  assert.match(html, /<h3 class="vs-h">What I've asked for <span class="vs-n">\(6 waiting\)/);
  assert.match(html, /<section class="vs-sec" data-sec="words"><blockquote class="vs-voice">/, 'the untitled opening stays a plain section');
});

test('a card shared before the rename (V01D-CARD:) still pastes, and new copies carry VERSE-CARD:', () => {
  const d = { t: 'Old card', k: 'answer', b: 'kept from before 2026-10-18', src: [], n: '' };
  const code = codeOf(d);
  assert.equal(code.startsWith('VERSE-CARD:'), true);
  const old = code.replace(/^VERSE-CARD:/, 'V01D-CARD:');
  assert.equal(parse(old)?.t, 'Old card');
  assert.equal(parse(code)?.t, 'Old card');
});

test('a share link reopens the card it was made from, and nothing else', async () => {
  const { linkOf, fromHash } = await import('../void-live-deploy/lib/card-share.js');
  const url = linkOf(card); assert.match(url, /^https:\/\/a-to-mind\.com\/#vc=[A-Za-z0-9_-]+$/);
  assert.equal(fromHash(new URL(url).hash)?.t, card.t);
  assert.equal(fromHash('#other=1'), null); assert.equal(fromHash('#vc=!!'), null);
});

test('self card picture: every line wrapped whole (no ellipsis), long family labels wrap, fact tags stripped, "and N more" is a sentence (2026-10-22)', async () => {
  const { selfLayout } = await import('../void-live-deploy/lib/card-image.js');
  const { readableVoice } = await import('../void-live-deploy/lib/card-share.js');
  assert.equal(readableVoice('Verse has 306 skills [S1, S3, S4]. It moves to gemma [What I said about myself most recently]. Growth [S2].'), 'Verse has 306 skills. It moves to gemma. Growth.');
  const long = 'Migrate answer generation from gpt-oss-120b to gemma to maintain the 10k neurons/day free limit, a long sentence that must wrap instead of being cut short';
  const items = Array.from({ length: 911 }, (_, i) => 'ledger line ' + i + ' ' + long);
  const out = selfLayout({ voice: long + ' ' + long, bars: [{ name: 'Words and the world and everything else', share: 0.5, label: '2 of 4 proven' }], sections: [{ title: "What's built and improved, skill by skill", lines: items }] });
  const txt = out.els.filter((e) => e.k === 'text').map((e) => e.text);
  assert.ok(!txt.some((t) => /\u2026|\.\.\./.test(t)), 'no ellipsis in the picture');
  assert.ok(txt.join(' ').includes('must wrap instead of being cut short'));
  assert.ok(txt.some((t) => /^And 908 more, every one of them in the saved text\.$/.test(t)));
  assert.ok(txt.join(' ').includes('everything else'));
});

test('self card copy text (2026-10-22): no empty "- " bullets, a deep folded item whole, no "characters kept" cap', async () => {
  const { selfSections, selfHtml } = await import('../void-live-deploy/lib/self-blocks.js');
  const { textOf, tidy } = await import('../void-live-deploy/lib/card-share.js');
  const { parseHTML } = await import('linkedom').catch(() => ({}));
  const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const deep = 'the deepest folded build, a long sentence that must be copied whole and never be cut short with an ellipsis at all';
  const recent = Array.from({ length: 400 }, (_, i) => ({ ask: 'ask ' + i, what: i === 399 ? deep : 'built ' + i, at: '2026-10-1' + (i % 9) + 'T00:00:00Z', times: 1, depth: 'root' }));
  const html = selfHtml(selfSections({ entries: [{ kind: 'daily', thoughts: 'hi', weakest: 'maps' }], asks: [], follow: { total: 400, built: 400, recent } }), esc);
  assert.ok(!/data-share-short/.test(html));
  if (!parseHTML) return; // the DOM half runs where linkedom is installed; the browser check (tools/site-test) covers the page
  const { document } = parseHTML('<div>' + html + '</div>');
  const t = tidy(textOf(document.querySelector('div')));
  assert.equal((t.match(/^- *$/gm) || []).length, 0); assert.ok(!/characters kept/.test(t));
});
test('the screen-reader line reads the card\'s own words, not its frame (2026-10-30: it read "Answer from Verse … copy card save card share")', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../void.html', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('function srAnnounce(el)'), src.indexOf('function showPage(build)'));
  assert.match(fn, /import\('\/lib\/card-share\.js'\)\.catch\(\(\) => null\)\.then\(\(sh\) => \{ if \(vpageEl !== el\) return;/, 'it waits for the module and still checks the card is the one on show');
  assert.match(fn, /sh\.readCard\(el\)/, 'the text comes from readCard, which leaves out the type line, the badges, the buttons and the reply box');
  assert.doesNotMatch(fn, /t = \(el\.innerText/, 'the whole card, frame and all, is no longer the first choice');

  // a card with no heading still gets a name (the translation card is drawn without an h2): its first line of text
  assert.match(fn, /const name = h \? h\.textContent\.trim\(\) : \(d && d\.b \? d\.b\.split\('\\n'\)\[0\]/, 'a card with no heading is named by its first line');
  assert.match(fn, /if \(name\) el\.setAttribute\('aria-label', name\)/);
});
