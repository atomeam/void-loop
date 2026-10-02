// Append entries to tools/bench.json or tools/grown.json in their own style (one object per line), so the diff
// shows only the new lines. Each entry is a JSON object; duplicates (same "ask") are refused.
//   node tools/append.mjs bench '{"ask":"split 120 between 4","want":"calc"}' ...
//   node tools/append.mjs grown '{"ask":"…","missed":"2026-10-01","now":"…","expect":"page","text":"…"}'
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [which, ...raw] = process.argv.slice(2);
if (!['bench', 'grown'].includes(which) || !raw.length) {
  console.error('usage: node tools/append.mjs bench|grown \'{"ask":…}\' …');
  process.exit(2);
}
const file = resolve(root, `tools/${which}.json`);
const text = readFileSync(file, 'utf8');
const have = new Set(JSON.parse(text).map((x) => x.ask.toLowerCase()));
// match the file's spacing: {"ask": "…", "want": "…"}
const line = (o) => '  {' + Object.entries(o).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(', ') + '}';
const add = raw.map((s) => JSON.parse(s));
for (const o of add) {
  if (typeof o.ask !== 'string' || !o.ask) throw new Error('each entry needs "ask"');
  if (which === 'bench' && typeof o.want !== 'string') throw new Error(`"${o.ask}" needs "want"`);
  if (have.has(o.ask.toLowerCase())) throw new Error(`"${o.ask}" is already in ${which}.json`);
  have.add(o.ask.toLowerCase());
}
const body = text.trimEnd().replace(/\]$/, '').trimEnd();
writeFileSync(file, body + ',\n' + add.map(line).join(',\n') + '\n]\n');
JSON.parse(readFileSync(file, 'utf8'));
console.log(`${which}.json: +${add.length} (${have.size} total)`);
