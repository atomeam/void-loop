// The skill builder's hands: search the skills Verse already has, call them, stamp `builtWith` on a new file.
//   node tools/skill-compose.mjs --ask "split a 90 mile drive costing 36 dollars between 3 people" --json
//   node tools/skill-compose.mjs --ask "..." --stamp void-live-deploy/skills/<name>.js
// The will (tools/will.py), the conductor and the new-skill lane (tools/build-miss.mjs, tools/new-skill.mjs) call this.
// Tower does not write skill files (tools/tower-self.mjs); the same command is what a tower lane runs when it does.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compose, probeFor, stampBuiltWith, builtWithOf, invokeModule } from '../void-live-deploy/lib/skill-compose.js';
import { writeLineage } from './skills-index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = resolve(root, 'void-live-deploy', 'skills');
const toolsDir = resolve(root, 'tools');

const quoted = (block) => [...String(block || '').matchAll(/'([^'\\]{1,120})'|"([^"\\]{1,120})"/g)].map((m) => m[1] || m[2]);

/** one catalog row from a skill's source and its test file. Pure. */
export function rowOf(name, src, testSrc = '') {
  const ex = /examples:\s*\[([\s\S]*?)\]/.exec(src || '');
  const about = ((/^\s*\/\*\*?([\s\S]*?)\*\//.exec(src || '') || [])[1] || '').replace(/^\s*\*\s?/gm, ' ');
  const tools = [];
  if (/export function evaluateMath\b|export function expressionOf\b/.test(src || '')) tools.push('sum');
  if (/export function pairOf\b|export \{[^}]*\bpairOf\b/.test(src || '')) tools.push('units');
  if (name === 'fetch' || /\bfetch skill\b/i.test(about)) tools.push('fetch');
  return { name, about, examples: ex ? quoted(ex[1]) : [], tests: quoted(testSrc).slice(0, 12), tools };
}

/** every skill in skills/index.json, with its header, examples and test strings. */
export function readCatalog(dir = skillsDir, tdir = toolsDir) {
  const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
  const out = [];
  for (const name of names) {
    let src = '';
    try { src = readFileSync(resolve(dir, name + '.js'), 'utf8'); } catch (_) { continue; }
    let testSrc = '';
    try { testSrc = readFileSync(resolve(tdir, name + '.test.mjs'), 'utf8'); } catch (_) { /* a skill with no unit file still counts */ }
    out.push(rowOf(name, src, testSrc));
  }
  return out;
}

/** search and call. invoke defaults to loading the skill and running it (MCP's runSkill, then its pure maths). */
export async function composeAsk(ask, { catalog, invoke, limit = 3, run, dir = skillsDir } = {}) {
  const rows = catalog || readCatalog(dir);
  const call = invoke || (async (skill) => {
    const mod = await import(pathToFileURL(resolve(dir, skill.name + '.js')).href);
    return invokeModule(mod, probeFor(skill, ask), run ? { run } : {});
  });
  return compose(ask, { catalog: rows, invoke: call, limit });
}

/** write builtWith onto a scaffold when a searched skill answered, then refresh skills/lineage.json. */
export async function stampFile(file, ask, opts = {}) {
  const src = readFileSync(file, 'utf8');
  const made = await composeAsk(ask, opts);
  if (made.parts.length) writeFileSync(file, stampBuiltWith(src, made.parts));
  writeLineage();
  return { ...made, builtWith: builtWithOf(readFileSync(file, 'utf8')) };
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : '';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ask = arg('--ask');
  if (!ask) { console.error('usage: node tools/skill-compose.mjs --ask "..." [--json] [--stamp <file>]'); process.exit(2); }
  const file = arg('--stamp');
  const made = file && existsSync(file) ? await stampFile(file, ask) : await composeAsk(ask);
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ask: made.ask, found: made.found, parts: made.parts, calls: made.calls.map((c) => ({ name: c.name, ok: !!c.ok, via: c.via || '' })), examples: made.examples }));
  else console.log((made.parts.length ? 'built with ' + made.parts.join(', ') : 'no skill answered') + (made.found.length ? ' (searched ' + made.found.join(', ') + ')' : ''));
}
