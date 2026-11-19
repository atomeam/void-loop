// Forge memory: the immutable regression bank. The seed is the benchmark as it stood when the bank was
// made: its first `seedCount` rows are pinned by `seedDigest`, so no cycle can edit, reorder or drop a
// legacy case (a mutation that breaks one scores zero in tools/evolve-tournament.mjs). Only *proven*
// additions are stored here; the benchmark itself stays where it is and keeps growing on its own.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BANK_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'immutable-regression-bank.json');
export const NOTE = 'Immutable regression bank for the Forge. The first seedCount rows of tools/bench.json are pinned by seedDigest: never edit or remove them. Rows here are page-proven additions, appended by tools/evolve-merge.mjs only.';

export const rowsOf = (rows) => (Array.isArray(rows) ? rows : []).map((r) => ({ ask: String((r && r.ask) || '').trim(), want: String((r && r.want) || '').trim() })).filter((r) => r.ask && r.want);
/** Stable bytes for a list of rows: ask and want, in order. Pure. */
export const canonical = (rows) => JSON.stringify(rowsOf(rows).map((r) => [r.ask.toLowerCase(), r.want]));
export const digest = (rows) => createHash('sha256').update(canonical(rows)).digest('hex').slice(0, 16);

/** Build the bank once from the benchmark (the committed file freezes the digest after that). Pure. */
export function seedFromBench(rows) {
  const list = rowsOf(rows);
  return { note: NOTE, seedSource: 'tools/bench.json', seedCount: list.length, seedDigest: digest(list), rows: [] };
}

/** Why this bank cannot be trusted, or '' when it can. `seedRows` are the current benchmark rows. Pure. */
export function validate(bank, seedRows = []) {
  if (!bank || !Array.isArray(bank.rows)) return 'the bank has no rows list';
  const n = Number(bank.seedCount);
  const seed = rowsOf(seedRows);
  if (!Number.isInteger(n) || n < 1 || n > seed.length) return 'the benchmark has fewer rows than the bank pinned: restore it, never remove a banked ask';
  if (digest(seed.slice(0, n)) !== bank.seedDigest) return 'the pinned benchmark rows changed: restore them, never edit a banked ask';
  const seen = new Set(seed.map((r) => r.ask.toLowerCase()));
  for (const [i, r] of bank.rows.entries()) {
    const ask = String((r && r.ask) || '').trim(), want = String((r && r.want) || '').trim();
    if (!ask || !want) return `addition ${i + 1} has no ask or want`;
    if (/https?:|www\.|[A-Za-z0-9_-]{32,}/.test(ask)) return `addition ${i + 1} looks like an address or a key, not a plain ask`;
    const k = ask.toLowerCase();
    if (seen.has(k)) return `addition ${i + 1} repeats the ask "${ask}"`;
    seen.add(k);
  }
  return '';
}

/** A new bank with proven rows appended, or throws when the seed or an existing row would change. Pure. */
export function append(bank, rows, seedRows = []) {
  const why = validate(bank, seedRows);
  if (why) throw new Error(why);
  const seen = new Set(rowsOf(seedRows).concat(bank.rows).map((r) => r.ask.toLowerCase()));
  const add = [];
  for (const r of rowsOf(rows)) {
    if (seen.has(r.ask.toLowerCase())) continue; // a cycle may offer the same proof twice; bank it once
    seen.add(r.ask.toLowerCase());
    add.push(r);
  }
  return { ...bank, rows: bank.rows.concat(add) };
}

/** The full regression set: the pinned benchmark prefix plus every proven addition. Pure. */
export const regressionRows = (bank, seedRows = []) => rowsOf(seedRows).slice(0, Number(bank && bank.seedCount) || 0).concat(rowsOf(bank && bank.rows));

export const load = (path = BANK_PATH) => JSON.parse(readFileSync(path, 'utf8'));
export const save = (path, bank, seedRows = []) => { const why = validate(bank, seedRows); if (why) throw new Error(why); writeFileSync(path, JSON.stringify(bank, null, 1) + '\n'); return bank; };
