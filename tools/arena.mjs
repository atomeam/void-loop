// arena — Verse plays Connect Four against itself and writes down how good it is (frontier #5, lib/arena.js).
// 200 games: a depth ladder (each look-ahead depth against the one below, 40 games a step, depth 1 anchored at 1000), then a
// tuned evaluation at depth 2 (a nudged copy plays the card's own weights for 40 games; kept only if it wins clearly, and
// rated from those games against depth 2). The result goes to void-live-deploy/arena.json, the record an ask can answer from.
//   node tools/arena.mjs            plays, prints the ratings, writes arena.json
//   node tools/arena.mjs --learn    the same, plus one day of self-play tuning from the kept champion (the daily workflow)
//   node tools/arena.mjs --check    plays nothing; exit 1 when arena.json is missing or not shaped as written here
// It also rates Othello (random, greedy, the card's engine; random = 1000) into void-live-deploy/arena-othello.json.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladder, tune, perf, ladderOf, othelloGame, othelloPlayers, match } from '../void-live-deploy/lib/arena.js';
import { WEIGHTS } from '../void-live-deploy/skills/connect4-rules.js';
import { pushHistory } from '../void-live-deploy/lib/arena-say.js';

export const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'arena.json');
export const DEPTHS = [1, 2, 3, 4], GAMES = 40, SEED = 1;
export const OUT_OTHELLO = resolve(dirname(OUT), 'arena-othello.json');

// Othello (run 62): random, greedy and the card's own engine, each against the one before it, 40 games a step; random = 1000
export function runOthello() {
  const t0 = Date.now(), steps = ladderOf(othelloGame, othelloPlayers(), GAMES, SEED);
  return { game: 'othello', games: GAMES * (steps.length - 1), anchor: 'random = 1000', ladder: steps, ms: Date.now() - t0 };
}

export function run() {
  const t0 = Date.now(), steps = ladder(DEPTHS, GAMES, SEED);
  const t = tune({ depth: 2, rounds: 1, games: GAMES, seed: SEED });
  const d2 = steps.find((s) => s.depth === 2);
  // the challenger is rated from its own games against the card's weights (the champion's final match replays the card's
  // weights against themselves when the challenger lost, which says nothing about the challenger)
  const c = t.rounds[0];
  const tuned = { name: 'depth 2, tuned', depth: 2, weights: c.challenger, kept: c.kept, rating: perf(d2.rating, c.score), vs: d2.name + ' (the card\'s weights)', score: c.score };
  const games = GAMES * (DEPTHS.length - 1) + GAMES * (t.rounds.length + 1); // the ladder, the tuning round, the champion's check
  return { game: 'connect4', games, anchor: 'depth 1 = 1000', ladder: steps, tuned, rounds: t.rounds, ms: Date.now() - t0 };
}

// The learning half (frontier #5): one day of self-play tuning at depth 2, starting from the champion the earlier days kept
// (arena.json's champion; the card's own weights the first time), with challengers seeded by the date so a day can be
// replayed. A challenger is kept only when it beats the champion clearly (lib/arena.js tune); the champion is then rated
// against the card's own weights. The card itself still plays WEIGHTS: adopting the champion is a separate, reviewed change.
const daySeed = (day) => Number(String(day).replace(/\D/g, '').slice(0, 8)) || 1;
export function learn(prev, day, { rounds = 3, games = 40 } = {}) {
  if (prev && prev.last === day) return prev; // one day of tuning per day: a rerun the same day changes nothing
  const start = (prev && prev.weights) || { ...WEIGHTS };
  const t = tune({ depth: 2, rounds, games, seed: daySeed(day), start });
  const changed = JSON.stringify(t.champion.weights) !== JSON.stringify(start);
  const isCard = JSON.stringify(t.champion.weights) === JSON.stringify({ ...WEIGHTS });
  // the card's own weights against themselves is even by definition (a fixed seed's openings would only add noise)
  const vsCard = isCard ? 0.5 : match({ depth: 2, weights: t.champion.weights }, { depth: 2, weights: WEIGHTS }, games, daySeed(day) + 7).score;
  return { weights: t.champion.weights, vsCard, since: changed || !prev ? day : prev.since, last: day, days: ((prev && prev.days) || 0) + 1, tried: t.rounds.map(({ score, kept }) => ({ score, kept })) };
}

export const shapeOk = (a) => !!a && a.game === 'connect4' && a.games >= 200 && Array.isArray(a.ladder) && a.ladder.length >= 2
  && a.ladder.every((s) => Number.isFinite(s.rating) && Number.isFinite(s.depth)) && a.tuned && Number.isFinite(a.tuned.rating);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    let a = null; try { a = existsSync(OUT) && JSON.parse(readFileSync(OUT, 'utf8')); } catch (_) {}
    console.log(shapeOk(a) ? 'arena.json: ' + a.games + ' games, ratings ' + a.ladder.map((s) => s.name + ' ' + s.rating).join(', ') : 'arena.json missing or malformed: node tools/arena.mjs');
    process.exit(shapeOk(a) ? 0 : 1);
  }
  const r = run(), day = new Date().toISOString().slice(0, 10);
  const { ms, ...keep } = r;
  let was = null; try { was = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : null; } catch (_) { was = null; }
  const prev = (was && was.champion) || null;
  const champion = process.argv.includes('--learn') ? learn(prev, day) : prev; // --learn: one more day of self-play tuning
  // one line a day for the card's "day over day" (lib/arena-say.js): the strongest depth's rating and the champion's score
  const history = pushHistory(was && was.history, { date: day, rating: r.ladder[r.ladder.length - 1].rating, vsCard: champion ? champion.vsCard : null });
  writeFileSync(OUT, JSON.stringify({ ...keep, ...(champion ? { champion } : {}), played: day, history }, null, 2) + '\n');
  if (champion) console.log('champion since ' + champion.since + ' (' + champion.days + ' day' + (champion.days === 1 ? '' : 's') + '): ' + Math.round(champion.vsCard * 100) + '% against the card\'s own weights; tried ' + champion.tried.map((t) => Math.round(t.score * 100) + '%' + (t.kept ? ' kept' : '')).join(', '));
  for (const s of r.ladder) console.log(s.name.padEnd(16), String(s.rating).padStart(5), s.vs ? ' (' + Math.round(s.score * 100) + '% against ' + s.vs + ')' : ' (anchor)');
  console.log(r.tuned.name.padEnd(16), String(r.tuned.rating).padStart(5), ' (' + Math.round(r.tuned.score * 100) + '% against the card\'s weights at depth 2; ' + (r.tuned.kept ? 'kept: it wins clearly' : 'not kept: the card\'s weights stay') + ')');
  console.log(r.games + ' games in ' + (ms / 1000).toFixed(1) + ' s -> ' + OUT);
  const o = runOthello(), { ms: oms, ...okeep } = o;
  writeFileSync(OUT_OTHELLO, JSON.stringify({ ...okeep, played: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
  for (const st of o.ladder) console.log('othello ' + st.name.padEnd(9), String(st.rating).padStart(5), st.vs ? ' (' + Math.round(st.score * 100) + '% against ' + st.vs + ')' : ' (anchor)');
  console.log(o.games + ' Othello games in ' + (oms / 1000).toFixed(1) + ' s -> ' + OUT_OTHELLO);
}
