// The easiest-sites scanner (tools/easiest-sites.mjs): how much a home page does, and how hard it is to beat. Run: node --test tools/easiest-sites.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { features, hardness } from './easiest-sites.mjs';

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
