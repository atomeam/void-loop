// The lap loop's inventory (owner, 2026-10-22: "apply the lap loop to everything we have"). Every item a lap goes around: each skill,
// the named surfaces (games, cards, the book, the store, films, the podcast, Mind Field, Tilt Arena, the loop itself), every doc, every
// archived repo (its reusable parts), every check and tool, every business plan in domains/ and the Forethinkers research (plan upgrades:
// one concrete improvement each per lap, no external actions). Each item carries facts (counts only) so a lap records before and after
// and can prove the item got measurably better. Writes void-live-deploy/lap.items.json (served publicly: names and counts, nothing private).
//   node tools/lap-items.mjs           print the counts by group
//   node tools/lap-items.mjs --write   write the file
import { scan as handoffScan } from './handoff-scan.mjs';
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

// "a-to-mind should be the only website you need" (owner, 2026-10-22): popular site categories, most used first, each with the Verse
// skills that cover it. Status from facts only: missing (no skill), partial (one skill, or none of them tested), replaced (two or more
// skills and at least one tested). Category labels, never brand names. Each lap shrinks missing and upgrades partial.
export const SITE_CATEGORIES = [
  ['search', /^(search|find|ask|answer|wiki)/], ['video', /^(video|film|movie)/], ['social', /^(social|feed)/], ['email', /^(mail|inbox|email)/],
  ['shopping', /^(store|shop)/], ['news', /^news/], ['maps', /^(map|minimap|where)/], ['weather', /^weather/], ['music', /^(music|loop|song)/],
  ['chat', /^(chat|talk|voice)/], ['docs and notes', /^(note|notebook|notepad|outline|doc)/], ['translate', /^translat/], ['calendar', /^calendar/],
  ['photos', /^(photo|image|stage-image)/], ['games', /^(games?|game-)/], ['finance', /^(markets?|loan|stock|bank)/], ['sports', /^sport/],
  ['recipes', /^recipe/], ['calculator', /^(calc|date-calc)/], ['timer and clock', /^(timer|clock|alarm)/], ['learning', /^(learn|teach|quiz)/],
  ['podcasts', /^podcast/], ['travel', /^(travel|flight|trip)/], ['jobs', /^(job|resume)/],
];
// "replaced" is a claim that Verse beats the category's best site, so it is the tower's to make, never a skill count's (2026-10-28: video
// read "replaced" from two skills and a test while YouTube's floor stood at 6 of 20): a category is replaced only when its tower floor
// (lib/tower.js, the same id, or the floors named in FLOOR_OF) is beaten by the gate; with skills it is partial, without them missing.
export const FLOOR_OF = { 'timer and clock': ['stopwatch'] };
export function onlySite(skills, tests, beaten = new Set()) {
  return SITE_CATEGORIES.map(([name, re], rank) => {
    const by = skills.filter((s) => re.test(s)), tested = by.filter((s) => tests.some((t) => t.includes(s))).length;
    const floors = FLOOR_OF[name] || [name], won = floors.every((id) => beaten.has(id));
    return { category: name, rank: rank + 1, status: !by.length ? 'missing' : won && tested ? 'replaced' : 'partial', skills: by, tested, floors, ...(won ? {} : { beaten: false }) };
  });
}
/** the tower floors the gate has beaten, from the evidence file (an empty set when the file is unreadable: nothing is claimed). */
export async function beatenFloors() {
  try { const { tower } = await import('../void-live-deploy/lib/tower.js'); const ev = JSON.parse(rd('void-live-deploy/tower.evidence.json') || '{}');
    return new Set(tower([], ev.floors || {}).floors.filter((f) => f.state === 'beaten').map((f) => f.id)); } catch (_) { return new Set(); }
}
export const onlySiteCounts = (rows) => ({ replaced: rows.filter((r) => r.status === 'replaced').length, partial: rows.filter((r) => r.status === 'partial').length, missing: rows.filter((r) => r.status === 'missing').length, categories: rows.length });

export function inventory(beaten = new Set()) {
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
  for (const r of onlySite(skills, tests, beaten)) items.push({ id: 'site:' + r.category, group: 'site', facts: { skills: r.skills.length, tested: r.tested, covered: r.status === 'missing' ? 0 : r.status === 'partial' ? 1 : 2 } });
  // every page does its own job (tools/real-pages.mjs; owner, 2026-10-28: pages are real, never pretend): the pages it covers, the
  // pages that say honestly on the page what needs a partner ([data-honest]), and the size of its specs. A lap raises the specs' depth.
  { const pages = walk('void-live-deploy').filter((f) => /(^|\/)index\.html$/.test(f) && !/node_modules/.test(f)); items.push({ id: 'loop:real-pages', group: 'loop', facts: { pages: pages.length, honestLabels: pages.filter((f) => /data-honest/.test(rd(f))).length, specLines: lines(rd('tools/real-pages.mjs')), inChecks: /real-pages\.mjs/.test(rd('tools/checks.mjs')) ? 1 : 0 } }); }
  // page-to-page connections (owner, 2026-10-28: keep finding connections we haven't considered): every page's inputs and outputs,
  // the connections not built yet ranked by usefulness (docs/HANDOFF-GAPS.md, tools/handoff-scan.mjs). A lap builds the top few and plays
  // each end to end (tools/handoff-e2e.mjs). Facts that only rise: connections built, pages with their own tag, journeys played.
  { const s = handoffScan(); items.push({ id: 'loop:handoffs', group: 'loop', facts: { built: s.built.length, declared: s.pages.filter((p) => p.declared).length, journeys: (rd('tools/handoff-e2e.mjs').match(/^  '[^']+': async/gm) || []).length } }); }
  items.push({ id: 'loop:meta', group: 'loop', facts: { lapTests: tests.includes('lap.test.mjs') ? 1 : 0, checks: (rd('tools/checks.mjs').match(/name:/g) || []).length } });
  return items;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const beaten = await beatenFloors(), items = inventory(beaten), by = {}; for (const i of items) by[i.group] = (by[i.group] || 0) + 1;
  console.log(items.length + ' items: ' + Object.entries(by).map(([g, n]) => g + ' ' + n).join(', '));
  if (process.argv.includes('--write')) { const tests = ls('tools').filter((f) => /\.test\.mjs$/.test(f)), sk = ls('void-live-deploy/skills').filter((f) => /\.js$/.test(f)).map((f) => f.replace(/\.js$/, '')), only = onlySite(sk, tests, beaten);
    fs.writeFileSync(path.join(root, 'void-live-deploy', 'lap.items.json'), JSON.stringify({ items, onlySite: only, onlySiteCounts: onlySiteCounts(only) }) + '\n');
    console.log('only site you need: ' + JSON.stringify(onlySiteCounts(only)) + ' · missing: ' + only.filter((r) => r.status === 'missing').map((r) => r.category).join(', ')); }
}
