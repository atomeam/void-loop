// The one growth loop's daily pass. The tournament is lib/idea-core.js. This reads what already exists (skills, pages,
// games, the open gaps, the capability sweep) and writes the owner board void-live-deploy/tower.ideas.json.
// Visitor words never land in that file: signals() keeps a topic only when three or more people typed it.
//   node tools/idea-engine.mjs           print the board
//   node tools/idea-engine.mjs --write   write tower.ideas.json and idea-ids.json
// A model is not called. GROWTH_ASK=1 may rescore titles later, and only on Workers AI or Groq.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as c from '../void-live-deploy/lib/idea-core.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => { try { return readFileSync(resolve(root, p), 'utf8'); } catch { return ''; } };

export const ENGINES = Object.freeze([
  { id: 'idea-core', role: 'the daily tournament' },
  { id: 'capability-sweep', role: 'failed and partial jobs become seeds' },
  { id: 'gaps', role: 'open rows of the gaps list become seeds' },
  { id: 'stranger', role: 'a pick ships only after the stranger test' },
  { id: 'grow-self', role: 'still proves skills that already answer; it does not pick new ideas' },
  { id: 'next-tool', role: 'reports this board\'s top pick instead of choosing its own' },
  { id: 'side-by-side', role: 'the owner Tower page stays; it is not what chooses the next build' },
  { id: 'live-revert', role: 'the repair lever rolls a bad deploy back through the existing path' },
]);

/** the lists the tournament reads. Pure aside from the files it is handed. */
export function listsFrom({ skills = [], pages = [], games = [] } = {}) {
  return {
    skill: skills.map((name) => ({ id: name, name: name.replace(/-/g, ' '), family: '' })),
    page: pages.map((p) => ({ id: p, name: p.replace(/\//g, ' ').trim(), path: p })),
    game: games.map((id) => ({ id, name: id.replace(/-/g, ' '), family: 'games' })),
  };
}

const slim = (p) => ({
  slug: p.slug, gen: p.gen, title: p.title, total: p.total, wins: p.wins, targets: p.targets || [],
  scores: p.scores, from: p.from || '', share: c.shareOf(p), blocks: [],
});

/** one day's board from already-loaded inputs. Pure. */
export function boardOf({ lists, gaps = '', sweep = [], misses = [], board = {}, used = [], signals = [], fixes = [], health = null, at = new Date().toISOString(), day } = {}) {
  const inv = c.inventory(lists);
  const seeds = [...c.gapSeeds(gaps), ...c.sweepSeeds(sweep)];
  const sig = c.signals({ misses }, inv.items);
  const when = day || String(at).slice(0, 10);
  const prev = board.history || {};
  const rate = c.gateRate(prev);
  const n = c.pickCount(rate);
  const gen = c.generate(inv, sig, { day: when, seeds, per: 8 });
  const { keep, dropped } = c.dedupe(gen, inv, { board: { history: prev } });
  const weights = c.learn(prev);
  const ranked = c.tournament(keep.map((x) => c.score(x, weights)));
  const chosen = c.picks(ranked, n);
  const blocks = c.blocksOf(inv);
  const history = c.measure(prev, used);
  for (const p of chosen) if (!history[p.slug] || history[p.slug].status === 'idea') history[p.slug] = { gen: p.gen, status: 'picked', picked: at, gate: 'waiting' };
  const feedback = (signals || []).map((s) => ({ id: s.id, ...c.weakAnswer(s) })).filter((x) => x.weak);
  const regressions = (fixes || []).map(c.regressionRow).filter(Boolean);
  const repair = c.repairJob(health);
  const picks = chosen.map((p) => ({ ...slim(p), blocks: c.matchBlocks(p.title, blocks), want: c.wantOf(p), gate: { waiting: true, pass: null, say: 'Recorded. Ships only after the stranger test.' } }));
  return {
    at, day: when, passRate: rate, n, dropped,
    picks, ranked: ranked.slice(0, 8).map(slim),
    topics: sig.wanted, blocks: blocks.slice(0, 40),
    feedback, regressions, repair,
    levers: {
      feedback: { ran: feedback.length, effect: feedback.length ? feedback.length + ' weak answer types to improve' : 'no weak signals in this run' },
      blocks: { ran: blocks.length, effect: blocks.length + ' skills and pages later builds can call' },
      repair: { ran: repair.action === 'rollback' ? 1 : 0, effect: repair.action === 'rollback' ? 'a rollback job is ready' : 'health did not ask for a rollback' },
      share: { ran: picks.length, effect: picks.length ? picks.length + ' share cards' : 'no pick to share' },
      regression: { ran: regressions.length, effect: regressions.length ? regressions.length + ' regression rows' : 'no new fix in this run' },
    },
    engines: ENGINES,
    cost: { runner: 'actions', minutes: 2, paidCents: 0, model: '', note: 'No model call. GitHub Actions on a public repo is not billed. The minutes are still recorded.' },
    history,
  };
}

function repoLists() {
  const skills = readdirSync(resolve(root, 'void-live-deploy/skills')).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
  const pages = [];
  for (const name of readdirSync(resolve(root, 'void-live-deploy'))) {
    if (name.startsWith('.') || name === 'skills' || name === 'lib' || name === 'functions') continue;
    if (existsSync(resolve(root, 'void-live-deploy', name, 'index.html'))) pages.push('/' + name + '/');
  }
  let games = [];
  try { games = Object.keys(JSON.parse(read('data/game-manifest.json')).games || {}); } catch { games = []; }
  return listsFrom({ skills, pages, games });
}

function main() {
  const write = process.argv.includes('--write');
  let prev = {};
  try { prev = JSON.parse(read('void-live-deploy/tower.ideas.json')); } catch { prev = {}; }
  let sweep = [];
  try { sweep = JSON.parse(read('tools/capability-sweep/results.json')).items || []; } catch { sweep = []; }
  const board = boardOf({ lists: repoLists(), gaps: read('docs/GAPS.md'), sweep, board: prev, at: new Date().toISOString() });
  const pub = { at: board.at, passRate: board.passRate, n: board.n, picks: board.picks.map((p) => ({ title: p.share.title, path: p.share.path, score: p.share.score, page: (p.targets || [])[0] || '' })), cost: board.cost, levers: board.levers };
  const saved = {
    at: board.at, day: board.day, passRate: board.passRate, n: board.n, dropped: board.dropped,
    picks: board.picks.map((p) => ({ slug: p.slug, gen: p.gen, title: p.title, total: p.total, wins: p.wins, targets: p.targets, scores: p.scores, share: p.share, gate: p.gate })),
    ranked: board.ranked.map((p) => ({ slug: p.slug, title: p.title, total: p.total, wins: p.wins, gen: p.gen })),
    topics: board.topics, feedback: board.feedback, regressions: board.regressions, repair: board.repair,
    levers: board.levers, engines: board.engines, cost: board.cost, history: board.history,
  };
  console.log(board.picks.map((p) => p.total + '  ' + p.title).join('\n') || '(no pick)');
  console.log('pass rate ' + (board.passRate == null ? 'none yet' : board.passRate) + ', building ' + board.n + ', cost ' + board.cost.paidCents + ' cents');
  if (!write) return;
  writeFileSync(resolve(root, 'void-live-deploy/tower.ideas.json'), JSON.stringify(saved) + '\n');
  writeFileSync(resolve(root, 'void-live-deploy/idea-ids.json'), JSON.stringify({ note: 'slugs the use counter accepts', ids: Object.keys(board.history) }) + '\n');
  mkdirSync(resolve(root, 'void-live-deploy/growth'), { recursive: true });
  writeFileSync(resolve(root, 'void-live-deploy/growth/latest.json'), JSON.stringify(pub) + '\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
