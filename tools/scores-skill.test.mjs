// scores (skills/scores.js): the league asks, the /api/scores call each one makes, and the card from a canned feed (live first, eight at most, the table's top eight); a feed that fails says so. fetch is stubbed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/scores.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
async function card(text, feed, still = true) {
  const asked = [], el = { innerHTML: '' }, real = globalThis.fetch;
  globalThis.fetch = async (u) => { asked.push(String(u)); if (feed instanceof Error) throw feed; return { json: async () => feed }; };
  try { const r = await sk.run(text, { showPage: (fn) => { fn(el); return el; }, esc, _pageStill: () => still }); return { r, asked, h: el.innerHTML }; } finally { globalThis.fetch = real; }
}
const game = (home, hs, away, as, state, status = '', start = '2026-10-29T23:00:00Z') => ({ home: { name: home, score: hs }, away: { name: away, score: as }, state, status, start });
const FAIL = "<p>The score feed didn't answer just now. Ask again in a moment, or open the Scores page.</p>";

test('the asks: its examples and hand-written ones on both sides', () => {
  for (const e of sk.examples) assert.ok(sk.match(e.toLowerCase(), e), e);
  for (const n of sk.nearMisses) assert.ok(!sk.match(n.toLowerCase(), n), n);
  for (const t of ['nba scores tonight', 'la liga table', 'f1 results', 'NHL scores?', "today's mlb games"]) assert.ok(sk.match(t.toLowerCase(), t), t);
  for (const t of ['cricket scores', 'nba', 'scores', 'nba scores from last week']) assert.ok(!sk.match(t.toLowerCase(), t), t);
});
test('nba scores: today\'s date asked, live first then upcoming then final, each drawn its own way', async () => {
  const feed = { ok: true, source: 'ESPN', games: [game('Celtics', '101', 'Knicks', '99', 'final'), game('Lakers', '', 'Suns', '', 'pre'), game('Bulls', '50', 'Heat', '48', 'live', 'Q3 5:00')] };
  const { r, asked, h } = await card('nba scores', feed);
  assert.equal(r, 'scores'); assert.deepEqual(asked, ['/api/scores?league=nba&date=' + today()]);
  assert.ok(h.startsWith('<h2>NBA scores</h2><div class="sub">Today, kick-offs in your time</div><ul>'), h.slice(0, 90));
  const items = [...h.matchAll(/<li style="margin:6px 0">(.*?)<\/li>/g)].map((m) => m[1]);
  assert.equal(items.length, 3);
  assert.equal(items[0], 'Bulls 50 – 48 Heat <span style="color:#8a8a8a">· LIVE Q3 5:00</span>');
  assert.ok(items[1].startsWith('Lakers vs Suns <span style="color:#8a8a8a">· '), items[1]);
  assert.equal(items[2], 'Celtics 101 – 99 Knicks <span style="color:#8a8a8a">· FT</span>');
  assert.ok(h.endsWith('<div class="src">Source: ESPN · data may be delayed</div>'));
});
test('eight games at most, names escaped, an old copy marked, an empty day said', async () => {
  const many = Array.from({ length: 10 }, (_, i) => game('<b>T' + i + '</b>', '1', 'U' + i, '0', 'final', 'Final'));
  const { h } = await card('epl scores today', { ok: true, stale: true, games: many });
  assert.equal((h.match(/<li /g) || []).length, 8);
  assert.ok(h.includes('&lt;b&gt;T0&lt;/b&gt; 1 – 0 U0 <span style="color:#8a8a8a">· Final</span>') && !h.includes('<b>'));
  assert.ok(h.startsWith('<h2>Premier League scores</h2><div class="sub">Today, kick-offs in your time (last saved copy)</div>'));
  assert.ok(h.includes('Source: public score feeds'));
  assert.ok((await card('nba scores', { ok: true, games: [] })).h.includes('<p>No games today.</p>'));
});
test('f1 results: a race shows its name', async () => {
  const { asked, h } = await card('f1 results', { ok: true, games: [{ kind: 'race', name: 'Mexico City Grand Prix', state: 'final', status: 'Final' }] });
  assert.ok(asked[0].startsWith('/api/scores?league=f1&date='));
  assert.ok(h.startsWith('<h2>Formula 1 scores</h2>')); assert.ok(h.includes('>Mexico City Grand Prix <span style="color:#8a8a8a">· Final</span></li>'));
});
test('premier league table: the standings view, the top eight with the last column', async () => {
  const rows = Array.from({ length: 9 }, (_, i) => ({ name: 'Club ' + (i + 1), cells: ['10', String(30 - i)] }));
  const { asked, h } = await card('premier league table', { ok: true, source: 'ESPN', groups: [{ cols: ['P', 'Pts'], rows }] });
  assert.deepEqual(asked, ['/api/scores?league=epl&view=standings']);
  assert.ok(h.startsWith('<h2>Premier League table</h2><div class="sub">The table now</div><ol>'));
  assert.equal((h.match(/<li>/g) || []).length, 8);
  assert.ok(h.includes('<li>Club 1 <span style="color:#8a8a8a">· Pts 30</span></li>') && h.includes('<li>Club 8 <span style="color:#8a8a8a">· Pts 23</span></li>') && !h.includes('Club 9'));
});
test('a feed that fails, says not ok, or has no table: the honest card, nothing invented', async () => {
  assert.equal((await card('nba scores', new Error('offline'))).h, '<h2>NBA scores</h2>' + FAIL);
  assert.equal((await card('nba scores', { ok: false })).h, '<h2>NBA scores</h2>' + FAIL);
  assert.equal((await card('nba scores', null)).h, '<h2>NBA scores</h2>' + FAIL);
  assert.equal((await card('bundesliga table', { ok: true, groups: [] })).h, '<h2>Bundesliga table</h2>' + FAIL);
});
test('a card the page has moved on from is left alone', async () => {
  const { r, h } = await card('nba scores', { ok: true, games: [game('A', '1', 'B', '2', 'final')] }, false);
  assert.equal(r, 'scores'); assert.equal(h, '<h2>NBA scores</h2><div class="sub">…</div>');
  assert.equal((await card('nba scores', new Error('x'), false)).h, '<h2>NBA scores</h2><div class="sub">…</div>');
});

// a day with no games (an international break, a league between seasons): the card still answers from the same feed, nearest first
async function byUrl(text, route) {
  const asked = [], el = { innerHTML: '' }, real = globalThis.fetch;
  globalThis.fetch = async (u) => { asked.push(String(u)); const q = new URL(String(u), 'http://x').searchParams; return { json: async () => route(q) }; };
  try { await sk.run(text, { showPage: (fn) => { fn(el); return el; }, esc, _pageStill: () => true }); return { asked, h: el.innerHTML }; } finally { globalThis.fetch = real; }
}
const shiftDay = (n) => { const d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
test('no games today: the latest results of the last seven days, only the most recent day', async () => {
  const two = new Date(Date.now() - 2 * 864e5).toISOString(), four = new Date(Date.now() - 4 * 864e5).toISOString();
  const { asked, h } = await byUrl('serie a scores', (q) => q.get('span') === '7' && q.get('date') === shiftDay(-7)
    ? { ok: true, games: [game('Napoli', '1', 'Lazio', '1', 'final', 'FT', two), game('Roma', '2', 'Inter', '0', 'final', 'FT', four)] } : { ok: true, games: [] });
  assert.ok(asked.includes('/api/scores?league=seriea&date=' + shiftDay(-7) + '&span=7'), asked.join(' '));
  assert.ok(h.includes('<p>No games today.</p><h3>Latest results, '), h);
  assert.ok(h.includes('Napoli 1 \u2013 1 Lazio') && !h.includes('Roma'), h);
});
test('no games today or last week: the next games of the coming seven days', async () => {
  const soon = new Date(Date.now() + 3 * 864e5).toISOString();
  const { h } = await byUrl('premier league scores', (q) => q.get('date') === shiftDay(1) ? { ok: true, games: [game('Arsenal', '', 'Spurs', '', 'pre', '', soon)] } : { ok: true, games: [] });
  assert.ok(h.includes('<h3>Next games, from ') && h.includes('Arsenal vs Spurs'), h);
});
test('between seasons: the table as it stands, by its points column', async () => {
  const { asked, h } = await byUrl('mlb scores', (q) => q.get('view') === 'standings'
    ? { ok: true, groups: [{ name: 'American League', cols: ['W', 'L', 'Pct', 'GB'], rows: [{ name: 'Tampa Bay Rays', cells: ['98', '64', '.605', '-'] }] }] } : { ok: true, games: [] });
  assert.ok(asked.includes('/api/scores?league=mlb&view=standings'));
  assert.ok(h.includes('the table as it stands (American League)</h3><ol><li>Tampa Bay Rays <span style="color:#8a8a8a">\u00b7 Pct .605</span></li></ol>'), h);
});
