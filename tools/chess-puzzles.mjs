// Writes /chess/'s own puzzles (void-live-deploy/chess/puzzles.json): positions found by Verse's engine (lib/chess-engine.js) in games it plays against
// itself with some randomness, kept when the side to move has one clear best move: a mate in 1, 2 or 3 with a single first move that mates soonest, or
// a move that wins at least two pawns more than any other move. One puzzle a game, and mates in one at most a third of them, so the set is varied. Nothing is copied from a puzzle site. Deterministic for a seed, so the file is the
// same on every machine:   node tools/chess-puzzles.mjs [count=240] [seed=1]
// Each puzzle: { id, fen, line: ['e2e4', ...] (the solver's moves and the replies, the solver first), theme, rating } with a rough rating (mate in 1
// about 900, deeper mates and quiet wins higher), said as a guess on the page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { search } from '../void-live-deploy/lib/chess-engine.js';
import { fromFEN, toFEN, legalMoves, apply, status, sqName } from '../void-live-deploy/skills/chess-rules.js';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'chess', 'puzzles.json');
const uci = (m) => sqName(m.from) + sqName(m.to) + (m.promo ? m.promo.toLowerCase() : '');
let seed = +(process.argv[3] || 1) >>> 0 || 1;
const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const want = +(process.argv[2] || 240);
const play = (p, u) => { const m = legalMoves(p).find((x) => uci(x) === u); return m ? apply(p, m) : null; };

/** a puzzle from a position, or null: the engine's best move must stand clear of every other move */
export function puzzleAt(fen) {
  const top = search(fen, { depth: 12, ms: 600 });
  if (!top.move) return null;
  const p = fromFEN(fen);
  if (top.mate && top.mate > 0 && top.mate <= 3) {
    // a single first move that mates as soon: every other move mates later or not at all
    for (const m of legalMoves(p)) { const u = uci(m); if (u === top.move) continue; const n = apply(p, m); if (status(n) === 'checkmate') return null; const r = search(toFEN(n), { depth: 2 * top.mate, ms: 400 }); if (r.mate && r.mate < 0 && -r.mate <= top.mate - 1) return null; }
    const line = top.pv.slice(0, 2 * top.mate - 1); let q = p; for (const u of line) { q = play(q, u); if (!q) return null; }
    if (status(q) !== 'checkmate') return null;
    return { line, theme: 'mate in ' + top.mate, rating: [0, 900, 1300, 1700][top.mate] + Math.round(rng() * 150) };
  }
  if (top.mate || top.score < 150 || top.score > 900) return null;
  // the quiet-looking win: the best move gains 200 centipawns over the next best, and the position before it was about level
  let second = -Infinity;
  for (const m of legalMoves(p)) { const u = uci(m); if (u === top.move) continue; const r = search(toFEN(apply(p, m)), { depth: 5, ms: 250 }); const v = r.mate ? (r.mate > 0 ? -30000 : 30000) : -r.score; if (v > second) second = v; if (second > top.score - 200) return null; }
  const line = top.pv.slice(0, 3); let q = p; for (const u of line) { q = play(q, u); if (!q) return null; }
  const cap = !!p.board[legalMoves(p).find((x) => uci(x) === top.move).to];
  return { line: line.slice(0, line.length % 2 ? line.length : line.length - 1), theme: cap ? 'win material' : 'the one good move', rating: 1200 + Math.min(700, Math.round((top.score - second) / 2)) };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = [], seen = new Set();
  for (let game = 0; out.length < want && game < 4000; game++) {
    let p = fromFEN('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    for (let ply = 0; ply < 140 && out.length < want; ply++) {
      const st = status(p); if (/mate|draw/.test(st)) break;
      const fen = toFEN(p);
      if (ply >= 14 && rng() < 0.35 && !seen.has(fen.split(' ')[0])) { seen.add(fen.split(' ')[0]); const z = puzzleAt(fen); const ones = out.filter((x) => x.theme === 'mate in 1').length; if (z && !(z.theme === 'mate in 1' && ones >= want * 0.35)) { out.push({ id: 'v' + String(out.length + 1).padStart(3, '0'), fen, ...z }); console.log(out.length, z.theme, fen); break; } }
      const r = ply < 8 ? null : search(fen, { depth: 3, ms: 120, noise: 60, slip: 0.08, rng });
      const ms = legalMoves(p), m = r && r.move ? ms.find((x) => uci(x) === r.move) : ms[Math.floor(rng() * ms.length)];
      p = apply(p, m);
    }
  }
  out.sort((a, b) => a.rating - b.rating);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ about: 'Chess puzzles found by Verse\'s own engine in games it played against itself (tools/chess-puzzles.mjs). Ratings are rough guesses.', puzzles: out }) + '\n');
  console.log('wrote', out.length, 'puzzles to', OUT);
}
