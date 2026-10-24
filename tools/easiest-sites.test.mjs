// The easiest-sites scanner (tools/easiest-sites.mjs): how much a home page does, and how hard it is to beat. Run: node --test tools/easiest-sites.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { features, hardness, isToolHost, junk } from './easiest-sites.mjs';

const page = (b) => '<!doctype html><title>T</title><body>' + b + '</body>';
test('a one-button page is far easier than a busy one, and a page with nothing to use is not a tool', () => {
  const coin = hardness(features(page('<button>Flip the coin!</button><p>Heads or tails, decided.</p>')));
  const busy = hardness(features(page('<input type="text"><input type="text"><select></select><button>a</button><button>b</button>' + '<a href="/x">x</a>'.repeat(80) + ' word'.repeat(900))));
  assert.ok(coin < busy / 5, coin + ' vs ' + busy);
  assert.equal(hardness(features(page('<p>A poster with no controls at all, just words about things.</p>'))), null);
  assert.equal(hardness(features(page('<input type="password"><button>Sign in</button> some words here'))), null, 'an account wall is not a one-tool site');
});
test('scripts, styles, comments and hidden inputs are not counted as what the page does', () => {
  const f = features(page('<script>var a="<button>"</script><!-- <button> --><style>b{}</style><input type="hidden"><input type="text"><button>go</button> use this'));
  assert.equal(f.inputs, 1); assert.equal(f.buttons, 1); assert.equal(f.scripts, 1);
});
test('a host whose name says a tool is scanned; adult and unrelated hosts are not', () => {
  for (const h of ['justflipacoin.com', 'calculator.net', 'random.org', 'color-hex.com', 'base64encode.org', 'online-stopwatch.com', 'jsonformatter.org']) assert.ok(isToolHost(h), h);
  for (const h of ['google.com', 'amazonaws.com', 'cloudflare.com', 'pornhub-calculator.xyz', 'betcounter.com']) assert.ok(!isToolHost(h), h);
});
test('parked, for-sale, adult-titled and empty shell pages are junk; a real one-button tool is not', () => {
  assert.ok(junk(features('<title>This domain is for sale</title><body>buy it now <a href="/">x</a> <a href="/y">y</a> more words here for the count of it</body>')));
  assert.ok(junk(features('<title>x</title><body><button>go</button></body>')));
  assert.ok(!junk(features('<title>Flip a coin</title><body><button>Flip</button> Heads or tails, decided at once, fair and quick. <a href="/a">a</a> <a href="/b">b</a></body>')));
});
test('junk: an accented casino and a consent screen are not tools', async () => {
  const { junk } = await import('./easiest-sites.mjs');
  assert.equal(junk({ title: 'Chicken Road ▷ Gioco da casinò', words: 300, links: 40 }), true);
  assert.equal(junk({ title: 'Preferências de Anúncio', words: 300, links: 40 }), true);
  assert.equal(junk({ title: 'Thexchange.com for sale | Spaceship.com', words: 300, links: 40 }), true); assert.equal(junk({ title: 'Operated by Clickadu Advertisement Network', words: 300, links: 40 }), true);
  assert.equal(junk({ title: 'ColorZilla - Eyedropper, Color Picker', words: 300, links: 40 }), false);
});
