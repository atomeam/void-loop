// Forge, component D: promotion. A tournament champion is a *candidate patch*, not a merged change.
// This gates it through the repo's own standards before anything is banked or shipped:
//   - a champion must exist, clear the fitness threshold and have zero newly-broken asks;
//   - a pattern may not carry an address, a key, or more than 1000 characters (the entropy cap);
//   - only asks the real page actually answered (a --proof file from tools/bench.mjs --probe) enter
//     the immutable regression bank. A simulated match is a proposal, never a proven row.
// The output is an append-only promotion packet (domains/void.evolve.promotions.json) with a ready PR
// body. It does not push or merge by itself: --pr <num> hands off to tools/automerge.mjs, which only
// labels; GitHub merges after Verse's review and the full suite, exactly like every other PR here.
//   node tools/evolve-merge.mjs                    judge the last report, print the packet
//   node tools/evolve-merge.mjs --proof probe.json --apply   bank the proven asks, record the packet
//   node tools/evolve-merge.mjs --apply --pr 1234  also label PR 1234 for automerge
// Pure core (promote, guardrails); the CLI is the only part that reads or writes files.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadBank, save as saveBank, append as appendBank, validate as validateBank, rowsOf, BANK_PATH } from './evolve-bank.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..');
export const PROMOTIONS_PATH = resolve(ROOT, 'domains', 'void.evolve.promotions.json');
export const CAP = 1000;
const DEFAULT_THRESHOLD = 0.6; // keep this module standalone: it does not import the tournament

const asksOf = (rows) => (Array.isArray(rows) ? rows : []).map((r) => String((r && r.ask) || r || '').trim()).filter(Boolean);
const bad = (s) => /https?:|www\.|[A-Za-z0-9_-]{32,}|[\r\n]/.test(String(s || ''));

/**
 * Turn one cycle report into a promotion packet. Pure. `proof` is the set of asks a real page probe
 * answered correctly; only those become `proven` (and only proven asks may enter the bank).
 */
export function promote(report, { proof = [], threshold = DEFAULT_THRESHOLD, now = new Date().toISOString() } = {}) {
  const why = [];
  const champion = report && report.champion;
  if (!champion) why.push('the tournament found no champion');
  const top = (report && report.ranked || [])[0];
  if (top && top.newlyBroken > 0) why.push(`the winner newly breaks ${top.newlyBroken} banked ask(s)`);
  if (champion && typeof champion.fitness === 'number' && champion.fitness < threshold) why.push(`fitness ${champion.fitness} is below ${threshold}`);
  const patterns = champion && Array.isArray(champion.patterns) ? champion.patterns : [];
  if (champion && (!patterns.length || patterns.length > 24)) why.push('the champion has no patterns or more than 24');
  for (const p of patterns) if (bad(p)) why.push('a pattern carries an address, a key or a line break');
  if (patterns.reduce((n, p) => n + String(p).length, 0) > CAP) why.push(`the patch exceeds the ${CAP}-character entropy cap`);

  const proposed = asksOf(report && report.proposed);
  const provenAsks = new Set(asksOf(proof).map((a) => a.toLowerCase()));
  const proven = proposed.filter((a) => provenAsks.has(a.toLowerCase()));
  const packet = {
    at: now, skill: (champion && champion.skill) || (report && report.target) || '',
    strategy: (champion && champion.strategy) || '', fitness: (champion && champion.fitness) || 0,
    patterns, flags: 'i', proposed, proven, ok: why.length === 0, why,
    prBody: '',
  };
  const rows = proven.map((ask) => ({ ask, want: 'skill:' + packet.skill }));
  packet.prBody = [
    `Forge: ${packet.skill} — ${packet.strategy} champion (fitness ${packet.fitness})`,
    '',
    'The adversarial tournament tried three mutations on near-miss, colloquial, multi-intent and boundary asks. ' +
      'The winner clears the regression bank, the entropy cap and the turn/read kill switches.',
    '',
    `- Patterns: \`${patterns.join('`, `')}\``,
    `- Proposed asks: ${proposed.length}; page-proven and banked: ${proven.length}`,
    '',
    'Test: node --test tools/evolve-*.test.mjs tools/void-evolve.test.mjs',
  ].join('\n');
  return { packet, rows };
}

/** Append a promotion packet. Records only grow, like the growth ledger. Pure. */
export function record(packet, path = PROMOTIONS_PATH) {
  const prior = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  const rows = Array.isArray(prior) ? prior : [];
  writeFileSync(path, JSON.stringify(rows.concat(packet), null, 1) + '\n');
  return rows.length + 1;
}

const args = process.argv.slice(2);
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opt = (flag) => { const i = args.indexOf(flag); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
  const apply = args.includes('--apply'), pr = opt('--pr');
  const reportPath = resolve(ROOT, opt('--report') || 'domains/void.evolve.json');
  const proofPath = opt('--proof') ? resolve(ROOT, opt('--proof')) : '';
  if (!existsSync(reportPath)) { console.error('no Forge report yet: run node tools/void-evolve.mjs first'); process.exit(1); }
  const reports = JSON.parse(readFileSync(reportPath, 'utf8'));
  const report = Array.isArray(reports) ? reports[reports.length - 1] : reports;
  let proof = [];
  if (proofPath) { try { proof = JSON.parse(readFileSync(proofPath, 'utf8')); } catch (e) { console.error('proof file unreadable: ' + e.message); process.exit(1); } }
  const { packet, rows } = promote(report, { proof });
  if (!packet.ok) { console.error('not promoted: ' + packet.why.join('; ')); process.exit(1); }
  if (apply) {
    let bank = loadBank();
    let bench = [];
    try { bench = rowsOf(JSON.parse(readFileSync(resolve(ROOT, 'tools', 'bench.json'), 'utf8'))); } catch (_) {}
    const why = validateBank(bank, bench);
    if (why) { console.error(why); process.exit(1); }
    if (rows.length) { bank = appendBank(bank, rows, bench); saveBank(BANK_PATH, bank, bench); }
    record(packet);
    console.log(`banked ${rows.length} page-proven ask(s); promotion packet ${PROMOTIONS_PATH}`);
  } else console.log('dry run — nothing banked. Add --apply to record the promotion.');
  console.log('\n' + packet.prBody);
  if (pr && /^\d+$/.test(pr)) {
    try { execFileSync('node', [resolve(here, 'automerge.mjs'), pr, '--label'], { cwd: ROOT, stdio: 'inherit' }); }
    catch (e) { console.error('could not label the PR: ' + e.message); process.exit(1); }
  }
}
