// Whether a pull request merges, gets a fix job, or waits. Code review never waits on a person (Atom, 2026-11-04:
// "verse's code review has to be approved, seems like the opposite of automated"). A hold is only for spending money
// or a message sent to someone outside, and those stay on the confirm line.
//   node tools/review-decide.mjs --review ok --gate ok --exam ok
//   node tools/review-decide.mjs --review fail --why "void-review found a risk"

/** @returns {{ action: 'merge' | 'fix' | 'hold', why: string }} */
export function decide({ review = true, gate = true, exam = true, spend = false, outbound = false, why = '' } = {}) {
  if (spend) return { action: 'hold', why: 'spending money waits on the confirm line' };
  if (outbound) return { action: 'hold', why: 'a message sent to someone outside waits on the confirm line' };
  const bad = [];
  if (!review) bad.push('Verse review found a bug or a risk');
  if (!gate) bad.push('the merge gate failed');
  if (!exam) bad.push(why || 'the outcome exam regressed');
  if (bad.length) return { action: 'fix', why: bad.join('; ') };
  return { action: 'merge', why: 'the review passed, the merge gate passed, and the outcome exam did not regress' };
}

function flag(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : '';
}

if (process.argv[1] && process.argv[1].endsWith('review-decide.mjs')) {
  const on = (v) => v !== 'fail' && v !== 'no' && v !== '0';
  const d = decide({
    review: on(flag('--review') || 'ok'),
    gate: on(flag('--gate') || 'ok'),
    exam: on(flag('--exam') || 'ok'),
    spend: flag('--spend') === 'yes',
    outbound: flag('--outbound') === 'yes',
    why: flag('--why'),
  });
  console.log('Verdict: ' + d.action + '. ' + d.why);
  process.exit(d.action === 'fix' ? 1 : 0);
}
