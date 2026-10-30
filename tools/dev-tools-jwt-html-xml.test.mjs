// The JWT decoder, HTML entities and XML formatter modes of the dev tools card (2026-10-30): the pure logic in lib/dev-tools.js and
// the asks that open them in skills/dev-tools.js. Run: node --test tools/dev-tools-jwt-html-xml.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import devTools from '../void-live-deploy/skills/dev-tools.js';
import * as D from '../void-live-deploy/lib/dev-tools.js';

// the jwt.io sample token, with an exp of 1700000000 (2023-11-14T22:13:20Z) added
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJleHAiOjE3MDAwMDAwMDB9.abc';

test('jwtDecode: header and payload as JSON, times in UTC held against now, the signature never called valid', () => {
  const r = D.jwtDecode(TOKEN, Date.UTC(2026, 9, 30));
  assert.equal(r.ok, true);
  assert.deepEqual(r.header, { alg: 'HS256' });
  assert.deepEqual(r.payload, { sub: '1234567890', name: 'John', exp: 1700000000 });
  assert.deepEqual(r.times, [{ claim: 'exp', label: 'Expires', iso: '2023-11-14T22:13:20Z', state: 'expired' }]);
  assert.equal(r.signed, true);
  assert.equal(D.jwtDecode(TOKEN, Date.UTC(2023, 0, 1)).times[0].state, 'not expired yet');
  assert.equal(D.jwtDecode('Bearer ' + TOKEN).ok, true);
  // alg none: no signature to speak of
  assert.equal(D.jwtDecode(D.b64Encode('{"alg":"none"}').replace(/=+$/, '') + '.' + D.b64Encode('{"a":1}').replace(/=+$/, '') + '.').signed, false);
  assert.match(D.jwtDecode('abc.def').err, /3 parts/);
  assert.match(D.jwtDecode('a.b.c.d').err, /3 parts/);
  assert.match(D.jwtDecode('ab$c.def.g').err, /Base64url/);
  assert.match(D.jwtDecode('aGVsbG8.eyJhIjoxfQ.x').err, /header is not JSON/);
  assert.deepEqual(D.jwtDecode(''), { ok: true, header: null, payload: null, times: [], signed: false });
});

test('HTML entities: escape the five characters, unescape named and numeric ones, leave an unknown name alone', () => {
  assert.equal(D.htmlEscape('<a href="x">it\'s & more</a>'), '&lt;a href=&quot;x&quot;&gt;it&#39;s &amp; more&lt;/a&gt;');
  assert.equal(D.htmlUnescape('&lt;b&gt; &amp; &#x2603; &#9731; &copy; &nbsp;|&bogus; &#0;'), '<b> & ☃ ☃ ©  |&bogus; �');
  assert.equal(D.htmlUnescape(D.htmlEscape('<p class="a">Tom & Jerry\'s</p>')), '<p class="a">Tom & Jerry\'s</p>');
  assert.equal(D.htmlUnescape('&amp;lt;'), '&lt;', 'one pass only: &amp;lt; is the text &lt;');
});

test('formatXml: indents, keeps short text on its line, minifies, and names what is wrong', () => {
  const r = D.formatXml('<?xml version="1.0"?><a x="1>2"><b>1</b><!-- c --><c/><d>t <e>x</e> u</d></a>');
  assert.equal(r.out, '<?xml version="1.0"?>\n<a x="1>2">\n  <b>1</b>\n  <!-- c -->\n  <c/>\n  <d>\n    t\n    <e>x</e>\n    u\n  </d>\n</a>');
  assert.equal(D.formatXml('<a>\n  <b>1</b>\n</a>', { minify: true }).out, '<a><b>1</b></a>');
  assert.equal(D.formatXml('<a><![CDATA[1 < 2]]></a>').out, '<a>\n  <![CDATA[1 < 2]]>\n</a>');
  assert.match(D.formatXml('<a><b></a>').err, /wrong order/);
  assert.match(D.formatXml('<a></a><b/>').err, /one root element/);
  assert.match(D.formatXml('<a>1 < 2</a>').err, /not a tag/);
  assert.match(D.formatXml('<a>').err, /<a> is never closed/);
  assert.match(D.formatXml('</a>').err, /never opened/);
  assert.match(D.formatXml('<a><!-- x</a>').err, /comment is never closed/);
  assert.match(D.formatXml('hi <a/>').err, /outside the root/);
  assert.equal(D.formatXml('  ').out, '');
});

test('the asks: each tool by name, with what follows as its input, and what is not one of them', () => {
  assert.deepEqual(D.devOf('jwt decoder'), { mode: 'jwt', input: '' });
  assert.deepEqual(D.devOf('decode this jwt ' + TOKEN), { mode: 'jwt', input: TOKEN });
  assert.deepEqual(D.devOf(TOKEN), { mode: 'jwt', input: TOKEN });
  assert.deepEqual(D.devOf('html escape <b>'), { mode: 'html', input: '<b>', opts: { dir: 'encode' } });
  assert.deepEqual(D.devOf('html decode &lt;b&gt;'), { mode: 'html', input: '&lt;b&gt;', opts: { dir: 'decode' } });
  assert.deepEqual(D.devOf('html encoder'), { mode: 'html', input: '', opts: { dir: 'encode' } });
  assert.deepEqual(D.devOf('unescape html &amp;'), { mode: 'html', input: '&amp;', opts: { dir: 'decode' } });
  assert.deepEqual(D.devOf('xml formatter'), { mode: 'xml', input: '', opts: { minify: false } });
  assert.deepEqual(D.devOf('minify xml <a> <b/> </a>'), { mode: 'xml', input: '<a> <b/> </a>', opts: { minify: true } });
  for (const a of ['what is a jwt', 'what is xml', 'json vs xml', 'html tutorial', 'learn html', 'xml']) assert.equal(D.devOf(a), null, a);
  for (const e of devTools.examples) assert.ok(devTools.match(e.toLowerCase(), e), e);
  for (const n of devTools.nearMisses) assert.ok(!devTools.match(n.toLowerCase(), n), n);
  for (const m of ['jwt', 'html', 'xml']) assert.ok(D.MODES.includes(m), m);
});
