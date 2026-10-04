// Append entries to tools/bench.json or tools/grown.json in their own style (one object per line), so the diff
// shows only the new lines. Each entry is a JSON object; duplicates (same "ask") are refused.
//   node tools/append.mjs bench '{"ask":"split 120 between 4","want":"calc"}' ...
//   node tools/append.mjs grown '{"ask":"…","missed":"2026-10-01","now":"…","expect":"page","text":"…"}'
//   --skip   drop repeats (named on stderr) and add the rest, instead of refusing the whole batch
//   --file c.json   add every entry of a JSON array (e.g. a probe batch for bench.mjs --probe that now passes)
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), skip = args.includes('--skip');
// --file c.json: take the entries from a JSON array (a probe batch that now passes) instead of the command line
const fileAt = args.indexOf('--file'), fromFile = fileAt >= 0 ? JSON.parse(readFileSync(resolve(args[fileAt + 1]), 'utf8')).map((o) => JSON.stringify(o)) : [];
const [which, ...raw0] = args.filter((a, i) => a !== '--skip' && !(fileAt >= 0 && (i === fileAt || i === fileAt + 1)));
const raw = raw0.concat(fromFile);
if (!['bench', 'grown'].includes(which) || !raw.length) {
  console.error('usage: node tools/append.mjs bench|grown \'{"ask":…}\' …');
  process.exit(2);
}
const file = resolve(root, `tools/${which}.json`);
const text = readFileSync(file, 'utf8');
const have = new Set(JSON.parse(text).map((x) => x.ask.toLowerCase()));
// match the file's spacing: {"ask": "…", "want": "…"}
const line = (o) => '  {' + Object.entries(o).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(', ') + '}';
const add = [];
for (const o of raw.map((s) => JSON.parse(s))) {
  if (typeof o.ask !== 'string' || !o.ask) throw new Error('each entry needs "ask"');
  if (which === 'bench' && typeof o.want !== 'string') throw new Error(`"${o.ask}" needs "want"`);
  if (have.has(o.ask.toLowerCase())) {
    if (!skip) throw new Error(`"${o.ask}" is already in ${which}.json (pass --skip to drop repeats)`);
    console.error(`skipped (already in ${which}.json): ${o.ask}`);
    continue;
  }
  have.add(o.ask.toLowerCase());
  add.push(o);
}
if (!add.length) { console.log(`${which}.json: nothing new`); process.exit(0); }
const body = text.trimEnd().replace(/\]$/, '').trimEnd();
writeFileSync(file, body + ',\n' + add.map(line).join(',\n') + '\n]\n');
JSON.parse(readFileSync(file, 'utf8'));
console.log(`${which}.json: +${add.length} (${have.size} total)`);
