// the self card's counts are true and its text is clean (owner's self card, 2026-11-06: "-3 asks built", "Nothing of mine was built since"
// beside five builds this week, one ask listed three times, "[S1]" in the text, a raw comma dump, unchecked routes listed as built,
// and every "N more" counting the rows it hides). One test for each.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../void-live-deploy/functions/api/reflect.js';
import { sinceSection, selfSections, foldAsks, foldBuilt, shippedLine, joinNames } from '../void-live-deploy/lib/self-blocks.js';
import { dupAsk, sameOrDup, stripCites, uncite, askIds } from '../void-live-deploy/lib/ask-same.js';
import { untag, parseVoice, builtAsks } from '../void-live-deploy/lib/voice.js';
import { asksOf } from './asks-link.mjs';
import { changedLine, cardModel, cardHtml } from '../void-live-deploy/skills/wants.js';

const envOf = (entries, ledger, asks) => ({ DB: { prepare: () => ({ bind: () => ({ first: async () => JSON.stringify(entries) }) }) },
  ASSETS: { fetch: async (r) => new Response(JSON.stringify(new URL(r.url).pathname === '/void.growth.json' ? ledger : asks)) } });
const reflect = async (env) => (await (await onRequestGet({ request: new Request('http://x/api/reflect'), env })).json());
const esc = (x) => String(x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

test('1. an ask built by its id stays built when its reflection leaves the 60-entry window (the cause of "-3 asks built")', async () => {
  const ask = 'Make the images exam pass by answering each image ask with a real picture';
  const totals = { asked: 10, built: 7, through: '2026-11-05T08:00:00Z', open: [
    { ask, at: '2026-11-04T20:17:00Z', kind: 'build', times: 1, ids: ['ask-20261104-2017-1'] },
    { ask: 'Give the timer skill a lap button and a split list', at: '2026-11-04T20:17:00Z', kind: 'build', times: 1, ids: ['ask-20261104-2017-2'] },
    { ask: 'Absorb the podcast directory into the podcasts skill', at: '2026-11-03T10:00:00Z', kind: 'daily', times: 2 } ] };
  const ledger = [{ at: '2026-11-05T09:00:00Z', kind: 'fix', what: 'the images exam passes: each image ask gets a real picture', asked: 'ask-20261104-2017-1' }];
  const inWindow = [{ at: '2026-11-04T20:17:00Z', kind: 'build', thoughts: 'x', asks: [{ ask }, { ask: 'Give the timer skill a lap button and a split list' }] }];
  const later = [{ at: '2026-11-06T09:00:00Z', kind: 'daily', thoughts: 'y', asks: [] }];
  const a = await reflect(envOf(inWindow, ledger, { links: [], totals }));
  const b = await reflect(envOf(later, ledger, { links: [], totals }));
  assert.equal(a.follow.built, 8); assert.equal(b.follow.built, 8, 'the built count does not fall when the window moves');
  assert.equal(a.follow.open, 2); assert.equal(b.follow.open, 2);
  assert.ok(!b.asks.some((x) => x.ask === ask), 'the built ask is not waiting again');
});

test('1. "Since you last looked" never shows a fall in asks built; it shows the asks built after the last look', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const v = { entries: [], follow: { built: 243, total: 262, recent: [{ ask: 'Add a page for onlineconverter.com to LANE_PAGES in lib/tower.js', what: 'a page for onlineconverter.com', at: '2026-11-06T10:00:00Z' }],
    asked: [{ ask: 'Add a page for onlineconverter.com to LANE_PAGES in lib/tower.js', at: '2026-11-06T10:00:00Z', times: 1 }] } };
  const s = sinceSection(v, { at: '2026-11-06T09:00:00Z', built: 246, total: 262 }, now);
  assert.ok(!/-\d+ asks? built/.test(s.blocks[0].text), s.blocks[0].text);
  assert.match(s.blocks[0].text, /^\+1 asks built,/, 'the counter keeps its name, as +1 skills does (the browser check "self card never repeats" reads it)');
  const none = sinceSection({ ...v, follow: { ...v.follow, recent: [], asked: [] } }, { at: '2026-11-06T09:00:00Z', built: 246, total: 262 }, now);
  assert.match(none.blocks[0].text, /^No new counts/);
});

test('2. "nothing built since" names the newest build, so it agrees with the built list beside it', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const recent = [1, 2, 3, 4, 5].map((i) => ({ ask: 'Build skill number ' + i + ' for the week list', what: 'built ' + i, at: '2026-11-0' + i + 'T10:00:00Z' })).reverse();
  const v = { entries: [], follow: { built: 250, total: 260, recent, asked: recent } };
  const s = sinceSection(v, { at: '2026-11-06T11:00:00Z', built: 250, total: 260 }, now);
  const note = s.blocks.find((b) => b.t === 'note').text;
  assert.ok(!/Nothing of mine was built/.test(note));
  assert.match(note, /^No ask of mine was built since you looked\. The newest build is from 2026-11-05: Build skill number 5 for the week list\./);
});

test('3. one ask said in other words is one row: the images exam three ways, one target twice, numbers changed', () => {
  const imgs = ['Fix the images exam failures by improving visual processing and image generation skills. [S1]', 'Fix the images exam to handle drawing commands, image URL rendering, and picture generation.', 'Fix the images exam to handle drawing, displaying specific URLs, and generating pictures.'];
  assert.ok(dupAsk(imgs[1], imgs[2])); assert.ok(sameOrDup(imgs[0], imgs[1]));
  assert.ok(dupAsk('Add a page for onlineconverter.com to LANE_PAGES in lib/tower.js', 'Add a page for onlineconverter.com to LANE_PAGES in lib/tower.js.'));
  assert.ok(dupAsk('Provide a list of the 17 checked and 6 tested skills that can be promoted to proven status', 'Provide a list of the 16 checked and 5 tested skills that can be promoted to proven status'));
  assert.ok(!dupAsk('Add a page for onlineconverter.com to LANE_PAGES', 'Add a page for ndscalc.com to LANE_PAGES'), 'two sites are two asks');
  assert.ok(!dupAsk('ask 1', 'ask 2'));
  const rows = foldAsks(imgs.map((ask, i) => ({ ask, at: '2026-11-0' + (i + 3) + 'T10:00:00Z', times: 1 })));
  assert.equal(rows.length, 1); assert.equal(rows[0].times, 3); assert.ok(!/\[S1\]/.test(rows[0].ask));
  const built = foldBuilt([{ ask: imgs[1], what: 'a', at: '2026-11-05T10:00:00Z' }, { ask: imgs[2], what: 'b', at: '2026-11-04T10:00:00Z' }]);
  assert.equal(built.length, 1);
  // the card's "N waiting" counts merged asks once
  const v = { entries: [], asks: imgs.map((ask) => ({ ask, at: '2026-11-04T10:00:00Z', kind: 'build' })).concat([{ ask: 'Give the timer skill a lap button', at: '2026-11-04T10:00:00Z', kind: 'build' }]),
    follow: { built: 1, total: 5, open: 4, recent: [], asked: [] } };
  const sec = selfSections(v, Date.parse('2026-11-06T12:00:00Z')).find((x) => x.id === 'asked');
  const list = sec.blocks.find((b) => b.t === 'list');
  assert.equal(list.items.length, 2);
  assert.equal(sec.count, '2 waiting');
});

test('3. numbered asks stay apart on the card: "number 3" and "number 4" are two asks, a changed count is still one (browser check "void asks batch 4")', () => {
  const long = (i) => 'built ask number ' + i + ': ' + 'a careful sentence about what Verse wanted built and why it mattered to the stage. '.repeat(2);
  assert.equal(askIds(long(3)), '3'); assert.equal(askIds('Fix issue #12 on the stage'), '12'); assert.equal(askIds('ask 7: give the map terrain'), '7');
  assert.equal(askIds('Provide a list of the 17 checked and 6 tested skills'), '', 'a count is not which one');
  const built = foldBuilt(Array.from({ length: 30 }, (_, i) => ({ ask: long(i), what: 'w', at: '2026-10-18T00:00:00Z', times: 1 })));
  assert.equal(built.length, 30, 'thirty numbered builds are thirty rows');
  assert.equal(foldAsks([{ ask: long(1) }, { ask: long(2) }]).length, 2);
  assert.equal(foldBuilt([{ ask: 'Provide a list of the 17 checked and 6 tested skills that can be promoted to proven status', what: 'a', at: '2026-11-05T10:00:00Z' },
    { ask: 'Provide a list of the 16 checked and 5 tested skills that can be promoted to proven status', what: 'b', at: '2026-11-04T10:00:00Z' }]).length, 1, 'only the counts changed: one ask');
  assert.equal(foldBuilt([{ ask: long(4), what: 'a', at: '2026-11-05T10:00:00Z' }, { ask: long(4) + ' [S1]', what: 'b', at: '2026-11-04T10:00:00Z' }]).length, 1, 'the same numbered ask twice: one row');
});

test('3. asks merge where they are written: within one reply, and in the voice log\'s ids', () => {
  const v = parseVoice('{"thoughts":"x","asks":[{"ask":"Fix the images exam to handle drawing commands, image URL rendering, and picture generation."},{"ask":"Fix the images exam to handle drawing, displaying specific URLs, and generating pictures."},{"ask":"Give the timer skill a lap button"}]}');
  assert.equal(v.asks.length, 2);
  const md = '### 2026-11-04 20:17 UTC\n\nAsks: "Make the images exam pass" "Give the timer skill a lap button"\n';
  const a = asksOf(md);
  assert.deepEqual(a.map((x) => x.ids), [['ask-20261104-2017-1'], ['ask-20261104-2017-2']]);
  // one ask built by two ledger lines is one built row, the newest, with both times counted
  const ledger = [{ at: '2026-11-05T10:00:00Z', kind: 'build', what: 'onlineconverter.com has its page', asked: 'Add a page for onlineconverter.com to LANE_PAGES in lib/tower.js' },
    { at: '2026-11-06T10:00:00Z', kind: 'build', what: 'onlineconverter.com page checked live', asked: 'Add a page for onlineconverter.com to LANE_PAGES in lib/tower.js.' }];
  const b = builtAsks({ built: [] }, ledger, []);
  assert.equal(b.length, 1); assert.equal(b[0].at, '2026-11-06T10:00:00Z'); assert.equal(b[0].times, 2);
});

test('4. no source tag reaches the text: [my will], [S1], [S2, S4], [What I am being built, S2]; real brackets stay', () => {
  for (const t of ['Build the lap button [my will]', 'Build the lap button [S1]', 'Build the lap button [S2, S4]', 'Build the lap button [What I am being built, S2]'])
    assert.equal(uncite(t), 'Build the lap button');
  assert.equal(untag('Keep [brackets] that are not tags [S3].'), 'Keep [brackets] that are not tags.');
  assert.equal(stripCites('I grew [S1] today [my will].'), 'I grew today.');
});

test('5. the Tower gate line reads as a sentence, not a comma dump', () => {
  assert.equal(shippedLine('Tower gate: emoji combos: emojigraph.org,emoji combos,sudowrite,squibler,inkfluence,novelcrafter,prizes measured against their live sites'),
    'Tower gate: emojigraph.org (emoji combos), sudowrite, squibler, inkfluence, novelcrafter and prizes measured against their live sites.');
  assert.equal(shippedLine('Tower gate: prizes,sports: onefootball.com,sports: flashscore.com measured against their live sites'),
    'Tower gate: prizes, onefootball.com (sports) and flashscore.com (sports) measured against their live sites.');
  assert.equal(shippedLine('Tower gate: prizes measured against their live sites'), 'Tower gate: prizes measured against its live site.');
  assert.equal(joinNames(['a', 'b']), 'a and b');
  assert.ok(!/,\S/.test(shippedLine('Tower gate: ndscalc,emojigraph.org,timer measured against their live sites')));
});

test('7. every "N more" equals the rows it hides', () => {
  const now = Date.parse('2026-11-06T12:00:00Z');
  const topics = ['chess clocks', 'tide tables', 'moon phases', 'sourdough timing', 'bike gearing', 'paint mixing', 'roman numerals', 'knot tying', 'star charts', 'tax brackets', 'bird calls'];
  const recent = Array.from({ length: 11 }, (_, i) => ({ ask: 'Teach Verse ' + topics[i], what: 'built ' + i, at: new Date(now - (i + 1) * 60000).toISOString() }));
  const s = sinceSection({ entries: [], follow: { built: 11, total: 11, recent, asked: recent } }, { at: new Date(now - 3600000).toISOString(), built: 0, total: 11 }, now);
  const shown = s.blocks.find((b) => b.t === 'list').items.length;
  assert.equal(shown, 8); assert.equal(s.blocks.find((b) => b.t === 'note').text, 'And 3 more, listed under What got built.');
  const c = { lap: 2, upgraded: 0, added: 0, recent: [], built: ['one', 'two', 'three', 'four', 'five'] };
  assert.match(changedLine(c), /one; two; and 3 more$/); assert.ok(!/…/.test(changedLine(c)));
  const asks = ['Fix the images exam to handle drawing commands, image URL rendering, and picture generation.', 'Fix the images exam to handle drawing, displaying specific URLs, and generating pictures.', 'Give the timer skill a lap button', 'Teach the podcasts skill to read RSS feeds', 'Add a page for ndscalc.com to LANE_PAGES', 'Add a page for emojigraph.org to LANE_PAGES']
    .map((ask) => ({ ask, at: '2026-11-04T10:00:00Z', kind: 'build' }));
  const m = cardModel({ will: { wants: [] }, reflect: { asks, entries: [] }, self: { open: [] } });
  assert.equal(m.asks.length, 5, 'the images exam said twice is one ask');
  const h = cardHtml(m, esc);
  assert.match(h, /and 2 more/); assert.match(h, /Show the other 2</);
});
