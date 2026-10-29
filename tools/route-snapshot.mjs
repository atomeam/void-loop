// Where every ask lands, by skill (a family's member counts as itself): every listed skill's examples and near misses, every
// family member's, plus every ask in tools/bench.json. Run before and after a skill merge; --compare says which asks moved.
// A merge may move nothing that used to land on its want (convergence rule: no new misses).
//   node tools/route-snapshot.mjs --out /tmp/before.json
//   node tools/route-snapshot.mjs --compare /tmp/before.json      exit 1 when an ask that landed right now lands wrong
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'void-live-deploy/skills');

/** landing for one ask: the member name of the first skill whose match says yes, or null. Pure. */
export function landing(mods, ask) {
  const lower = ask.toLowerCase(), k = mods.find((s) => { try { return s.match(lower, ask); } catch (_) { return false; } });
  return k ? (k.part ? k.part(lower, ask) || k.name : k.name) : null;
}
export async function snapshot() {
  const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
  const mods = [];
  for (const n of names) mods.push((await import(pathToFileURL(resolve(dir, n + '.js')).href)).default);
  const asks = new Map(); // ask -> want (skill name, or '!name' for a near miss)
  const add = (a, w) => { if (typeof a === 'string' && !asks.has(a)) asks.set(a, w); };
  for (const m of mods) for (const s of m.family ? m.members || [] : [m]) {
    for (const e of s.examples || []) add(e, s.name);
    for (const e of s.nearMisses || []) add(e, '!' + s.name);
  }
  for (const x of JSON.parse(readFileSync(resolve(root, 'tools/bench.json'), 'utf8'))) if (!x.before) add(x.ask, String(x.want));
  const out = {};
  for (const [a, w] of asks) out[a] = { want: w, got: landing(mods, a) };
  return out;
}
/** is `got` right for `want`? want is a skill name, '!name' (must not land there) or a bench want ("skill:weather|calc"). Pure. */
export function right(want, got) {
  if (want.startsWith('!')) return got !== want.slice(1);
  return want.split('|').some((w) => { const k = w.replace(/^skill:/, '').split(':')[0]; return k === 'answer' ? got === null : k === got; });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), snap = await snapshot();
  const vals = Object.values(snap), ok = vals.filter((v) => right(v.want, v.got)).length;
  if (a.includes('--out')) writeFileSync(a[a.indexOf('--out') + 1], JSON.stringify(snap, null, 1));
  console.log(`${ok}/${vals.length} asks land right`);
  if (a.includes('--compare')) {
    const before = JSON.parse(readFileSync(a[a.indexOf('--compare') + 1], 'utf8'));
    const worse = [], moved = [];
    for (const [ask, b] of Object.entries(before)) { const n = snap[ask]; if (!n) continue;
      if (n.got !== b.got) moved.push(`${ask}: ${b.got} -> ${n.got}`);
      if (right(b.want, b.got) && !right(n.want, n.got)) worse.push(`${ask}: ${b.got} -> ${n.got} (want ${b.want})`); }
    console.log(`${moved.length} moved, ${worse.length} new misses`); for (const l of worse) console.log('  miss: ' + l);
    if (a.includes('--moved')) for (const l of moved) console.log('  moved: ' + l);
    process.exit(worse.length ? 1 : 0);
  }
}
