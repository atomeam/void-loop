// Void's facts about itself, for the answer engine (void-live-deploy/lib/self-context.js): what it is (llms.txt), and the
// growth inbox (domains/growth-inbox.md: what shipped, what is still open), its games and the cards that have a 3D miniature
// (so its opinions of itself are informed: lib/voice.js), and for the growth tree the think tank's open tracks, the claim
// being built now (domains/forethinkers/index.md, domains/void.frontier.md) and the last commits on main (git log). Skills, the will and its reflections are read live at answer time.
// Writes void-live-deploy/self.json. The deploy workflow runs this before every deploy, so the file never goes stale there.
//   node tools/self-context.mjs          write the file
//   node tools/self-context.mjs --check  exit 1 if the committed file differs from what would be written
import { openItems } from './frontier.mjs';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'void-live-deploy/self.json');
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// skills that are games Void plays with you (names as in skills/index.json)
export const GAMES = ['tictactoe', 'othello', 'mancala', 'checkers', 'chess', 'aggravation', 'go', 'monopoly', 'battleship', 'poker', 'fireworks', 'connect4'];

// domains/void.canon.md: Adam's words about what Void is (motto, VoidQuest) and Void's terms for its parts, versioned;
// '(not written yet)' stays unknown
export function readCanon(text) {
  const t = String(text || ''), sec = (h) => clip((new RegExp('^## ' + h + '\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm').exec(t) || [])[1], 600);
  const known = (v) => (v && !/^\(not written yet\)$/i.test(v) ? v : null);
  // terms: '- **name**: what it is' lines under ## Terms (Void's names for its own parts); left out when there are none
  const terms = [...String((new RegExp('^## Terms\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))', 'm').exec(t) || [])[1] || '').matchAll(/^- \*\*(.+?)\*\*:\s*(.+)$/gm)]
    .map((m) => ({ term: m[1].trim().slice(0, 60), means: clip(m[2], 400) })).slice(0, 20);
  return { version: +((/^version:\s*(\d+)/m.exec(t) || [])[1] || 0), motto: known(sec('Motto')), voidquest: known(sec('VoidQuest')), ...(terms.length ? { terms } : {}) };
}

// domains/forethinkers/index.md: the think tank's open tracks (name, when last advanced), drawn as faint branches on the
// growth tree (frontier #3) because they are not grown yet
export function readTracks(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 3 || /^-+$/.test(c[0]) || c[0] === 'Track') continue;
    const last = (/Last advanced (\d{4}-\d\d-\d\d)/.exec(c[2]) || /(\d{4}-\d\d-\d\d)/.exec(c[2]) || [])[1] || '';
    out.push({ name: clip(c[0], 60), last });
  }
  return out;
}

// domains/void.frontier.md: the claim being built now, the newest claim line (by when the line was last written, from
// git blame where history is there; the latest date on the line, then the lowest line, otherwise). Glows on the tree.
export function readBuilding(text, lineTimes = {}) {
  let best = null, item = '';
  String(text || '').split('\n').forEach((line, i) => {
    const h = /^##\s+(?:\d+\.\s+)?(.+)$/.exec(line); if (h) item = clip(h[1], 80);
    const m = /^\s*-?\s*\*\*claim[^*]*:\*\*\s*(\S[^:]*?)\s(\d{4}-\d\d-\d\d):\s*(.+)$/.exec(line);
    if (!m || /^\W*(?:done|closed)\b/i.test(m[3])) return; // a finished item is not being built
    const at = lineTimes[i + 1] || m[2] + 'T00:00:00Z', key = at + '|' + String(i).padStart(6, '0');
    if (!best || key > best.key) best = { key, at, date: m[2], by: clip(m[1], 40), item: item.replace(/[`*]/g, ''), what: clip(m[3].replace(/[`*]/g, ''), 220) };
  });
  if (!best) return null;
  const { key, ...b } = best; return b;
}

// the last commits on main (git log --no-merges --format=%cI%x09%s), newest first: the growth tree's new leaves, each read by
// touching it. Merge commits are skipped (their subject only names a branch); a subject is clipped and keeps no Markdown.
export function readCommits(log, n = 20) {
  return String(log || '').split('\n').map((l) => l.split('\t')).filter(([at, subject]) => at && subject && !isNaN(Date.parse(at)))
    .slice(0, n).map(([at, subject]) => ({ at: new Date(Date.parse(at)).toISOString().replace('.000', ''), subject: clip(subject.replace(/[`*]/g, ''), 140) }));
}

export function buildSelf(llms, inbox, { skills = [], minis = [], canon = null, tracks = null, building = null, commits = null, open = null } = {}) {
  const about = clip((/^>\s*(.+)$/m.exec(llms) || [])[1], 300);
  const rows = [];
  for (const line of inbox.split('\n')) {
    const c = line.split('|').slice(1, -1).map((x) => x.trim());
    if (c.length < 4 || c[0] === 'status' || /^-+$/.test(c[0])) continue;
    const [status, date, ask, source] = c;
    const shipped = /^shipped\b/i.test(status);
    // the note in brackets is for agents (corrections, checks); the public line keeps only the source's first clause
    rows.push({ state: shipped ? 'shipped' : clip(status.split(/\s/)[0], 20).toLowerCase(), date: clip(date, 10), ask: clip(ask, 120), from: clip(source.replace(/\s*\(.*$/, ''), 120) });
  }
  return {
    about, shipped: rows.filter((r) => r.state === 'shipped'),
    // what is still open comes from the frontier, the one build order (cleanup step 4); the inbox keeps the shipped history
    open: open ? open.map((o) => ({ state: 'open', date: '', ask: clip(o.title, 120), from: clip(o.from, 120) })) : rows.filter((r) => r.state !== 'shipped'),
    games: GAMES.filter((g) => skills.includes(g)), minis: minis.filter((m) => m !== 'sample').sort(),
    ...(canon ? { canon } : {}),
    ...(tracks ? { tracks } : {}),
    ...(building ? { building } : {}),
    ...(commits && commits.length ? { commits } : {}),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const skills = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8'));
  const minis = readdirSync(resolve(root, 'void-live-deploy/skills/mini')).filter((f) => /^[a-z0-9-]+\.js$/.test(f)).map((f) => f.slice(0, -3));
  const frontier = resolve(root, 'domains/void.frontier.md'), tank = resolve(root, 'domains/forethinkers/index.md');
  const lineTimes = {}; // when each frontier line was last written; empty without git history (then the dates on the lines decide)
  const blame = spawnSync('git', ['blame', '--line-porcelain', '--', 'domains/void.frontier.md'], { cwd: root, encoding: 'utf8', timeout: 20000 });
  if (blame.status === 0) { let t = 0; for (const l of blame.stdout.split('\n')) { const h = /^[0-9a-f]{40} \d+ (\d+)/.exec(l); if (h) lineTimes.next = +h[1]; const c = /^committer-time (\d+)/.exec(l); if (c) t = +c[1]; if (l.startsWith('\t')) { lineTimes[lineTimes.next] = new Date(t * 1000).toISOString().replace('.000', ''); } } delete lineTimes.next; }
  const self = buildSelf(readFileSync(resolve(root, 'void-live-deploy/llms.txt'), 'utf8'), readFileSync(resolve(root, 'domains/growth-inbox.md'), 'utf8'), { skills, minis, canon: existsSync(resolve(root, 'domains/void.canon.md')) ? readCanon(readFileSync(resolve(root, 'domains/void.canon.md'), 'utf8')) : null,
    tracks: existsSync(tank) ? readTracks(readFileSync(tank, 'utf8')) : null, building: existsSync(frontier) ? readBuilding(readFileSync(frontier, 'utf8'), lineTimes) : null,
    open: existsSync(frontier) ? openItems(readFileSync(frontier, 'utf8')) : null,
    commits: readCommits(spawnSync('git', ['log', '--no-merges', '-20', '--format=%cI%x09%s', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 20000 }).stdout) });
  const text = JSON.stringify(self, null, 1) + '\n';
  if (process.argv.includes('--check')) {
    const same = existsSync(out) && readFileSync(out, 'utf8') === text;
    console.log(same ? 'self.json up to date' : 'self.json is stale: run node tools/self-context.mjs');
    process.exit(same ? 0 : 1);
  }
  writeFileSync(out, text);
  console.log(`self.json: ${self.shipped.length} shipped, ${self.open.length} open, ${self.games.length} games, ${self.minis.length} miniatures`);
}
