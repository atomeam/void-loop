// The outcome exam (/progress/): a few asks whose outcome is fixed. A pull request regresses it when a case
// that passed now fails. The merge decision (tools/review-decide.mjs) refuses a regression. No model, no network.
//   node tools/outcome-exam.mjs            print the cases
//   node tools/outcome-exam.mjs --check    exit 1 when a case that passed in exam.json now fails
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWorldTime } from '../void-live-deploy/skills/worldtime.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const EXAM = resolve(root, 'void-live-deploy/progress/exam.json');

/** the cases, each { id, ask, ok }. ok is whether the world-clock parser takes the ask. Pure. */
export function casesNow() {
  const rows = [
    ['time-tokyo', 'time in Tokyo', true],
    ['time-convert', '3pm London to Tokyo', true],
    ['not-a-clock', 'what is the weather', false],
  ];
  return rows.map(([id, ask, expect]) => ({ id, ask, ok: !!parseWorldTime(ask) === expect }));
}

/** cases that passed in the saved exam and fail now. Pure. */
export function regressions(saved, now) {
  const prev = new Map((saved && saved.cases || []).map((c) => [c.id, c.ok]));
  return (now || []).filter((c) => prev.get(c.id) === true && c.ok === false);
}

export function readExam(file = EXAM) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch (_) { return { cases: [] }; }
}

function main() {
  const now = casesNow();
  const bad = regressions(readExam(), now);
  for (const c of now) console.log((c.ok ? 'ok  ' : 'no  ') + c.id + '  ' + c.ask);
  if (process.argv.includes('--check') && bad.length) {
    console.error('outcome exam regressed: ' + bad.map((c) => c.ask).join('; '));
    process.exit(1);
  }
  console.log(bad.length ? 'regressed: ' + bad.length : 'outcome exam: no regression');
}

if (process.argv[1] && process.argv[1].endsWith('outcome-exam.mjs')) main();
