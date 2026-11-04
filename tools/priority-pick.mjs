// The next thing Verse works on, from three public records: the outcome exam (lowest domain), the crew's open jobs
// (oldest first), then the salvage shelf (smallest first). A nightly note is those facts plus the loop's share.
// Nothing here closes a job or deletes a shelf row.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shareOf } from '../void-live-deploy/lib/loop-share.js';

const SIZE = { S: 0, M: 1, L: 2 };

/** salvage table rows that still have a size. A "none" row has already been wired in. Pure. */
export function salvageRows(md) {
  const rows = [];
  for (const line of String(md || '').split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').slice(1, -1).map((s) => s.trim());
    const size = cells[cells.length - 1];
    if (!Object.prototype.hasOwnProperty.call(SIZE, size)) continue;
    const name = (cells[0].match(/`([^`]+)`/) || [])[1];
    if (name) rows.push({ name, size });
  }
  return rows;
}

/** one next step. Exam first (a visitor can see it), then the oldest crew job, then the smallest shelf piece. Pure. */
export function pickNext({ exam, jobs, salvage } = {}) {
  const low = exam && exam.lowest;
  if (low && low.domain && !(low.score >= 100)) return { kind: 'exam', id: String(low.domain), why: 'lowest exam domain ' + low.domain + ' at ' + low.score };
  const open = (jobs || []).filter((j) => j && (!j.state || j.state === 'queued' || j.state === 'open' || j.state === 'building'));
  open.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')));
  if (open[0]) return { kind: 'crew', id: String(open[0].id || open[0].ask || ''), why: 'oldest open crew job' };
  const shelf = salvageRows(typeof salvage === 'string' ? salvage : '').concat(Array.isArray(salvage) ? salvage : []);
  shelf.sort((a, b) => (SIZE[a.size] - SIZE[b.size]) || String(a.name).localeCompare(String(b.name)));
  if (shelf[0]) return { kind: 'salvage', id: shelf[0].name, why: 'smallest piece still on the salvage shelf (' + shelf[0].size + ')' };
  return { kind: 'none', id: '', why: 'nothing open on the exam, the crew or the shelf' };
}

/** the nightly record. share is shareOf(); pick is pickNext(). Pure. */
export function nightly({ at, pulls, exam, jobs, salvage, since = 0 } = {}) {
  const share = shareOf(pulls, { since });
  const pick = pickNext({ exam, jobs, salvage });
  return { at, share, pick };
}

function read(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch (_) { return null; } }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : ''; };
  const pulls = read(flag('--pulls')) || [];
  const exam = read(flag('--exam'));
  const crew = read(flag('--crew'));
  const jobs = Array.isArray(crew) ? crew : (crew && Array.isArray(crew.wants) && crew.wants.length ? crew.wants : (crew && crew.priorities && crew.priorities.bets) || (crew && crew.jobs) || []);
  const salvage = flag('--salvage') ? readFileSync(flag('--salvage'), 'utf8') : '';
  const since = Date.now() - 14 * 864e5;
  console.log(JSON.stringify(nightly({ at: new Date().toISOString(), pulls, exam, jobs, salvage, since }), null, 1));
}
