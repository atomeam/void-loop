// Which of a workflow's two daily crons is today's. GitHub's crons are UTC, so a workflow meant for a New York time has one
// cron for summer time and one for winter, and keeps the one that matches. It keys on the cron that fired
// (github.event.schedule), never on the hour the run started: GitHub starts scheduled runs hours late, and the old
// "is it 2 PM in New York" gate skipped every one (void-voice.yml and learn.yml never ran on schedule before 2026-10-12).
//   node tools/cron-gate.mjs --summer '9 18 * * *' --winter '9 19 * * *'   (in a workflow: writes run=true|false to $GITHUB_OUTPUT)
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** true when New York is on summer time (daylight saving) at `now`. Pure. */
export function nySummer(now = new Date()) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).formatToParts(now).find((p) => p.type === 'timeZoneName');
  return !!name && name.value === 'EDT';
}

/** { run, why }: a manual run always runs; a scheduled one runs when the cron that fired is today's. Pure. */
export function gate({ event, schedule, summer, winter, now = new Date() }) {
  if (event !== 'schedule') return { run: true, why: (event || 'a manual run') + ': runs' };
  const today = nySummer(now) ? summer : winter, norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');
  if (norm(schedule) === norm(today)) return { run: true, why: 'today\'s cron (' + today + ') fired' };
  return { run: false, why: 'cron ' + norm(schedule) + ' fired, but today\'s is ' + today + ' (New York is on ' + (nySummer(now) ? 'summer' : 'winter') + ' time): that one runs' };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (f) => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : ''; };
  const g = gate({ event: process.env.GITHUB_EVENT_NAME, schedule: process.env.SCHEDULE, summer: arg('--summer'), winter: arg('--winter') });
  console.log(g.why);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'run=' + g.run + '\n');
}
