// sports-browse (skills/sports-browse.js): which asks list the sports Verse covers, and the card: the six live-score sports, the 36 more, the escaped source line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/sports-browse.js';

const m = (t) => sk.match(t.toLowerCase(), t);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
test('examples in, near misses out, and the asks the pattern names', () => {
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
  for (const a of ['browse all sports', 'the list of all sports', 'What sports do you have?', 'what sports does verse cover', 'sports search', 'sports browser', 'A list of sports.']) assert.ok(m(a), a);
  for (const a of ['sports news', 'list of sports cars', 'browse sports bars near me', 'what sports do you like', 'sports']) assert.ok(!m(a), a);
});
test('the card lists the live-score sports and passes its source through esc', () => {
  const el = { innerHTML: '' }, seen = [];
  assert.equal(sk.run('browse sports', { showPage: (f) => f(el), esc: (s) => { seen.push(s); return esc(s); } }), 'sports-browse');
  assert.match(el.innerHTML, /^<h2>Sports<\/h2><div class="sub">Live scores in Verse<\/div>/);
  assert.equal((el.innerHTML.match(/<li>/g) || []).length, 6);
  for (const s of ['Soccer: Premier League, La Liga', 'Basketball: NBA', 'American football: NFL', 'Baseball: MLB', 'Ice hockey: NHL', 'Motorsport: Formula 1']) assert.ok(el.innerHTML.includes(s), s);
  assert.match(el.innerHTML, /Thirty-six more sports are listed on the Sports page/);
  assert.deepEqual(seen, ['TheSportsDB for the search, ESPN, OpenLigaDB and Jolpica for scores']);
  assert.ok(el.innerHTML.includes('<div class="src">Source: TheSportsDB for the search, ESPN, OpenLigaDB and Jolpica for scores</div>'));
});
