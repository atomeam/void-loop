// Tower watchdog: the climb must move. The stall rule (#3040, tools/tower-target.mjs) moves the Tower off a site that has made no progress for STALL_DAYS, but
// it only ran inside tower-size.yml, so a month of nothing could pass if that run did not land. This runs the same settle from the files on disk on every house
// lane run: when the rule says the climb should move and the file has not, the file is written (the house lane ships it); when the file is idle past the limit and
// the rule still keeps it, or the run that normally settles it has not landed for a day and a half, the coder gets a heal job.
import { join } from 'node:path';
import { STALL_DAYS, stallCheck } from '../tower-target.mjs';

export const DAY = 864e5, RUN_LATE_MS = 36 * 3600e3;
export const daysBetween = (a, b) => Math.floor((Date.parse(b) - Date.parse(a)) / DAY);
/** the verdict for one settle: 'moved' (the rule moves it and the file has not), 'stuck' (idle past the limit, kept anyway), 'late' (a settling run missing), or 'fine'. Pure. */
export function verdict({ old, file, today, lastRunAt = 0, now = Date.now() }) {
  const idle = old && old.id && old.progressAt ? daysBetween(old.progressAt, today) : 0;
  const moved = JSON.stringify(file) !== JSON.stringify(old);
  if (moved && file.id !== old.id) return { kind: 'moved', idle, from: old.id, to: file.id };
  if (idle > STALL_DAYS) return { kind: 'stuck', idle, site: old.id };
  if (lastRunAt && now - lastRunAt > RUN_LATE_MS) return { kind: 'late', idle, hours: Math.round((now - lastRunAt) / 3600e3) };
  return { kind: 'fine', idle, site: old.id, write: moved };
}
/** when the run that settles the target last finished, from the workflow's runs (ms), or 0 when unreadable. Pure. */
export function lastSettleMs(runsJson) {
  try { const r = (JSON.parse(runsJson).workflow_runs || []).filter((x) => x.conclusion === 'success'); return r.length ? Math.max(...r.map((x) => Date.parse(x.updated_at || x.created_at) || 0)) : 0; } catch { return 0; }
}

export async function run(ctx) {
  const { settleTarget } = await import('../tower-target.mjs');
  const today = new Date(ctx.now).toISOString().slice(0, 10), s = settleTarget(today);
  const runs = await ctx.hit('https://api.github.com/repos/atomeam/void-loop/actions/workflows/tower-size.yml/runs?branch=main&status=success&per_page=5', { init: { headers: { accept: 'application/vnd.github+json' } } });
  const v = verdict({ old: s.old, file: s.file, today, lastRunAt: lastSettleMs(runs.text), now: ctx.now });
  const note = 'No model call. Reads the Tower files already in the repo.';
  if (v.kind === 'moved') {
    ctx.save(join(ctx.root, 'void-live-deploy/tower.target.json'), JSON.stringify(s.file, null, 1) + '\n');
    return { last: 'The Tower had made no progress on ' + v.from + ' for ' + v.idle + ' days and the settling run had not moved it. Moved the climb to ' + (v.to || 'the next site') + ' (' + String(s.why || '').slice(0, 140) + ').', ok: true, note };
  }
  if (v.kind === 'stuck') {
    const q = await ctx.queueJob('The Tower has made no progress on ' + v.site + ' for ' + v.idle + ' days and the stall rule keeps it. Find why tools/tower-target.mjs does not move it.', 'heal:tower-stall');
    return { last: 'The Tower has sat on ' + v.site + ' for ' + v.idle + ' days with no progress and the stall rule keeps it. Heal job for the coder (' + (q.queued ? 'queued' : q.why) + ').', ok: true, note };
  }
  if (v.kind === 'late') {
    const q = await ctx.queueJob('tower-size.yml has not succeeded on main for ' + v.hours + ' hours, so the Tower target is not being settled. Repair it.', 'heal:tower-size.yml');
    return { last: 'The Tower file is fine (' + s.old.id + ', ' + v.idle + ' days since progress) but the run that settles it last succeeded ' + v.hours + ' hours ago. Heal job for the coder (' + (q.queued ? 'queued' : q.why) + ').', ok: true, note };
  }
  if (v.write) ctx.save(join(ctx.root, 'void-live-deploy/tower.target.json'), JSON.stringify(s.file, null, 1) + '\n');
  // no day count on a healthy line: it would change the log every day and ship a pull request for nothing
  return { last: 'The Tower is on ' + v.site + ' and has made progress inside the ' + STALL_DAYS + ' days it is allowed' + (v.idle > 1 ? ' (' + v.idle + ' days since the last gain)' : '') + '.' + (v.write ? ' Brought its counts up to date.' : ''), ok: true, note };
}
