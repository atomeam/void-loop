// skills/first.json: the asks the page can answer before its skills finish loading. Each key is a known ask (every skill's
// examples, every family member's, the benchmark's and the site tester's asks), lowercased with its spaces collapsed. The file
// is { skill file: [asks it takes] }, the files in routing order (skills/index.json), so each file name is written once. The page loads the skill files a few
// at a time in that order, and an ask waits until every skill ranked above its match has loaded (void.html, firstSkill).
// On a slow or busy device "flip this card" (rank 139) or "favorite this" (rank 278) then showed only "waking up" until the
// tester gave up (#2316, #2323, #2342). With this table the page loads the one skill that takes a known ask at once.
// A phrase is kept only when the routing in node is sure: no skill ranked above its match takes it, and none of them
// throws on it (a skill that throws in node may read the page, so the page could route the ask elsewhere).
//   node tools/first-asks.mjs           write void-live-deploy/skills/first.json
//   node tools/first-asks.mjs --check   exit 1 when the file is stale
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'void-live-deploy/skills');
export const OUT = resolve(dir, 'first.json');

/** the table key for an ask: lowercased, trimmed, inner spaces collapsed. The page uses the same rule. Pure. */
export const firstKey = (ask) => String(ask || '').toLowerCase().trim().replace(/\s+/g, ' ');

/** the file name of the first module that takes the ask, or null when none takes it or a module above it throws. Pure. */
export function sureLanding(mods, names, ask) {
  const lower = ask.toLowerCase();
  for (let i = 0; i < mods.length; i++) {
    let hit;
    try { hit = !!mods[i].match(lower, ask); } catch (_) { return null; }
    if (hit) return names[i];
  }
  return null;
}

/** every known ask, in a stable order: the skills' examples (members included), then bench.json, then site-test.json. */
export function knownAsks(mods) {
  const asks = [], seen = new Set(), add = (a) => { if (typeof a !== 'string' || !a.trim()) return; const k = firstKey(a); if (!seen.has(k)) { seen.add(k); asks.push(a.trim().replace(/\s+/g, ' ')); } };
  for (const m of mods) {
    for (const e of m.examples || []) add(e);
    for (const s of m.members || []) for (const e of s.examples || []) add(e);
  }
  try { for (const x of JSON.parse(readFileSync(resolve(root, 'tools/bench.json'), 'utf8'))) if (x && !x.before) add(x.ask); } catch (_) {}
  try { for (const c of JSON.parse(readFileSync(resolve(root, 'tools/site-test.json'), 'utf8')).cases || []) if (c) add(c.ask); } catch (_) {}
  return asks;
}

export async function build() {
  const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
  const mods = [];
  for (const n of names) mods.push((await import(pathToFileURL(resolve(dir, n + '.js')).href)).default);
  const by = new Map();
  for (const ask of knownAsks(mods)) { const f = sureLanding(mods, names, ask); if (f) { if (!by.has(f)) by.set(f, []); by.get(f).push(firstKey(ask)); } }
  const out = {};
  for (const n of names) if (by.has(n)) out[n] = by.get(n).sort();
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const table = await build(), text = '{\n' + Object.entries(table).map(([f, l]) => ' ' + JSON.stringify(f) + ': ' + JSON.stringify(l)).join(',\n') + '\n}\n';
  const n = Object.values(table).reduce((a, l) => a + l.length, 0);
  if (process.argv.includes('--check')) {
    const now = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
    if (now !== text) { console.error('skills/first.json is stale (' + n + ' asks): run node tools/first-asks.mjs'); process.exit(1); }
    console.log('skills/first.json current: ' + n + ' asks');
  } else {
    writeFileSync(OUT, text);
    console.log('wrote skills/first.json: ' + n + ' asks');
  }
}
