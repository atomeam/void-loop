// tools/design-loop.mjs: the pure parts (the order, the slice, the colour that passes, the rule a small target gets, the marked block)
import test from 'node:test';
import assert from 'node:assert/strict';
import { controlsIn, rank, sliceFor, passColor, ratio, targetRule, blockRules, withBlock, keeps, onlyBlock, rulesFor, bareRules, sitePages, START, END } from './design-loop.mjs';

const hex = (h) => ({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) });

test('controls are buttons, links, fields; a hidden input is not one', () => {
  assert.equal(controlsIn('<a href="/">x</a><a name="y">no href</a><button>b</button><input type="hidden"><input><select></select><textarea></textarea>'), 5);
});
test('smallest first: fewest controls, then fewest bytes, then the path', () => {
  const r = rank([{ url: '/b/', controls: 2, bytes: 10 }, { url: '/a/', controls: 1, bytes: 90 }, { url: '/c/', controls: 1, bytes: 50 }, { url: '/d/', controls: 1, bytes: 50 }]);
  assert.deepEqual(r.map((p) => p.url), ['/c/', '/d/', '/a/', '/b/']);
});
test('the slices go round, so every page comes back', () => {
  const pages = Array.from({ length: 7 }, (_, i) => ({ url: '/' + i + '/' }));
  assert.deepEqual(sliceFor(pages, 0, 3).map((p) => p.url), ['/0/', '/1/', '/2/']);
  assert.deepEqual(sliceFor(pages, 2, 3).map((p) => p.url), ['/6/']);
  assert.deepEqual(sliceFor(pages, 3, 3).map((p) => p.url), ['/0/', '/1/', '/2/']);
  assert.deepEqual(sliceFor([], 5, 3), []);
});
test('a grey under the bar on a dark page goes lighter until it passes, and no further than it needs', () => {
  const bg = hex('#0b0d17'), c = passColor(hex('#4a4f63'), [bg], 4.5);
  assert.ok(ratio(hex(c), bg) >= 4.5, c);
  const back = hex(c); assert.ok(ratio({ r: back.r - 12, g: back.g - 12, b: back.b - 12 }, bg) < 4.6, 'the colour is near the bar, not white');
});
test('on a light background the colour goes darker; a colour that passes is kept', () => {
  const c = passColor(hex('#9aa0a6'), [hex('#ffffff')], 4.5);
  assert.ok(ratio(hex(c), hex('#ffffff')) >= 4.5 && c !== '#000000', c);
  assert.equal(passColor(hex('#ffffff'), [hex('#000000')], 4.5), '#ffffff');
});
test('one colour for a selector passes against every background it sits on', () => {
  const bgs = [hex('#0b0d17'), hex('#1b1f33')], c = passColor(hex('#555a70'), bgs, 4.5);
  for (const b of bgs) assert.ok(ratio(hex(c), b) >= 4.5);
});
test('a small target gets a box of 24 by 24 px at least, by its display', () => {
  assert.match(targetRule('inline'), /display:inline-flex.*min-width:24px;min-height:24px/);
  assert.match(targetRule('block'), /display:flex/);
  assert.equal(targetRule('flex'), 'min-width:24px;min-height:24px;box-sizing:border-box');
});
test('the marked block goes before </body>, and a second run merges into the same block', () => {
  const page = '<html><head><style>a{}</style></head><body><p>x</p></body></html>';
  const one = withBlock(page, { '#a': 'color:#fff' });
  assert.ok(one.indexOf(START) > one.indexOf('<p>x</p>') && one.indexOf(END) < one.indexOf('</body>'));
  assert.equal(one.replace(/\n?<style>\n[\s\S]*?\n<\/style>\n/, ''), page, 'nothing else on the page changed');
  const two = withBlock(one, { '.b': 'min-width:24px' });
  assert.equal(two.split(START).length, 2, 'one block');
  assert.deepEqual(blockRules(two), { '#a': 'color:#fff', '.b': 'min-width:24px' });
  assert.match(withBlock('<p>no body tag', { '#a': 'color:#fff' }), /<p>no body tag\n<style>/);
});
test('the change is kept only when the defects go down and nothing else gets worse', () => {
  const b = { defects: 5, overflow: 0, cls: 0.02 };
  assert.equal(keeps(b, { defects: 2, overflow: 0, cls: 0.02 }, 0.03), true);
  assert.equal(keeps(b, { defects: 5, overflow: 0, cls: 0.02 }, 0.03), false, 'no fewer');
  assert.equal(keeps(b, { defects: 2, overflow: 30, cls: 0.02 }, 0.03), false, 'scrolls sideways');
  assert.equal(keeps(b, { defects: 2, overflow: 0, cls: 0.2 }, 0.03), false, 'a new shift');
  assert.equal(keeps(b, { defects: 2, overflow: 0, cls: 0.02 }, 0.4), false, 'too much of the first screen changed');
  assert.equal(keeps(b, null, 0), false);
});
test('the rules: one colour per selector, a box per small target', () => {
  const r = rulesFor({ contrast: [{ sel: '.m', fg: hex('#4a4f63'), bg: hex('#0b0d17'), need: 4.5 }, { sel: '.m', fg: hex('#4a4f63'), bg: hex('#1b1f33'), need: 4.5 }], targets: [{ sel: '#x', display: 'inline' }] });
  assert.deepEqual(Object.keys(r), ['.m', '#x']);
  assert.match(r['.m'], /^color:#[0-9a-f]{6}$/);
});
test("Verse's own pages are found, each with a URL ending in a slash", () => {
  const p = sitePages();
  assert.ok(p.length > 100, 'pages: ' + p.length);
  assert.ok(p.every((x) => x.url.endsWith('/') && x.bytes > 0));
  assert.ok(p.some((x) => x.url === '/'));
});

test('onlyBlock passes a page that is its old self plus the block, and nothing else', () => {
  const old = '<html><body><p>hi</p></body></html>';
  const good = withBlock(old, { '#a': 'color:#aabbcc', 'body > div:nth-of-type(2) > a': 'min-width:24px;min-height:24px' });
  assert.ok(onlyBlock(old, good));
  assert.ok(onlyBlock(good, withBlock(good, { '.x b': 'color:#ffffff' })), 'a later run adds to the block');
  assert.equal(onlyBlock(old, good.replace('<p>hi</p>', '<p>hello</p>')), false, 'a change outside the block');
  assert.equal(onlyBlock(old, withBlock(old, { '#a': 'background:url(http://x/y)' })), false, 'a url in a value');
  assert.equal(onlyBlock(old, withBlock(old, { '#a': 'color:red}</style><script>1</script><style>a{' })), false, 'markup in a value');
  assert.equal(onlyBlock(old, old), false, 'no block at all');
});

test('bare rules: an unstyled key gets the dark key, an empty key with an svg gets an icon size, an empty key without one gets nothing', () => {
  const r = bareRules({ unstyled: [{ sel: '#mic', bg: 'rgb(107, 107, 107)', text: '' }], empty: [{ sel: '#sound', svg: true, label: 'sound' }, { sel: 'a:nth-of-type(2)', svg: false, label: '' }] });
  assert.match(r['#mic'], /appearance:none/); assert.match(r['#mic'], /background:#1c2030/);
  assert.equal(r['#sound svg'], 'width:18px;height:18px;flex:none');
  assert.equal(Object.keys(r).length, 2);
  assert.deepEqual(bareRules(undefined), {});
});
