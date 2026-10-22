// The lap loop's inventory (owner, 2026-10-22: "apply the lap loop to everything we have"). Every item a lap goes around: each skill,
// the named surfaces (games, cards, the book, the store, films, the podcast, Mind Field, Tilt Arena, the loop itself), every doc, every
// archived repo (its reusable parts), every check and tool, every business plan in domains/ and the Forethinkers research (plan upgrades:
// one concrete improvement each per lap, no external actions). Each item carries facts (counts only) so a lap records before and after
// and can prove the item got measurably better. Writes void-live-deploy/lap.items.json (served publicly: names and counts, nothing private).
//   node tools/lap-items.mjs           print the counts by group
//   node tools/lap-items.mjs --write   write the file
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => { try { return fs.readFileSync(path.join(root, p), 'utf8'); } catch (_) { return ''; } };
const ls = (p) => { try { return fs.readdirSync(path.join(root, p)); } catch (_) { return []; } };
const lines = (t) => (t ? t.split('\n').length : 0);
const walk = (p, out = []) => { for (const f of ls(p)) { const q = p + '/' + f; let st; try { st = fs.statSync(path.join(root, q)); } catch (_) { continue; } if (st.isDirectory()) { if (!/^(node_modules|\.git)$/.test(f)) walk(q, out); } else out.push(q); } return out; };
const testsOf = (name, tests) => tests.filter((t) => t.includes(name)).length;

export const SURFACES = [
  ['home', /^(home|look|showcase|what-can)/], ['ask', /^(answer|router|ask|route)/],
  ['games', /game|chess|checkers|monopoly|poker|snake|pong|sorry|go\b|othello|mancala|battleship|connect4|ringer|tictactoe|duel|fireworks|aggravation|rally/],
  ['cards', /card|rally|duel|collectible|binder/], ['book', /book/], ['store', /store|shop|gumroad/], ['films', /film|movie|poster|video/],
  ['podcast', /podcast/], ['mind-field', /mind/], ['tilt-arena', /tilt|arena/], ['loop', /will|wants|lap|loop|churn|incident|completeness|persona|expectations/],
];

export function inventory() {
  const tests = ls('tools').filter((f) => /\.test\.mjs$/.test(f));
  const testSrc = tests.map((t) => rd('tools/' + t)).join('\n');
  const skills = ls('void-live-deploy/skills').filter((f) => /\.js$/.test(f) && !/\.test\.js$/.test(f)).map((f) => f.replace(/\.js$/, ''));
  const items = [];
  for (const s of skills) { const src = rd('void-live-deploy/skills/' + s + '.js'); items.push({ id: 'skill:' + s, group: 'skill', facts: { lines: lines(src), examples: (src.match(/examples/g) || []).length, tests: testsOf(s, tests) + (testSrc.split("skills/" + s + ".js").length - 1) } }); }
  for (const [name, re] of SURFACES) { const parts = skills.filter((s) => re.test(s)); items.push({ id: 'surface:' + name, group: 'surface', facts: { skills: parts.length, tests: parts.reduce((n, s) => n + testsOf(s, tests), 0) } }); }
  for (const d of ls('docs').filter((f) => /\.md$/.test(f))) { const t = rd('docs/' + d); items.push({ id: 'doc:' + d, group: 'doc', facts: { lines: lines(t), sections: (t.match(/^#+ /gm) || []).length } }); }
  for (const r of ls('archive/repos')) { const files = walk('archive/repos/' + r); items.push({ id: 'archive:' + r, group: 'archive', facts: { files: files.length, reusedInLive: (rd('docs/MAP.md').split('archive/repos/' + r).length - 1) } }); }
  for (const t of ls('tools').filter((f) => /\.(mjs|py)$/.test(f) && !/\.test\./.test(f))) { const name = t.replace(/\.\w+$/, ''); items.push({ id: 'tool:' + t, group: 'tool', facts: { lines: lines(rd('tools/' + t)), tests: tests.includes(name + '.test.mjs') ? 1 : 0, inChecks: rd('tools/checks.mjs').includes(t) ? 1 : 0 } }); }
  for (const d of ls('domains').filter((f) => /\.md$/.test(f))) { const t = rd('domains/' + d); items.push({ id: 'plan:' + d, group: 'plan', facts: { lines: lines(t), steps: (t.match(/^\s*[-*\d]+[.)]?\s/gm) || []).length } }); }
  for (const f of walk('domains/forethinkers').filter((f) => /\.md$/.test(f))) { const t = rd(f); items.push({ id: 'research:' + f.replace('domains/forethinkers/', ''), group: 'research', facts: { lines: lines(t), steps: (t.match(/^\s*[-*\d]+[.)]?\s/gm) || []).length } }); }
  items.push({ id: 'loop:meta', group: 'loop', facts: { lapTests: tests.includes('lap.test.mjs') ? 1 : 0, checks: (rd('tools/checks.mjs').match(/name:/g) || []).length } });
  return items;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const items = inventory(), by = {}; for (const i of items) by[i.group] = (by[i.group] || 0) + 1;
  console.log(items.length + ' items: ' + Object.entries(by).map(([g, n]) => g + ' ' + n).join(', '));
  if (process.argv.includes('--write')) fs.writeFileSync(path.join(root, 'void-live-deploy', 'lap.items.json'), JSON.stringify({ items }) + '\n');
}
