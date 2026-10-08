// Void's facts about itself, for the answer engine (void-live-deploy/lib/self-context.js): what it is (llms.txt), and the
// growth inbox (domains/growth-inbox.md: what shipped, what is still open), its games and the cards that have a 3D miniature
// (so its opinions of itself are informed: lib/voice.js). Skills, the will and its reflections are read live at answer time.
// Writes void-live-deploy/self.json. The deploy workflow runs this before every deploy, so the file never goes stale there.
//   node tools/self-context.mjs          write the file
//   node tools/self-context.mjs --check  exit 1 if the committed file differs from what would be written
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'void-live-deploy/self.json');
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// skills that are games Void plays with you (names as in skills/index.json)
export const GAMES = ['tictactoe', 'othello', 'mancala', 'checkers', 'chess', 'aggravation', 'go'];

export function buildSelf(llms, inbox, { skills = [], minis = [] } = {}) {
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
    about, shipped: rows.filter((r) => r.state === 'shipped'), open: rows.filter((r) => r.state !== 'shipped'),
    games: GAMES.filter((g) => skills.includes(g)), minis: minis.filter((m) => m !== 'sample').sort(),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const skills = JSON.parse(readFileSync(resolve(root, 'void-live-deploy/skills/index.json'), 'utf8'));
  const minis = readdirSync(resolve(root, 'void-live-deploy/skills/mini')).filter((f) => /^[a-z0-9-]+\.js$/.test(f)).map((f) => f.slice(0, -3));
  const self = buildSelf(readFileSync(resolve(root, 'void-live-deploy/llms.txt'), 'utf8'), readFileSync(resolve(root, 'domains/growth-inbox.md'), 'utf8'), { skills, minis });
  const text = JSON.stringify(self, null, 1) + '\n';
  if (process.argv.includes('--check')) {
    const same = existsSync(out) && readFileSync(out, 'utf8') === text;
    console.log(same ? 'self.json up to date' : 'self.json is stale: run node tools/self-context.mjs');
    process.exit(same ? 0 : 1);
  }
  writeFileSync(out, text);
  console.log(`self.json: ${self.shipped.length} shipped, ${self.open.length} open, ${self.games.length} games, ${self.minis.length} miniatures`);
}
