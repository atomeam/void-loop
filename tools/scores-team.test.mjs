// One team's game (lib/scores.js teamScoreAsk and teamGame, skills/scores.js), 2026-10-30: "what was the chiefs score last night",
// "how did the lakers do" and "did the yankees win" fell to an article on a-to-mind.com. Now each league's board for the day is read
// and the card shows that team's game, with the feed as its source, or says plainly that no game was found.
//   node --test tools/scores-team.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { teamScoreAsk, teamGame } from '../void-live-deploy/lib/scores.js';
import scores from '../void-live-deploy/skills/scores.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
async function ask(text, answer) {
  const el = { innerHTML: '' }, real = globalThis.fetch, seen = [];
  globalThis.fetch = async (u) => { seen.push(String(u)); const b = answer(new URL(String(u), 'https://x').searchParams); if (b instanceof Error) throw b; return { ok: true, json: async () => b }; };
  try { const r = await scores.run(text, { showPage: (f) => { f(el); return el; }, esc, _pageStill: () => true }); return { r, html: el.innerHTML, seen }; }
  finally { globalThis.fetch = real; }
}
const side = (name, abbr, score, winner) => ({ id: '1', name, short: name.split(' ').pop(), abbr, score, winner });
const chiefs = { kind: 'game', state: 'final', status: 'Final', start: '2026-10-30T00:15Z', home: side('Kansas City Chiefs', 'KC', '27', true), away: side('Denver Broncos', 'DEN', '20', false) };

test('team asks are read, league asks and other scores are not', () => {
  assert.deepEqual(teamScoreAsk('what was the chiefs score last night'), { team: 'chiefs', day: 'yesterday' });
  assert.deepEqual(teamScoreAsk('how did the lakers do'), { team: 'lakers', day: '' });
  assert.deepEqual(teamScoreAsk('did the yankees win yesterday?'), { team: 'yankees', day: 'yesterday' });
  assert.deepEqual(teamScoreAsk('the lakers score tonight'), { team: 'lakers', day: 'today' });
  assert.deepEqual(teamScoreAsk('chiefs score'), { team: 'chiefs', day: '' });
  for (const a of ['what is my credit score', 'what is the score', 'nba scores', 'premier league table', 'sat score', 'what was the final score']) assert.equal(teamScoreAsk(a), null, a);
});

test('teamGame finds the team by a whole word of its name, short name or abbreviation, and skips races', () => {
  const boards = [{ league: 'f1', games: [{ kind: 'race', name: 'Kansas City GP' }] }, { league: 'nfl', games: [chiefs] }];
  assert.equal(teamGame(boards, 'chiefs').league, 'nfl'); assert.equal(teamGame(boards, 'kc').game, chiefs);
  assert.equal(teamGame(boards, 'chief'), null); assert.equal(teamGame(boards, 'kansas city gp'), null); assert.equal(teamGame(null, 'x'), null);
});

test('"what was the chiefs score last night" shows yesterday\'s game with the winner and the feed as its source', async () => {
  const o = await ask('what was the chiefs score last night', (q) => ({ ok: true, source: 'ESPN', games: q.get('league') === 'nfl' ? [chiefs] : [] }));
  assert.equal(o.r, 'scores');
  assert.ok(o.seen.every((u) => !u.includes('league=f1')) && o.seen.length === 11, o.seen.join(' '));
  assert.match(o.html, /<h2>Chiefs score<\/h2>/); assert.ok(o.html.includes('Kansas City Chiefs 27 – 20 Denver Broncos'), o.html);
  assert.ok(o.html.includes('Kansas City Chiefs won.') && o.html.includes('NFL') && o.html.includes(', yesterday'), o.html);
  assert.match(o.html, /<div class="src">Source: ESPN/);
});

test('no day named: today first, then yesterday; no game at all says so; no feed says it did not answer', async () => {
  let o = await ask('how did the chiefs do', (q) => ({ ok: true, games: q.get('league') === 'nfl' && o2(q) ? [chiefs] : [] }));
  function o2(q) { return q.get('date') !== new Date().toLocaleDateString('en-CA'); }
  assert.equal(o.r, 'scores'); assert.equal(o.seen.length, 22); assert.ok(o.html.includes(', yesterday'));
  o = await ask('did the zzyzx win', () => ({ ok: true, games: [] }));
  assert.equal(o.r, 'scores'); assert.match(o.html, /No Zzyzx game today or yesterday in the leagues Verse follows/);
  o = await ask('did the chiefs win', () => new Error('offline'));
  assert.equal(o.r, 'none'); assert.match(o.html, /didn't answer just now/);
});
