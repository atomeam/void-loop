// The Versus card's plan (owner, 2026-10-28: "meanwhile we can move backwards to easier sites"; the card must show the honest surpassed count,
// what is being worked on now, the next few easiest sites and the far-future floors that are not beaten, generated from docs/NEXT.md and the
// gate data, never hardcoded). The order lives in one place, the `<!-- tower-plan -->` block at the head of docs/NEXT.md; this script reads
// it, checks every id is a real tower floor, and writes void-live-deploy/tower.plan.json. The card (skills/tower.js) joins each id with the
// gate's own numbers (lib/tower.js tower()), so the JSON carries only the order and the reasons, never a score or a "beaten".
//
//   node tools/tower-plan.mjs           write void-live-deploy/tower.plan.json
//   node tools/tower-plan.mjs --check   exit 1 when the JSON is stale or an id is not a floor (refresh.mjs and checks.mjs run this)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(root, 'void-live-deploy');
export const OUT = path.join(SITE, 'tower.plan.json');
const KINDS = ['now', 'next', 'far', 'skipped'];

/** the plan from the NEXT.md text: { now: [{id, why}], next: [...], far: [...], skipped: [{site, why}] }. Pure; throws on a malformed block. */
export function parsePlan(md) {
  const m = String(md).match(/<!--\s*tower-plan\b[^>]*-->([\s\S]*?)<!--\s*\/tower-plan\s*-->/);
  if (!m) throw new Error('docs/NEXT.md has no <!-- tower-plan --> block');
  const plan = { now: [], next: [], far: [], skipped: [] };
  for (const line of m[1].split('\n')) {
    const l = line.match(/^\s*-\s*(now|next|far|skipped):\s*(.+?)\s*$/);
    if (!l) continue;
    const [, kind, rest] = l;
    if (kind === 'skipped') { const [site, ...why] = rest.split(/\s+—\s+/); plan.skipped.push({ site: site.trim(), why: why.join(' — ').trim() }); continue; }
    const id = rest.match(/^`([^`]+)`\s*(?:—\s*(.*))?$/);
    if (!id) throw new Error('tower-plan line without a `floor id`: ' + line.trim());
    plan[kind].push({ id: id[1], why: (id[2] || '').trim() });
  }
  if (!plan.next.length) throw new Error('the tower-plan block names no next floor');
  return plan;
}

/** the ids that are not floors of the tower, and ids named twice. Pure. */
export function problems(plan, ids) {
  const known = new Set(ids), seen = new Set(), out = [];
  for (const k of KINDS.filter((k) => k !== 'skipped')) for (const { id } of plan[k]) {
    if (!known.has(id)) out.push('not a tower floor: ' + id);
    if (seen.has(id)) out.push('named twice: ' + id);
    seen.add(id);
  }
  return out;
}

export const render = (plan) => JSON.stringify({ _: 'made by tools/tower-plan.mjs from the tower-plan block in docs/NEXT.md; edit that block, not this file. The card joins each id with the gate (lib/tower.js), so nothing here is a score.', source: 'docs/NEXT.md', ...plan }, null, 1) + '\n';

async function floorIds() {
  const { tower } = await import(path.join(SITE, 'lib/tower.js'));
  const rd = (f) => { try { return JSON.parse(fs.readFileSync(path.join(SITE, f), 'utf8')); } catch (_) { return null; } };
  const inv = rd('lap.items.json'), ev = rd('tower.evidence.json'), fr = rd('tower.frontier.json');
  return tower((inv && inv.onlySite) || [], (ev && ev.floors) || {}, fr, (ev && ev.icons) || null).floors.map((f) => f.id);
}

async function main(argv) {
  const plan = parsePlan(fs.readFileSync(path.join(root, 'docs/NEXT.md'), 'utf8'));
  const bad = problems(plan, await floorIds());
  if (bad.length) { console.error('tower plan: ' + bad.join('; ')); return 1; }
  const text = render(plan), now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (argv.includes('--check')) { if (now !== text) { console.error('tower plan: void-live-deploy/tower.plan.json is stale (run node tools/tower-plan.mjs)'); return 1; } console.log('tower plan: current, ' + plan.next.length + ' next'); return 0; }
  if (now !== text) fs.writeFileSync(OUT, text);
  console.log('tower plan: now ' + plan.now.map((x) => x.id).join(', ') + ' · next ' + plan.next.map((x) => x.id).join(', ') + ' · far ' + plan.far.map((x) => x.id).join(', '));
  return 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { console.error('tower plan: ' + e.message); process.exit(1); });
