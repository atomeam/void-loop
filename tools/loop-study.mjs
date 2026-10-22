// Study before building (docs/STRATEGY.md competitor parity, docs/playbooks/study-with-rea.md). When the loop picks a want whose
// skill is tagged "parity" in tools/revenue-tags.json, this files an REA study first: passive only (tools/rea-study.mjs runs
// REA's static commands), findings to Verse's private memory only, never committed. Which site does a feature best is the
// owner's private note too: a memory record of kind "best-at" named after the skill, its body the public page. No URL, site
// name or finding is ever written to this repo or printed: the run prints counts. Study, never copy.
//   node tools/loop-study.mjs [--n 6]      file studies for this cycle's parity picks (VOID_OWNER_TOKEN; without it, says so and exits 0)
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { reach } from './lacks.mjs';

/** the picks a study should come before: skills that match a parity pattern. Pure. */
export function parityPicks(picks, tags) {
  const only = { parity: (tags || {}).parity };
  return (picks || []).filter((p) => p && p.name && reach(p.name, only) > 1);
}
/** which studies to file: a parity pick with a private best-at page and no study yet. Pure. */
export function toFile(picks, bestAt, studied) {
  const have = new Set(studied || []);
  return picks.map((p) => ({ skill: p.name, url: (bestAt || {})[p.name] })).filter((x) => x.url && !have.has(x.skill));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), n = +(a[a.indexOf('--n') + 1]) || 6;
  if (!process.env.VOID_OWNER_TOKEN) { console.log('loop-study: no owner token here; nothing filed'); process.exit(0); }
  const { studyMemory, saveStudy } = await import('./rea-study.mjs');
  const { studyRecord, safeUrl } = await import('./rea-study.mjs');
  const { plan, load } = await import('./lacks.mjs');
  const { studyBoosts, buildBrief } = await import('./study-engine.mjs');
  const tags = JSON.parse(readFileSync(new URL('./revenue-tags.json', import.meta.url), 'utf8'));
  // finished studies feed the picker: strong evidence moves that skill's want up (lacks.mjs plan, studyBoost), and each becomes a private want brief
  const done = ((await studyMemory('GET', '?q=studied&limit=100')).memory || []).filter((r) => r.kind === 'study' && /^studied /.test(r.summary || ''));
  const finished = done.map((r) => { const skill = String(r.name).replace(/^Study: how does it do /, ''); const strong = +((/(\d+) endpoints/.exec(r.summary || '') || [])[1] || 0); return { id: r.id, skill, ranked: Array.from({ length: Math.min(5, strong) }, () => ({ confidence: 'high', mechanisms: ['call:fetch'], value: '' })) }; });
  const { picks } = plan({ ...load(), studyBoost: studyBoosts(finished) }, { n });
  const briefed = new Set(((await studyMemory('GET', '?q=study-ready&limit=100')).memory || []).map((r) => r.id)); // write each brief once
  for (const f of finished.filter((x) => !briefed.has('want-' + x.id))) await saveStudy({ id: 'want-' + f.id, kind: 'want', state: '', name: 'Build from study: ' + f.skill, summary: 'study-ready want', links: ['study', 'want'], body: JSON.stringify(buildBrief(f, f.skill)) });
  const par = parityPicks(picks, tags);
  const mem = ((await studyMemory('GET', '?q=best-at&limit=100')).memory || []);
  const bestAt = {}; for (const r of mem) if (r.kind === 'best-at') { const full = (await studyMemory('GET', '?id=' + encodeURIComponent(r.id))).memory || {}; const u = safeUrl(String(full.body || '').trim()); if (u) bestAt[r.name] = u; }
  const studied = ((await studyMemory('GET', '?q=study&limit=100')).memory || []).filter((r) => r.kind === 'study').map((r) => String(r.name).replace(/^Study: how does it do /, ''));
  const go = toFile(par, bestAt, studied);
  for (const g of go) await saveStudy(studyRecord({ url: g.url, question: 'how does it do ' + g.skill }));
  console.log(`loop-study: ${finished.length} finished study(ies) fed to the picker, ${par.length} parity pick(s), ${Object.keys(bestAt).length} best-at note(s), ${go.length} study(ies) filed (findings go to private memory)`);
}
