// The Forge: discovery -> stress -> three mutations -> tournament -> promotion, in one command.
//   node tools/void-evolve.mjs                    one cycle on the least proven skill
//   node tools/void-evolve.mjs --skill throw-off --n 3
//   node tools/void-evolve.mjs --loop 4 --json    run four cycles, each cycle reporting its proposals
//   node tools/void-evolve.mjs --dry              judge candidates, write nothing
//
// This version produces a *candidate patch* and proposes asks for the page to prove: it never banks a
// simulated match, edits a skill file, opens a pull request or spends a token. The champion and its
// proposals are the input to tools/evolve-merge.mjs (with a page probe) and the existing verified lanes
// (Verse review, automerge). Wiring a timer is a separate, deliberately small change. See
// docs/playbooks/void-evolve.md.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readOrder } from './skills-index.mjs';
import { neighbors, generateCorpus } from './evolve-adversary.mjs';
import { mutations, addedChars } from './evolve-mutate.mjs';
import { runTournament } from './evolve-tournament.mjs';
import { load as loadBank, validate as validateBank, regressionRows, rowsOf, BANK_PATH } from './evolve-bank.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..');
const SKILLS = resolve(ROOT, 'void-live-deploy', 'skills');
export const REPORT_PATH = resolve(ROOT, 'domains', 'void.evolve.json');

/** The real page's routing order, loaded the same way tools/skills-check.mjs loads it. */
export async function loadSkills() {
  const mods = [];
  for (const name of readOrder()) {
    const m = (await import(pathToFileURL(resolve(SKILLS, name + '.js')).href)).default;
    if (m && typeof m.name === 'string' && typeof m.match === 'function') mods.push({ name: m.name, examples: Array.isArray(m.examples) ? m.examples.map(String) : [], match: m.match });
  }
  return mods;
}

export const benchCounts = (rows) => {
  const n = new Map();
  for (const r of (Array.isArray(rows) ? rows : [])) {
    for (const p of String((r && r.want) || '').split('|')) {
      const m = /^(?:skill:)?([a-z0-9][a-z0-9-]*)(?:[:/].*)?$/.exec(p.trim());
      if (m) n.set(m[1], (n.get(m[1]) || 0) + 1);
    }
  }
  return n;
};

/** The skill with the least proof: fewest benchmark rows, then fewest examples of its own. Pure. */
export function weakest(skills, bench = []) {
  const counts = benchCounts(bench);
  return [...(Array.isArray(skills) ? skills : [])]
    .filter((s) => s && Array.isArray(s.examples) && s.examples.length > 0)
    .map((s) => ({ skill: s, score: (counts.get(s.name) ? 0 : 100) + Math.max(0, 3 - (counts.get(s.name) || 0)) * 10 + Math.max(0, 5 - s.examples.length) * 10 }))
    .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
    .map((x) => x.skill.name)[0] || null;
}

const safeMatch = (skill, ask) => { try { return !!skill.match(ask.toLowerCase(), ask); } catch (_) { return false; } };
export const baselineRouter = (skills) => (ask) => { const s = (skills || []).find((m) => safeMatch(m, ask)); return s ? s.name : null; };

/** A router with this candidate's patterns applied just before its own skill's matcher. Pure. */
export function routerFor(skills, candidate) {
  const pats = (candidate && Array.isArray(candidate.patterns) ? candidate.patterns : [])
    .map((p) => { try { return new RegExp(p, (candidate.flags || 'i')); } catch (_) { return null; } }).filter(Boolean);
  return (ask) => {
    for (const s of (skills || [])) {
      if (s.name === candidate.skill && pats.some((re) => re.test(ask))) return s.name;
      if (safeMatch(s, ask)) return s.name;
    }
    return null;
  };
}

/** One full cycle. `skills`, `bank` and `cases` can be injected by a test; the CLI supplies the real ones. */
export async function cycle({ skills, bench = [], bank, bankRows, cases, target, n = 3, synthesize = [], threshold, now = new Date().toISOString() } = {}) {
  const list = skills || await loadSkills();
  const chosen = target || weakest(list, bench);
  if (!chosen) return { at: now, target: null, note: 'no skill has enough examples to stress' };
  const near = neighbors(chosen, list, n);
  // readDepth is measured inside the focused set (target first, then its confusers), not across all
  // 393 skills: a mutation is judged on whether it wins against the skills it can be confused with.
  const order = [chosen, ...near.map((s) => s.name)];
  const corpus = cases || generateCorpus([list.find((s) => s.name === chosen), ...near].filter(Boolean), { perExample: 3, cap: 12 })
    .concat((Array.isArray(synthesize) ? synthesize : []).map((ask) => ({ ask: String(ask), want: 'skill:' + chosen, kind: 'synthesized' })));
  const baseline = baselineRouter(list);
  const missed = corpus.filter((c) => c.want === 'skill:' + chosen && baseline(c.ask) !== chosen);
  const candidates = mutations({ name: chosen, missed, cap: 24 }).map((c) => ({ ...c, addedChars: addedChars(c) }));
  const tournament = runTournament({
    routerFor: (c) => routerFor(list, c), baseline, cases: corpus, bank: bankRows || regressionRows(bank || { rows: [] }, bench), order, target: chosen, candidates, threshold,
  });
  const champion = tournament.champion;
  let proposed = [];
  if (champion) {
    const router = routerFor(list, champion.candidate);
    // Proposals, not banked rows: a simulated match is not page proof. evolve-merge.mjs banks only
    // asks that tools/bench.mjs --probe actually answered on the page.
    proposed = missed.filter((c) => router(c.ask) === chosen).map((c) => ({ ask: c.ask, want: c.want }));
  }
  return {
    at: now, target: chosen, neighbors: near.map((s) => s.name), cases: corpus.length, missed: missed.length,
    ranked: tournament.ranked.map((r) => ({ strategy: r.candidate.strategy, note: r.candidate.note, patterns: r.candidate.patterns.length, ...r.result })),
    champion: champion ? { strategy: champion.candidate.strategy, skill: champion.candidate.skill, patterns: champion.candidate.patterns, fitness: champion.result.fitness } : null,
    proposed,
  };
}

/** Append a cycle's report. Reports only grow, like the growth ledger. */
export function record(report, path = REPORT_PATH) {
  const prior = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  const rows = Array.isArray(prior) ? prior : [];
  writeFileSync(path, JSON.stringify(rows.concat(report), null, 1) + '\n');
  return rows.length + 1;
}

const args = process.argv.slice(2);
const opt = (flag) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : ''; };
const dry = args.includes('--dry'), asJson = args.includes('--json');
const bankPath = resolve(ROOT, opt('--bank') || BANK_PATH);
const outPath = resolve(ROOT, opt('--out') || 'domains/void.evolve.json');
const rounds = Math.max(1, Math.min(20, Number(opt('--loop')) || 1));
const targetFlag = opt('--skill'), n = Math.max(1, Math.min(12, Number(opt('--n')) || 3));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let bank;
  try { bank = loadBank(bankPath); } catch (e) { console.error('the Forge bank cannot be read: ' + e.message); process.exit(1); }
  const skills = await loadSkills();
  let bench = [];
  try { bench = rowsOf(JSON.parse(readFileSync(resolve(ROOT, 'tools', 'bench.json'), 'utf8'))); } catch (_) {}
  if (validateBank(bank, bench)) { console.error(validateBank(bank, bench)); process.exit(1); }
  const reports = [];
  for (let i = 0; i < rounds; i++) {
    const report = await cycle({ skills, bench, bank, bankRows: regressionRows(bank, bench), target: targetFlag || undefined, n });
    if (!dry) record(report, outPath);
    reports.push(report);
  }
  if (asJson) console.log(JSON.stringify(rounds === 1 ? reports[0] : reports, null, 2));
  else for (const r of reports) {
    if (!r.target) { console.log('nothing to stress: ' + r.note); continue; }
    console.log(`${r.target}: ${r.missed} missed of ${r.cases} stress asks; ${r.ranked.length} mutations tried; champion ${r.champion ? r.champion.strategy + ' (' + r.champion.fitness + '), proposing ' + r.proposed.length + ' for page proof' : 'none'}`);
    for (const m of r.ranked) console.log('  ' + m.strategy + ' fitness ' + m.fitness + ' accuracy ' + m.accuracy + ' broken ' + m.newlyBroken + ' entropy ' + m.addedChars);
  }
}
